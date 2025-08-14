// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract OrderBook is ReentrancyGuard, Ownable {
    error OrderBook__ArrayLengthsMustMatch();
    error OrderBook__ValueMustBeGreaterThanZero();
    error OrderBook__PositionDoesNotExist();
    error OrderBook__InvalidAssetPair();
    error OrderBook__MaximumOpenPositionsReached();
    error OrderBook__TokenTransferFailed();
    error OrderBook__LeverageExceedsMaximum();
    error OrderBook__InvalidPositionType();
    error OrderBook__PositionSizeBelowMinimum();
    error OrderBook__LongPositionLimitReached();
    error OrderBook__ShortPositionLimitReached();
    error OrderBook__PositionNotEligibleForLiquidation(int256 userProfitLoss);
    error OrderBook__NoExecutionRewardsAvailable();
    error OrderBook__TokenApprovalUnsuccessful();
    error OrderBook__LimitOrderPriceMustBePositive();
    error OrderBook__MaximumLimitOrdersReached();
    error OrderBook__LimitOrderNotFound();
    error OrderBook__SlippageExceedsMaximum();

    IPyth priceOracle;

    struct TradePosition {
        uint256 assetPairId;
        int256 entryPrice;
        int256 netCollateral;
        int256 leverageMultiplier;
        uint256 positionDirection;
        uint256 creationTime;
        uint256 feeCalculationIndex;
    }

    struct TradingPair {
        bytes32 oraclePriceFeedId;
        int256 totalLongPositions;
        int256 totalShortPositions;
        int256 maximumOpenInterest;
        int256[] interestRates;
        uint256[] timeStamps;
        string tradingSymbol;
    }

    struct PendingLimitOrder {
        address traderAddress;
        uint256 pairId;
        int256 collateralAmount;
        int256 leverageAmount;
        uint256 positionDirection;
        int256 executionPrice;
    }

    uint256 private constant LONG_DIRECTION = 0;
    uint256 private constant SHORT_DIRECTION = 1;
    int256 private constant FEE_ACCURACY = 10_000_000;
    int256 private constant LEVERAGE_ACCURACY = 1_000_000;
    int256 private constant COLLATERAL_ACCURACY = 1e18;
    int256 private constant TIME_ACCURACY = 1e2;
    int256 private constant PRICE_ACCURACY = 1e8;
    int256 private constant SECONDS_PER_HOUR = 3600;

    address private collateralTokenAddress;
    int256 private openingFeeRate = 7500;
    int256 private baseInterestRate = 600;
    int256 private variableInterestRate = 100;
    int256 private maximumInterestRate = 100 * 100;
    int256 private minimumPositionSize = 1500 ether;
    int256 private maximumSlippage = 5;
    int256 private baseExecutionReward = 2 ether;
    int256 private executionRewardRate = 0;

    uint256 private availableAssetPairsCount;

    mapping(uint256 assetPairId => TradingPair tradingPair) private assetPairData;

    mapping(
        address traderAddress
            => mapping(
                uint256 assetPairId => mapping(uint256 positionIndex => TradePosition tradePosition)
            )
    ) private userPositionData;

    mapping(address traderAddress => mapping(uint256 pairId => uint256[3] activePositions)) private userActivePositions;
    mapping(address executorAddress => uint256 executionRewards) private executorRewards;

    mapping(address traderAddress => mapping(uint256 pairId => uint256[3] pendingLimitOrders)) private userPendingOrders;
    mapping(
        address traderAddress
            => mapping(
                uint256 pairId => mapping(uint256 orderIndex => PendingLimitOrder limitOrder)
            )
    ) private limitOrderRegistry;

    event PositionClosed(address indexed trader, uint256 indexed pairId, uint256 positionIndex);
    event MarketPositionOpened(address indexed trader, uint256 indexed pairId);
    event PositionLiquidated(address indexed trader, uint256 pairId, uint256 positionIndex);
    event PositionOpened(address indexed trader, uint256 indexed pairId, uint256 indexed positionIndex);
    event OpenInterestModified(int256 longInterest, int256 shortInterest);
    event LiquidationDetails(address indexed traderAddress, uint256 indexed pairId, int256 indexed profitLoss);
    event PositionCloseDetails(address indexed traderAddress, int256 indexed pairId, int256 indexed profitLoss);
    event CollateralTokenModified(address indexed user, address indexed newTokenAddress);
    event OpeningFeeModified(address user, int256 newOpeningFee);
    event BaseInterestRateModified(address indexed user, int256 indexed newBaseInterestRate);
    event VariableInterestRateModified(address indexed user, int256 indexed newVariableInterestRate);
    event MaximumInterestRateModified(address indexed user, int256 indexed newMaximumInterestRate);
    event MinimumPositionSizeModified(address indexed user, int256 indexed newMinimumPositionSize);
    event OrderBookOwnershipTransferred(address indexed newOwner);
    event ExecutionRewardsClaimed(address indexed executorAddress, uint256 indexed amount);
    event ExecutionRewardRateModified(address indexed user, int256 indexed newExecutionRewardRate);
    event BaseExecutionRewardModified(address indexed user, int256 indexed newBaseExecutionReward);
    event MaximumOpenInterestModified(uint256 indexed pairId, int256 indexed newMaximumOpenInterest);
    event AverageInterestRateCalculation(uint256 indexed pairId, int256 indexed interestRate, uint256 indexed positionType);
    event InterestRatesUpdated(uint256 indexed pairId, int256[] interestRates);
    event PriceModification(int256 indexed priceModification);
    event UserProfitLoss(int256 indexed userProfitLoss);
    event LimitOrderCreated(address indexed traderAddress, uint256 indexed pairId, uint256 indexed orderSlot);
    event MaximumSlippageModified(int256 indexed newMaximumSlippage);
    event LimitOrderExecuted(address indexed executor, address indexed trader, uint256 indexed pairId);
    event LimitOrderCancelled(address indexed traderAddress, uint256 indexed pairId);

    modifier validateTradeParameters(address user, int256 amount, int256 leverage, uint256 pairId, uint256 positionType) {
        if (assetPairData[pairId].oraclePriceFeedId == 0) {
            revert OrderBook__InvalidAssetPair();
        } else if (positionType != 0 && positionType != 1) {
            revert OrderBook__InvalidPositionType();
        } else if (amount == 0 || leverage == 0) {
            revert OrderBook__ValueMustBeGreaterThanZero();
        } else if (((amount * leverage) / LEVERAGE_ACCURACY) < minimumPositionSize) {
            revert OrderBook__PositionSizeBelowMinimum();
        } else if (
            positionType == 0
                && (
                    ((amount * leverage) / LEVERAGE_ACCURACY)
                        > (assetPairData[pairId].maximumOpenInterest - assetPairData[pairId].totalLongPositions)
                )
        ) {
            revert OrderBook__LongPositionLimitReached();
        } else if (
            positionType == 1
                && ((amount * leverage) / LEVERAGE_ACCURACY)
                    > (assetPairData[pairId].maximumOpenInterest - assetPairData[pairId].totalShortPositions)
        ) {
            revert OrderBook__ShortPositionLimitReached();
        } else if (
            (
                _calculateArraySum(userActivePositions[user][pairId])
                    + _calculateArraySum(userPendingOrders[msg.sender][pairId])
            ) >= 3
        ) {
            revert OrderBook__MaximumOpenPositionsReached();
        } else if (leverage > 150_000_000) {
            revert OrderBook__LeverageExceedsMaximum();
        }
        _;
    }

    modifier positionExists(address user, uint256 pairId, uint256 positionIndex) {
        if (userPositionData[user][pairId][positionIndex].entryPrice == 0) {
            revert OrderBook__PositionDoesNotExist();
        }
        _;
    }

    modifier validAssetPair(uint256 pairId) {
        if (assetPairData[pairId].oraclePriceFeedId == 0) {
            revert OrderBook__InvalidAssetPair();
        }
        _;
    }

    modifier validateLeverage(int256 leverage) {
        if (leverage > 150_000_000) {
            revert OrderBook__LeverageExceedsMaximum();
        }
        _;
    }

    modifier validatePositionType(uint256 positionType) {
        if (positionType != 0 && positionType != 1) {
            revert OrderBook__InvalidPositionType();
        }
        _;
    }

    modifier hasRewards(address user) {
        if (executorRewards[user] == 0) {
            revert OrderBook__NoExecutionRewardsAvailable();
        }
        _;
    }

    constructor(
        address oracleAddress,
        address collateralToken,
        bytes32[] memory priceFeedIds,
        int256[] memory maxOpenInterest,
        uint256[] memory pairIds,
        string[] memory tradingSymbols
    ) Ownable(msg.sender) {
        if (priceFeedIds.length != pairIds.length) {
            revert OrderBook__ArrayLengthsMustMatch();
        }
        if (pairIds.length != tradingSymbols.length) {
            revert OrderBook__ArrayLengthsMustMatch();
        }
        collateralTokenAddress = collateralToken;

        availableAssetPairsCount = priceFeedIds.length;
        priceOracle = IPyth(oracleAddress);
        for (uint256 i = 0; i < priceFeedIds.length; i++) {
            assetPairData[i].oraclePriceFeedId = priceFeedIds[i];
            assetPairData[i].tradingSymbol = tradingSymbols[i];
            assetPairData[i].maximumOpenInterest = maxOpenInterest[i];
        }
    }

    function modifyCollateralToken(address newCollateralToken) external onlyOwner {
        collateralTokenAddress = newCollateralToken;
        emit CollateralTokenModified(msg.sender, collateralTokenAddress);
    }

    function modifyOpeningFee(int256 newOpeningFeeRate) external onlyOwner {
        openingFeeRate = newOpeningFeeRate;
        emit OpeningFeeModified(msg.sender, openingFeeRate);
    }

    function modifyBaseInterestRate(int256 newBaseInterestRate) external onlyOwner {
        baseInterestRate = newBaseInterestRate;
        emit BaseInterestRateModified(msg.sender, newBaseInterestRate);
    }

    function modifyVariableInterestRate(int256 newVariableInterestRate) external onlyOwner {
        variableInterestRate = newVariableInterestRate;
        emit VariableInterestRateModified(msg.sender, newVariableInterestRate);
    }

    function modifyMaximumInterestRate(int256 newMaximumInterestRate) external onlyOwner {
        maximumInterestRate = newMaximumInterestRate;
        emit MaximumInterestRateModified(msg.sender, newMaximumInterestRate);
    }

    function modifyMinimumPositionSize(int256 newMinimumPositionSize) external onlyOwner {
        minimumPositionSize = newMinimumPositionSize;
        emit MinimumPositionSizeModified(msg.sender, newMinimumPositionSize);
    }

    function withdrawEther(address payable recipient) external payable onlyOwner {
        (bool success,) = recipient.call{value: address(this).balance}("");
        if (!success) {
            revert OrderBook__TokenTransferFailed();
        }
    }

    function modifyExecutionRewardRate(int256 newExecutionRewardRate) external onlyOwner {
        executionRewardRate = newExecutionRewardRate;
        emit ExecutionRewardRateModified(msg.sender, newExecutionRewardRate);
    }

    function modifyBaseExecutionReward(int256 newBaseExecutionReward) external onlyOwner {
        baseExecutionReward = newBaseExecutionReward;
        emit BaseExecutionRewardModified(msg.sender, newBaseExecutionReward);
    }

    function modifyMaximumOpenInterest(uint256 pairId, int256 newMaximumOpenInterest) external onlyOwner {
        assetPairData[pairId].maximumOpenInterest = newMaximumOpenInterest;
        emit MaximumOpenInterestModified(pairId, assetPairData[pairId].maximumOpenInterest);
    }

    function modifyMaximumSlippage(int256 newMaximumSlippage) external onlyOwner {
        maximumSlippage = newMaximumSlippage;
        emit MaximumSlippageModified(maximumSlippage);
    }

    function withdrawERC20Token(address tokenAddress, uint256 amount) external onlyOwner {
        bool success = IERC20(tokenAddress).transfer(msg.sender, amount);
        if (!success) {
            revert OrderBook__TokenTransferFailed();
        }
    }

    function claimExecutionRewards() external hasRewards(msg.sender) nonReentrant {
        uint256 amount = uint256(executorRewards[msg.sender]);
        executorRewards[msg.sender] = 0;

        bool success = IERC20(collateralTokenAddress).transferFrom(address(this), msg.sender, amount);
        if (!success) {
            revert OrderBook__TokenTransferFailed();
        }
        emit ExecutionRewardsClaimed(msg.sender, amount);
    }

    function _calculateArraySum(uint256[3] storage array) private view returns (uint256 sum) {
        sum = 0;
        for (uint256 i = 0; i < 3; i++) {
            sum += array[i];
        }
        return sum;
    }

    function openMarketPosition(
        uint256 pairId,
        int256 collateralAmount,
        int256 leverageAmount,
        uint256 positionType,
        bytes[] calldata priceUpdateData
    ) public payable validateTradeParameters(msg.sender, collateralAmount, leverageAmount, pairId, positionType) nonReentrant {
        _transferTokens(msg.sender, address(this), uint256(collateralAmount));

        _createPosition(msg.sender, pairId, collateralAmount, leverageAmount, positionType, priceUpdateData);

        emit MarketPositionOpened(msg.sender, pairId);
    }

    function createLimitOrder(
        uint256 pairId,
        int256 collateralAmount,
        int256 leverageAmount,
        uint256 positionType,
        int256 executionPrice
    ) public payable validateTradeParameters(msg.sender, collateralAmount, leverageAmount, pairId, positionType) nonReentrant {
        if (executionPrice <= 0) {
            revert OrderBook__LimitOrderPriceMustBePositive();
        }
        uint256 orderSlot = _findAvailableOrderSlot(userPendingOrders[msg.sender][pairId]);
        _transferTokens(msg.sender, address(this), uint256(collateralAmount));
        userPendingOrders[msg.sender][pairId][orderSlot] = 1;
        limitOrderRegistry[msg.sender][pairId][orderSlot] = PendingLimitOrder(
            msg.sender, pairId, (collateralAmount - baseExecutionReward), leverageAmount, positionType, executionPrice
        );

        emit LimitOrderCreated(msg.sender, pairId, orderSlot);
    }

    function executeLimitOrder(
        address traderAddress,
        uint256 pairId,
        uint256 orderSlot,
        bytes[] calldata priceUpdateData
    ) public payable nonReentrant {
        if (limitOrderRegistry[traderAddress][pairId][orderSlot].executionPrice == 0) {
            revert OrderBook__LimitOrderNotFound();
        }
        int256 collateralAmount = limitOrderRegistry[traderAddress][pairId][orderSlot].collateralAmount;
        int256 leverageAmount = limitOrderRegistry[traderAddress][pairId][orderSlot].leverageAmount;
        int256 executionPrice = limitOrderRegistry[traderAddress][pairId][orderSlot].executionPrice;
        uint256 positionType = limitOrderRegistry[traderAddress][pairId][orderSlot].positionDirection;
        delete limitOrderRegistry[traderAddress][pairId][orderSlot];
        uint256 positionSlot = _findAvailablePositionSlot(userActivePositions[traderAddress][pairId]);
        _createPosition(traderAddress, pairId, collateralAmount, leverageAmount, positionType, priceUpdateData);

        int256 priceDifference = 100
            * (userPositionData[traderAddress][pairId][positionSlot].entryPrice - executionPrice)
            / ((userPositionData[traderAddress][pairId][positionSlot].entryPrice + executionPrice) / 2);

        if (positionType == 0) {
            if (priceDifference > maximumSlippage) {
                revert OrderBook__SlippageExceedsMaximum();
            }
        } else {
            if (priceDifference < -1 * maximumSlippage) {
                revert OrderBook__SlippageExceedsMaximum();
            }
        }

        userPendingOrders[msg.sender][pairId][orderSlot] = 0;
        executorRewards[msg.sender] += uint256(baseExecutionReward);
        emit LimitOrderExecuted(msg.sender, traderAddress, pairId);
    }

    function cancelLimitOrder(uint256 pairId, uint256 orderSlot) external nonReentrant {
        if (limitOrderRegistry[msg.sender][pairId][orderSlot].executionPrice == 0) {
            revert OrderBook__LimitOrderNotFound();
        }
        userPendingOrders[msg.sender][pairId][orderSlot] = 0;
        delete limitOrderRegistry[msg.sender][pairId][orderSlot];
        emit LimitOrderCancelled(msg.sender, pairId);
    }

    function _absoluteValue(int256 x) private pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    function closePosition(uint256 pairId, uint256 positionIndex, bytes[] calldata priceUpdateData)
        public
        payable
        positionExists(msg.sender, pairId, positionIndex)
        nonReentrant
    {
        TradePosition memory userPosition = userPositionData[msg.sender][pairId][positionIndex];

        int256 userProfitLoss = _calculateUserProfitLoss(msg.sender, userPosition, positionIndex, priceUpdateData);
        userProfitLoss = userProfitLoss - _calculateOpeningFee(userPosition.netCollateral, userPosition.leverageMultiplier);

        delete userPositionData[msg.sender][userPosition.assetPairId][positionIndex];
        userActivePositions[msg.sender][pairId][positionIndex] = 0;

        _updatePairTotalPositions(
            userPosition.positionDirection,
            pairId,
            (userPosition.netCollateral * userPosition.leverageMultiplier / LEVERAGE_ACCURACY),
            false
        );

        assetPairData[pairId].timeStamps.push(block.timestamp);
        _updateInterestRateArray(pairId);

        if (userProfitLoss > 0) {
            uint256 uintUserProfitLoss = uint256(userProfitLoss);
            bool success = IERC20(collateralTokenAddress).transfer(msg.sender, uintUserProfitLoss);
            if (!success) {
                revert OrderBook__TokenTransferFailed();
            }
        }

        emit PositionClosed(msg.sender, userPosition.assetPairId, positionIndex);
        emit PositionCloseDetails(msg.sender, userPosition.netCollateral, userProfitLoss);
    }

    function liquidatePosition(
        address trader,
        uint256 pairId,
        uint256 positionIndex,
        bytes[] calldata priceUpdateData
    ) public payable positionExists(trader, pairId, positionIndex) nonReentrant {
        TradePosition memory userPosition = userPositionData[trader][pairId][positionIndex];

        int256 userProfitLoss = _calculateUserProfitLoss(trader, userPosition, positionIndex, priceUpdateData);

        if (userProfitLoss <= 0) {
            delete userPositionData[trader][userPosition.assetPairId][positionIndex];
            _updatePairTotalPositions(
                userPosition.positionDirection,
                userPosition.assetPairId,
                userPosition.netCollateral * userPosition.leverageMultiplier / LEVERAGE_ACCURACY,
                false
            );
            assetPairData[pairId].timeStamps.push(block.timestamp);
            _updateInterestRateArray(pairId);

            userActivePositions[trader][pairId][positionIndex] = 0;
            userActivePositions[trader][userPosition.assetPairId][positionIndex] = 0;
            executorRewards[msg.sender] += uint256(
                baseExecutionReward
                    + executionRewardRate * userPosition.netCollateral * userPosition.leverageMultiplier
                        / LEVERAGE_ACCURACY
            );
            emit PositionLiquidated(trader, userPosition.assetPairId, positionIndex);
            emit LiquidationDetails(trader, userPosition.assetPairId, userProfitLoss);
        } else {
            revert OrderBook__PositionNotEligibleForLiquidation(userProfitLoss);
        }
    }

    function _calculateUserProfitLoss(
        address user,
        TradePosition memory userPosition,
        uint256 positionIndex,
        bytes[] calldata priceUpdateData
    ) private returns (int256) {
        (PythStructs.Price memory closePriceData) =
            getCurrentPairPrice(priceUpdateData, userPosition.assetPairId);

        int256 interestRatePercentage = _calculateInterestRate(
            user, userPosition.assetPairId, userPosition.positionDirection, positionIndex
        );

        int256 totalInterestAmount = (
            interestRatePercentage * userPosition.leverageMultiplier * userPosition.netCollateral
                * int256(block.timestamp - userPosition.creationTime) * TIME_ACCURACY
        ) / (FEE_ACCURACY * LEVERAGE_ACCURACY * SECONDS_PER_HOUR * TIME_ACCURACY);

        int256 userProfitLoss;

        int256 priceModification = userPosition.entryPrice
            - int256(_calculateAdjustedPrice(userPosition.positionDirection, closePriceData, 1));

        emit PriceModification(priceModification);

        if (userPosition.positionDirection == 0) {
            userProfitLoss = userPosition.netCollateral - totalInterestAmount
                - userPosition.leverageMultiplier * priceModification * userPosition.netCollateral
                    / userPosition.entryPrice / (LEVERAGE_ACCURACY);
        }
        if (userPosition.positionDirection == 1) {
            userProfitLoss = userPosition.netCollateral - totalInterestAmount
                + userPosition.leverageMultiplier * priceModification * userPosition.netCollateral
                    / userPosition.entryPrice / (LEVERAGE_ACCURACY);
        }
        emit UserProfitLoss(userProfitLoss);

        return userProfitLoss;
    }

    function _updatePairTotalPositions(uint256 positionType, uint256 pairId, int256 positionSize, bool openingPosition)
        private
    {
        if (positionType == 0) {
            if (openingPosition) {
                assetPairData[pairId].totalLongPositions += (positionSize);
            } else {
                assetPairData[pairId].totalLongPositions -= (positionSize);
            }
        }
        if (positionType == 1) {
            if (openingPosition) {
                assetPairData[pairId].totalShortPositions += (positionSize);
            } else {
                assetPairData[pairId].totalShortPositions -= (positionSize);
            }
        }
        emit OpenInterestModified(
            assetPairData[pairId].totalLongPositions, assetPairData[pairId].totalShortPositions
        );
    }

    function _transferTokens(address from, address to, uint256 amount) private {
        bool success = IERC20(collateralTokenAddress).transferFrom(from, to, amount);
        if (!success) {
            revert OrderBook__TokenTransferFailed();
        }
    }

    function _findAvailablePositionSlot(uint256[3] storage array) private view returns (uint256 index) {
        index = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (array[i] == 0) {
                index = i;
            }
        }
        return index;
    }

    function _findAvailableOrderSlot(uint256[3] storage array) private view returns (uint256 index) {
        index = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (array[i] == 0) {
                index = i;
            }
        }
        return index;
    }

    function _createPosition(
        address user,
        uint256 pairId,
        int256 collateralAmount,
        int256 leverageAmount,
        uint256 positionType,
        bytes[] calldata priceUpdateData
    ) private {
        int256 netCollateral;
        {
            netCollateral = collateralAmount - _calculateOpeningFee(collateralAmount, leverageAmount);
        }
        uint256 positionSlot = _findAvailablePositionSlot(userActivePositions[user][pairId]);
        userActivePositions[user][pairId][positionSlot] = 1;

        _updatePairTotalPositions(positionType, pairId, (netCollateral * leverageAmount / LEVERAGE_ACCURACY), true);

        assetPairData[pairId].timeStamps.push(block.timestamp);

        _updateInterestRateArray(pairId);

        (PythStructs.Price memory priceData) = getCurrentPairPrice(priceUpdateData, pairId);

        int256 adjustedPrice = int256(_calculateAdjustedPrice(positionType, priceData, 0));

        userPositionData[user][pairId][positionSlot] = TradePosition(
            pairId,
            adjustedPrice,
            netCollateral,
            leverageAmount,
            positionType,
            priceData.publishTime,
            (assetPairData[pairId].timeStamps.length - 1)
        );
        emit PositionOpened(user, pairId, positionSlot);
    }

    function _updateInterestRateArray(uint256 pairId) private {
        int256 interestRate;
        if (assetPairData[pairId].totalLongPositions == 0 && assetPairData[pairId].totalShortPositions == 0) {
            delete assetPairData[pairId].timeStamps;
            delete assetPairData[pairId].interestRates;
        } else if (assetPairData[pairId].totalLongPositions == 0) {
            interestRate = -1 * maximumInterestRate * (assetPairData[pairId].totalShortPositions)
                / assetPairData[pairId].maximumOpenInterest;
        } else if (assetPairData[pairId].totalShortPositions == 0) {
            interestRate = maximumInterestRate * assetPairData[pairId].totalLongPositions
                / assetPairData[pairId].maximumOpenInterest;
        } else if ((assetPairData[pairId].totalLongPositions / assetPairData[pairId].totalShortPositions) > 1)
        {
            interestRate = variableInterestRate * assetPairData[pairId].totalLongPositions
                / assetPairData[pairId].totalShortPositions;
        } else if ((assetPairData[pairId].totalLongPositions / assetPairData[pairId].totalShortPositions) < 1)
        {
            interestRate = -1 * variableInterestRate * assetPairData[pairId].totalShortPositions
                / assetPairData[pairId].totalLongPositions;
        } else if (assetPairData[pairId].totalLongPositions == assetPairData[pairId].totalShortPositions) {
            interestRate = 0;
        }
        assetPairData[pairId].interestRates.push(interestRate);

        emit InterestRatesUpdated(pairId, assetPairData[pairId].interestRates);
    }

    function _calculateAdjustedPrice(uint256 positionType, PythStructs.Price memory priceData, uint256 openingOrClosing)
        private
        pure
        returns (int256)
    {
        int256 adjustedPrice;
        int64 targetDecimals = 8;
        if (positionType == 0 && openingOrClosing == 0) {
            adjustedPrice = (priceData.price) + int64(priceData.conf);
        } else if (positionType == 0 && openingOrClosing == 1) {
            adjustedPrice = (priceData.price) - int64(priceData.conf);
        } else if (positionType == 1 && openingOrClosing == 0) {
            adjustedPrice = (priceData.price) - int64(priceData.conf);
        } else {
            adjustedPrice = (priceData.price + int64(priceData.conf));
        }

        int64 priceDecimals = int64(uint64(int64((-1 * priceData.expo))));

        if (targetDecimals >= priceDecimals) {
            return adjustedPrice = int256(uint64(int64(adjustedPrice)) * 10 ** uint64(targetDecimals - priceDecimals));
        } else {
            return adjustedPrice = int256(uint64(int64(adjustedPrice)) / 10 ** uint64(priceDecimals - targetDecimals));
        }
    }

    function _calculateOpeningFee(int256 collateralAmount, int256 leverageAmount) private view returns (int256 openingFee) {
        int256 positionSize = (collateralAmount * leverageAmount) / LEVERAGE_ACCURACY;
        openingFee = (positionSize * openingFeeRate) / FEE_ACCURACY;
    }

    function _calculateInterestRate(address user, uint256 pairId, uint256 positionType, uint256 positionIndex)
        private
        view
        returns (int256)
    {
        uint256 timeArrayLength = assetPairData[pairId].timeStamps.length;

        uint256 startIndex = userPositionData[user][pairId][positionIndex].feeCalculationIndex;

        int256 sum;
        for (uint256 i = startIndex; i < (assetPairData[pairId].timeStamps.length - 1); i++) {
            sum = sum
                + assetPairData[pairId].interestRates[i]
                    * int256(assetPairData[pairId].timeStamps[i + 1] - assetPairData[pairId].timeStamps[i]);
        }

        sum = sum
            + assetPairData[pairId].interestRates[timeArrayLength - 1]
                * int256(block.timestamp - assetPairData[pairId].timeStamps[timeArrayLength - 1]);

        int256 averageInterestRate = sum
            / (
                int256(assetPairData[pairId].timeStamps.length - startIndex)
                    * int256(block.timestamp + 1 seconds - assetPairData[pairId].timeStamps[startIndex])
            );

        int256 interestRate;

        if (positionType == 0) {
            interestRate = baseInterestRate + averageInterestRate;
            return interestRate;
        }
        if (positionType == 1) {
            interestRate = baseInterestRate - averageInterestRate;
            return interestRate;
        }
    }

    function getCurrentPairPrice(bytes[] calldata priceUpdateData, uint256 pairId)
        public
        payable
        returns (PythStructs.Price memory)
    {
        uint256 updateFee = priceOracle.getUpdateFee(priceUpdateData);
        priceOracle.updatePriceFeeds{value: updateFee}(priceUpdateData);
        PythStructs.Price memory pythPriceData = priceOracle.getPriceUnsafe(assetPairData[pairId].oraclePriceFeedId);
        return (pythPriceData);
    }

    function convertToInt(PythStructs.Price memory price, uint8 targetDecimals) private pure returns (int256) {
        if (price.price < 0 || price.expo > 0 || price.expo < -255) {
            revert();
        }

        uint8 priceDecimals = uint8(uint32(-1 * price.expo));

        if (targetDecimals >= priceDecimals) {
            return int256(uint256(uint64(price.price)) * 10 ** uint32(targetDecimals - priceDecimals));
        } else {
            return int256(uint256(uint64(price.price)) / 10 ** uint32(priceDecimals - targetDecimals));
        }
    }

    function getUserPositionDetails(address user, uint256 pairId, uint256 positionIndex)
        external
        view
        returns (TradePosition memory)
    {
        return userPositionData[user][pairId][positionIndex];
    }

    function getAssetPairData(uint256 pairId) external view returns (TradingPair memory) {
        return assetPairData[pairId];
    }

    function getUserActivePositions(address user, uint256 pairId) external view returns (uint256[3] memory) {
        return userActivePositions[user][pairId];
    }

    function getAllUserPositions(address user) external view returns (TradePosition[15] memory) {
        TradePosition[15] memory allPositions;
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 index = 0; index < 3; index++) {
                if (userPositionData[user][i][index].leverageMultiplier != 0) {
                    uint256 arrayLocation = i * 3 + index;
                    allPositions[arrayLocation] = (userPositionData[user][i][index]);
                } else {}
            }
        }
        return allPositions;
    }

    function getAllUserLimitOrders(address user) external view returns (PendingLimitOrder[15] memory) {
        PendingLimitOrder[15] memory allLimitOrders;
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 index = 0; index < 3; index++) {
                if (limitOrderRegistry[user][i][index].executionPrice != 0) {
                    uint256 arrayLocation = i * 3 + index;
                    allLimitOrders[arrayLocation] = (limitOrderRegistry[user][i][index]);
                } else {}
            }
        }
        return allLimitOrders;
    }

    function getPositionInterestFees(address user, uint256 assetPairId, uint256 positionIndex)
        external
        view
        returns (int256 interestFeeAmount)
    {
        TradePosition memory position = userPositionData[user][assetPairId][positionIndex];

        int256 interestRatePercentage =
            _calculateInterestRate(user, assetPairId, position.positionDirection, positionIndex);

        interestFeeAmount = interestRatePercentage * int256(block.timestamp - position.creationTime)
            * int256(position.netCollateral * position.leverageMultiplier)
            / (LEVERAGE_ACCURACY * FEE_ACCURACY * SECONDS_PER_HOUR);
    }

    function getLiquidationPrice(address user, uint256 assetPairId, uint256 positionIndex)
        external
        view
        positionExists(user, assetPairId, positionIndex)
        returns (int256 liquidationPrice, int256 interestFeeAmount)
    {
        TradePosition memory position = userPositionData[user][assetPairId][positionIndex];

        int256 interestRatePercentage =
            _calculateInterestRate(user, assetPairId, position.positionDirection, positionIndex);

        interestFeeAmount = interestRatePercentage * int256(block.timestamp - position.creationTime)
            * int256(position.netCollateral * position.leverageMultiplier)
            / (LEVERAGE_ACCURACY * FEE_ACCURACY * SECONDS_PER_HOUR);

        if (position.positionDirection == 0) {
            liquidationPrice = LEVERAGE_ACCURACY * position.entryPrice / position.leverageMultiplier
                * (position.leverageMultiplier - LEVERAGE_ACCURACY) * 1e4
                + (interestFeeAmount * LEVERAGE_ACCURACY) / position.leverageMultiplier;
            return (liquidationPrice, interestFeeAmount);
        }

        if (position.positionDirection == 1) {
            liquidationPrice = LEVERAGE_ACCURACY * position.entryPrice / position.leverageMultiplier
                * (position.leverageMultiplier + LEVERAGE_ACCURACY) * 1e4
                - (interestFeeAmount * LEVERAGE_ACCURACY) / position.leverageMultiplier;
            return (liquidationPrice, interestFeeAmount);
        }
    }

    function getTotalLongAmount(uint256 pairId) external view returns (int256) {
        return assetPairData[pairId].totalLongPositions;
    }

    function getTotalShortAmount(uint256 pairId) external view returns (int256) {
        return assetPairData[pairId].totalShortPositions;
    }

    function getAssetPairSymbols() external view returns (string[] memory) {
        string[] memory pairSymbols = new string[](availableAssetPairsCount);
        for (uint256 i = 0; i < availableAssetPairsCount; i++) {
            pairSymbols[i] = (assetPairData[i].tradingSymbol);
        }
        return pairSymbols;
    }

    function getPriceOracleAddress() external view returns (address) {
        return address(priceOracle);
    }

    function getCollateralTokenAddress() external view returns (address) {
        return collateralTokenAddress;
    }

    function getBaseInterestRate() external view returns (int256 baseRate) {
        baseRate = baseInterestRate;
    }

    function getBaseExecutionReward() external view returns (int256 baseReward) {
        baseReward = baseExecutionReward;
    }

    function getExecutionRewardRate() external view returns (int256 rewardRate) {
        rewardRate = executionRewardRate;
    }

    function getCurrentInterestRate(uint256 pairId) external view returns (int256) {
        TradingPair memory pair = assetPairData[pairId];

        uint256 arrayLength = pair.interestRates.length;

        if (arrayLength == 0) {
            return baseInterestRate;
        } else {
            return (pair.interestRates[arrayLength - 1]);
        }
    }
}
