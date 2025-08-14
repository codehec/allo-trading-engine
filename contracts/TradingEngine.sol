// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TradingEngine is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    
    struct Order {
        address trader;
        address baseToken;
        address quoteToken;
        uint256 amount;
        uint256 price;
        bool isBuy;
        bool isMarketOrder;
        uint256 timestamp;
        bool isActive;
        uint256 quoteAmount;
        uint256 filledAmount;
    }
    
    struct OrderBook {
        mapping(uint256 => Order) orders;
        mapping(uint256 => bool) activeBuyOrders;
        mapping(uint256 => bool) activeSellOrders;
        uint256 nextOrderId;
        uint256 activeBuyOrderCount;
        uint256 activeSellOrderCount;
        uint256 totalBuyOrderCount;
        uint256 totalSellOrderCount;
    }
    
    event OrderPlaced(uint256 orderId, address trader, address baseToken, address quoteToken, uint256 amount, uint256 price, bool isBuy, bool isMarketOrder);
    event OrderMatched(uint256 buyOrderId, uint256 sellOrderId, uint256 amount, uint256 price, uint256 fee);
    event OrderCancelled(uint256 orderId);
    event PriceOracleUpdated(address oldOracle, address newOracle);
    event TradingPairAllowed(address baseToken, address quoteToken, bool allowed);
    event FeeCollected(uint256 amount, address token);
    
    OrderBook public orderBook;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(uint256 => bool)) public userOrders;
    mapping(address => mapping(address => bool)) public allowedTradingPairs;
    
    uint256 public MIN_ORDER_AMOUNT;
    uint256 public MAX_ORDER_AMOUNT;
    uint256 public constant FEE_RATE = 5;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    IPriceOracle public priceOracle;
    
    function initialize(address _priceOracle, uint256 _minOrderAmount, uint256 _maxOrderAmount) external initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        priceOracle = IPriceOracle(_priceOracle);
        MIN_ORDER_AMOUNT = _minOrderAmount;
        MAX_ORDER_AMOUNT = _maxOrderAmount;
    }
    
    function updatePriceOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        address oldOracle = address(priceOracle);
        priceOracle = IPriceOracle(_newOracle);
        emit PriceOracleUpdated(oldOracle, _newOracle);
    }

    function setTradingPairAllowed(address _baseToken, address _quoteToken, bool _allowed) external onlyOwner {
        allowedTradingPairs[_baseToken][_quoteToken] = _allowed;
        emit TradingPairAllowed(_baseToken, _quoteToken, _allowed);
    }

    function isTradingPairAllowed(address _baseToken, address _quoteToken) external view returns (bool) {
        return allowedTradingPairs[_baseToken][_quoteToken];
    }

    function placeMarketOrder(
        address baseToken, 
        address quoteToken, 
        uint256 amount, 
        bool isBuy
    ) 
        external 
        nonReentrant 
        returns (uint256 orderId) 
    {
        require(amount >= MIN_ORDER_AMOUNT, "Amount too small");
        require(amount <= MAX_ORDER_AMOUNT, "Amount too large");
        require(baseToken != address(0) && quoteToken != address(0), "Invalid token addresses");
        require(baseToken != quoteToken, "Base and quote tokens must be different");
        
        require(_isTokenPairValid(baseToken, quoteToken), "Token pair not supported by oracle");
        
        uint256 marketPrice = _getMarketPrice(baseToken, quoteToken, isBuy);
        require(marketPrice > 0, "Oracle price not available");
        
        orderId = orderBook.nextOrderId++;
        
        uint256 quoteAmount = amount * marketPrice / 10**18;
        
        Order memory newOrder = Order({
            trader: msg.sender,
            baseToken: baseToken,
            quoteToken: quoteToken,
            amount: amount,
            price: marketPrice,
            isBuy: isBuy,
            isMarketOrder: true,
            timestamp: block.timestamp,
            isActive: true,
            quoteAmount: quoteAmount,
            filledAmount: 0
        });
        
        orderBook.orders[orderId] = newOrder;
        userOrders[msg.sender][orderId] = true;
        
        if (isBuy) {
            _transferFromUser(msg.sender, quoteToken, quoteAmount);
            orderBook.activeBuyOrders[orderId] = true;
            orderBook.activeBuyOrderCount++;
            orderBook.totalBuyOrderCount++;
        } else {
            _transferFromUser(msg.sender, baseToken, amount);
            orderBook.activeSellOrders[orderId] = true;
            orderBook.activeSellOrderCount++;
            orderBook.totalSellOrderCount++;
        }
        
        emit OrderPlaced(orderId, msg.sender, baseToken, quoteToken, amount, marketPrice, isBuy, true);
        
        _matchOrders();
        
        return orderId;
    }

    function placeLimitOrder(
        address baseToken, 
        address quoteToken, 
        uint256 amount, 
        uint256 price, 
        bool isBuy
    ) 
        external 
        nonReentrant 
        returns (uint256 orderId) 
    {
        require(amount >= MIN_ORDER_AMOUNT, "Amount too small");
        require(amount <= MAX_ORDER_AMOUNT, "Amount too large");
        require(price > 0, "Price must be greater than 0");
        require(baseToken != address(0) && quoteToken != address(0), "Invalid token addresses");
        require(baseToken != quoteToken, "Base and quote tokens must be different");
        
        require(_isTokenPairValid(baseToken, quoteToken), "Token pair not supported by oracle");
        
        orderId = orderBook.nextOrderId++;
        
        uint256 quoteAmount = amount * price / 10**18;
        
        Order memory newOrder = Order({
            trader: msg.sender,
            baseToken: baseToken,
            quoteToken: quoteToken,
            amount: amount,
            price: price,
            isBuy: isBuy,
            isMarketOrder: false,
            timestamp: block.timestamp,
            isActive: true,
            quoteAmount: quoteAmount,
            filledAmount: 0
        });
        
        orderBook.orders[orderId] = newOrder;
        userOrders[msg.sender][orderId] = true;
        
        if (isBuy) {
            _transferFromUser(msg.sender, quoteToken, quoteAmount);
            orderBook.activeBuyOrders[orderId] = true;
            orderBook.activeBuyOrderCount++;
            orderBook.totalBuyOrderCount++;
        } else {
            _transferFromUser(msg.sender, baseToken, amount);
            orderBook.activeSellOrders[orderId] = true;
            orderBook.activeSellOrderCount++;
            orderBook.totalSellOrderCount++;
        }
        
        emit OrderPlaced(orderId, msg.sender, baseToken, quoteToken, amount, price, isBuy, false);
        
        _matchOrders();
        
        return orderId;
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        require(userOrders[msg.sender][orderId], "Order not found or not yours");
        require(orderBook.orders[orderId].isActive, "Order already inactive");
        
        Order storage order = orderBook.orders[orderId];
        order.isActive = false;
        
        if (order.isBuy) {
            if (orderBook.activeBuyOrders[orderId]) {
                orderBook.activeBuyOrders[orderId] = false;
                orderBook.activeBuyOrderCount--;
            }
        } else {
            if (orderBook.activeSellOrders[orderId]) {
                orderBook.activeSellOrders[orderId] = false;
                orderBook.activeSellOrderCount--;
            }
        }
        
        uint256 remainingAmount = order.amount - order.filledAmount;
        uint256 remainingQuoteAmount = order.quoteAmount - (order.filledAmount * order.price);
        
        if (order.isBuy) {
            if (remainingQuoteAmount > 0) {
                _transferToUser(msg.sender, order.quoteToken, remainingQuoteAmount);
            }
        } else {
            if (remainingAmount > 0) {
                _transferToUser(msg.sender, order.baseToken, remainingAmount);
            }
        }
        
        emit OrderCancelled(orderId);
    }
    
    function withdrawBalance(address token, uint256 amount) external nonReentrant {
        require(balances[msg.sender][token] >= amount, "Insufficient balance");
        balances[msg.sender][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
    }

    function getOrder(uint256 orderId) external view returns (
        address trader,
        address baseToken,
        address quoteToken,
        uint256 amount,
        uint256 price,
        bool isBuy,
        bool isMarketOrder,
        uint256 timestamp,
        bool isActive,
        uint256 quoteAmount,
        uint256 filledAmount
    ) {
        Order memory order = orderBook.orders[orderId];
        return (
            order.trader,
            order.baseToken,
            order.quoteToken,
            order.amount,
            order.price,
            order.isBuy,
            order.isMarketOrder,
            order.timestamp,
            order.isActive,
            order.quoteAmount,
            order.filledAmount
        );
    }

    function getActiveBuyOrders() external view returns (uint256[] memory) {
        return _getActiveBuyOrders();
    }

    function _getActiveBuyOrders() internal view returns (uint256[] memory) {
        uint256[] memory tempOrders = new uint256[](orderBook.activeBuyOrderCount);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < orderBook.nextOrderId && activeCount < orderBook.activeBuyOrderCount; i++) {
            if (orderBook.activeBuyOrders[i] && orderBook.orders[i].isActive) {
                tempOrders[activeCount] = i;
                activeCount++;
            }
        }
        
        uint256[] memory activeOrders = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeOrders[i] = tempOrders[i];
        }
        
        return activeOrders;
    }

    function getActiveSellOrders() external view returns (uint256[] memory) {
        return _getActiveSellOrders();
    }

    function _getActiveSellOrders() internal view returns (uint256[] memory) {
        uint256[] memory tempOrders = new uint256[](orderBook.activeSellOrderCount);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < orderBook.nextOrderId && activeCount < orderBook.activeSellOrderCount; i++) {
            if (orderBook.activeSellOrders[i] && orderBook.orders[i].isActive) {
                tempOrders[activeCount] = i;
                activeCount++;
            }
        }
        
        uint256[] memory activeOrders = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeOrders[i] = tempOrders[i];
        }
        
        return activeOrders;
    }

    function _getMarketPrice(address baseToken, address quoteToken, bool isBuy) internal view returns (uint256) {
        uint256 bestPrice = 0;
        
        if (isBuy) {
            uint256[] memory sellOrders = _getActiveSellOrders();
            for (uint256 i = 0; i < sellOrders.length; i++) {
                Order storage order = orderBook.orders[sellOrders[i]];
                if (order.baseToken == baseToken && order.quoteToken == quoteToken) {
                    if (bestPrice == 0 || order.price < bestPrice) {
                        bestPrice = order.price;
                    }
                }
            }
        } else {
            uint256[] memory buyOrders = _getActiveBuyOrders();
            for (uint256 i = 0; i < buyOrders.length; i++) {
                Order storage order = orderBook.orders[buyOrders[i]];
                if (order.baseToken == baseToken && order.quoteToken == quoteToken) {
                    if (order.price > bestPrice) {
                        bestPrice = order.price;
                    }
                }
            }
        }
        
        if (bestPrice == 0) {
            return _getOraclePrice(baseToken, quoteToken);
        }
        
        return bestPrice;
    }

    function _isTokenPairValid(address baseToken, address quoteToken) internal view returns (bool) {
        if (address(priceOracle) == address(0)) {
            return false;
        }
        
        try priceOracle.isPriceFeedValid(baseToken, quoteToken) returns (bool isValid) {
            return isValid;
        } catch {
            return false;
        }
    }
    
    function _transferFromUser(address user, address token, uint256 amount) internal {
        IERC20(token).transferFrom(user, address(this), amount);
        balances[address(this)][token] += amount;
    }
    
    function _transferToUser(address user, address token, uint256 amount) internal {
        require(balances[address(this)][token] >= amount, "Insufficient contract balance");
        balances[address(this)][token] -= amount;
        IERC20(token).transfer(user, amount);
    }
    
    function _matchOrders() internal {
        uint256[] memory buyOrders = _getActiveBuyOrders();
        uint256[] memory sellOrders = _getActiveSellOrders();
        
        for (uint256 i = 0; i < buyOrders.length; i++) {
            uint256 buyOrderId = buyOrders[i];
            Order storage buyOrder = orderBook.orders[buyOrderId];
            
            if (!buyOrder.isActive || buyOrder.filledAmount >= buyOrder.amount) {
                continue;
            }
            
            uint256 remainingBuyAmount = buyOrder.amount - buyOrder.filledAmount;
            
            for (uint256 j = 0; j < sellOrders.length; j++) {
                uint256 sellOrderId = sellOrders[j];
                Order storage sellOrder = orderBook.orders[sellOrderId];
                
                if (!sellOrder.isActive || sellOrder.filledAmount >= sellOrder.amount) {
                    continue;
                }
                
                if (buyOrder.baseToken != sellOrder.baseToken || buyOrder.quoteToken != sellOrder.quoteToken) {
                    continue;
                }
                
                if (!_canMatch(buyOrder, sellOrder)) {
                    continue;
                }
                
                uint256 remainingSellAmount = sellOrder.amount - sellOrder.filledAmount;
                uint256 matchAmount = remainingBuyAmount < remainingSellAmount ? 
                    remainingBuyAmount : remainingSellAmount;
                
                uint256 matchPrice = _getMatchPrice(buyOrder, sellOrder);
                
                _executeTrade(buyOrderId, sellOrderId, matchAmount, matchPrice);
                
                buyOrder.filledAmount += matchAmount;
                sellOrder.filledAmount += matchAmount;
                
                if (buyOrder.filledAmount >= buyOrder.amount) {
                    buyOrder.isActive = false;
                    orderBook.activeBuyOrders[buyOrderId] = false;
                    orderBook.activeBuyOrderCount--;
                }

                if (sellOrder.filledAmount >= sellOrder.amount) {
                    sellOrder.isActive = false;
                    orderBook.activeSellOrders[sellOrderId] = false;
                    orderBook.activeSellOrderCount--;
                }
                
                remainingBuyAmount = buyOrder.amount - buyOrder.filledAmount;
                remainingSellAmount = sellOrder.amount - sellOrder.filledAmount;
            }
        }
    }
    
    function _canMatch(Order storage buyOrder, Order storage sellOrder) internal view returns (bool) {
        if (buyOrder.isMarketOrder && sellOrder.isMarketOrder) {
            return true;
        }
        
        if (buyOrder.isMarketOrder) {
            return buyOrder.price >= sellOrder.price;
        }
        
        if (sellOrder.isMarketOrder) {
            return buyOrder.price >= sellOrder.price;
        }
        
        return buyOrder.price >= sellOrder.price;
    }
    
    function _getMatchPrice(Order storage buyOrder, Order storage sellOrder) internal view returns (uint256) {
        if (buyOrder.isMarketOrder && sellOrder.isMarketOrder) {
            return _getOraclePrice(buyOrder.baseToken, buyOrder.quoteToken);
        }
        
        if (buyOrder.isMarketOrder) {
            return sellOrder.price;
        }
        
        if (sellOrder.isMarketOrder) {
            return buyOrder.price;
        }
        
        return buyOrder.price;
    }
    
    function _getOraclePrice(address baseToken, address quoteToken) internal view returns (uint256) {
        require(address(priceOracle) != address(0), "Price oracle not set");
        require(_isTokenPairValid(baseToken, quoteToken), "Price feed not valid");
        
        try priceOracle.getPrice(baseToken, quoteToken) returns (int256 price) {
            require(price > 0, "Invalid oracle price");
            return uint256(price);
        } catch {
            revert("Oracle price fetch failed");
        }
    }

    function _executeTrade(
        uint256 buyOrderId, 
        uint256 sellOrderId, 
        uint256 amount, 
        uint256 price
    ) internal {
        Order storage buyOrder = orderBook.orders[buyOrderId];
        Order storage sellOrder = orderBook.orders[sellOrderId];
        
        uint256 totalValue = amount * price / 10**18;
        
        uint256 fee = (totalValue * FEE_RATE) / FEE_DENOMINATOR;
        uint256 netValue = totalValue - fee;

        _transferToUser(buyOrder.trader, buyOrder.baseToken, amount);
        
        _transferToUser(sellOrder.trader, sellOrder.quoteToken, netValue);
        
        balances[buyOrder.trader][buyOrder.baseToken] += amount;
        balances[sellOrder.trader][sellOrder.quoteToken] += netValue;
        
        balances[address(this)][sellOrder.quoteToken] += fee;
        
        emit FeeCollected(fee, sellOrder.quoteToken);
        emit OrderMatched(buyOrderId, sellOrderId, amount, price, fee);
    }

    function getUserBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }
    
    function getContractBalance(address token) external view returns (uint256) {
        return balances[address(this)][token];
    }
    
    function getFeeBalance(address token) external view returns (uint256) {
        return balances[address(this)][token];
    }

    function getOrderBookStats() external view returns (
        uint256 totalBuyOrders,
        uint256 totalSellOrders,
        uint256 activeBuyOrders,
        uint256 activeSellOrders
    ) {
        return (
            orderBook.totalBuyOrderCount,
            orderBook.totalSellOrderCount,
            orderBook.activeBuyOrderCount,
            orderBook.activeSellOrderCount
        );
    }

    function getOraclePrice(address baseToken, address quoteToken) external view returns (uint256) {
        return _getOraclePrice(baseToken, quoteToken);
    }
    
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        require(balances[address(this)][token] >= amount, "Insufficient fee balance");
        balances[address(this)][token] -= amount;
        IERC20(token).transfer(owner(), amount);
    }
    
    function isOracleValid(address baseToken, address quoteToken) external view returns (bool) {
        return _isTokenPairValid(baseToken, quoteToken);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 