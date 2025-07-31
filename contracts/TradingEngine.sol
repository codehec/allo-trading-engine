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
    }
    
    struct OrderBook {
        mapping(uint256 => Order) orders;
        uint256[] buyOrderIds;
        uint256[] sellOrderIds;
        uint256 nextOrderId;
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
        
        orderId = orderBook.nextOrderId++;
        
        uint256 quoteAmount = 0;
        if (isBuy) {
            uint256 marketPrice = _getLatestMarketPrice(baseToken, quoteToken, isBuy);
            quoteAmount = amount * marketPrice;
        }
        
        Order memory newOrder = Order({
            trader: msg.sender,
            baseToken: baseToken,
            quoteToken: quoteToken,
            amount: amount,
            price: 0,
            isBuy: isBuy,
            isMarketOrder: true,
            timestamp: block.timestamp,
            isActive: true,
            quoteAmount: quoteAmount
        });
        
        orderBook.orders[orderId] = newOrder;
        userOrders[msg.sender][orderId] = true;
        
        if (isBuy) {
            _transferFromUser(msg.sender, quoteToken, quoteAmount);
            orderBook.buyOrderIds.push(orderId);
        } else {
            _transferFromUser(msg.sender, baseToken, amount);
            orderBook.sellOrderIds.push(orderId);
        }
        
        emit OrderPlaced(orderId, msg.sender, baseToken, quoteToken, amount, 0, isBuy, true);
        
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
        
        uint256 quoteAmount = 0;
        if (isBuy) {
            quoteAmount = amount * price;
        }
        
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
            quoteAmount: quoteAmount
        });
        
        orderBook.orders[orderId] = newOrder;
        userOrders[msg.sender][orderId] = true;
        
        if (isBuy) {
            _transferFromUser(msg.sender, quoteToken, quoteAmount);
            orderBook.buyOrderIds.push(orderId);
        } else {
            _transferFromUser(msg.sender, baseToken, amount);
            orderBook.sellOrderIds.push(orderId);
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
            _transferToUser(msg.sender, order.quoteToken, order.quoteAmount);
        } else {
            _transferToUser(msg.sender, order.baseToken, order.amount);
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
        uint256 quoteAmount
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
            order.quoteAmount
        );
    }

    function getActiveBuyOrders() external view returns (uint256[] memory) {
        return _getActiveBuyOrders();
    }

    function _getActiveBuyOrders() internal view returns (uint256[] memory) {
        uint256[] memory activeOrders = new uint256[](orderBook.buyOrderIds.length);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < orderBook.buyOrderIds.length; i++) {
            uint256 orderId = orderBook.buyOrderIds[i];
            if (orderBook.orders[orderId].isActive) {
                activeOrders[activeCount] = orderId;
                activeCount++;
            }
        }
        
        assembly {
            mstore(activeOrders, activeCount)
        }
        
        return activeOrders;
    }

    function getActiveSellOrders() external view returns (uint256[] memory) {
        return _getActiveSellOrders();
    }

    function _getActiveSellOrders() internal view returns (uint256[] memory) {
        uint256[] memory activeOrders = new uint256[](orderBook.sellOrderIds.length);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < orderBook.sellOrderIds.length; i++) {
            uint256 orderId = orderBook.sellOrderIds[i];
            if (orderBook.orders[orderId].isActive) {
                activeOrders[activeCount] = orderId;
                activeCount++;
            }
        }
        
        assembly {
            mstore(activeOrders, activeCount)
        }
        
        return activeOrders;
    }

    function _getLatestMarketPrice(address baseToken, address quoteToken, bool isBuy) internal view returns (uint256) {
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
        
        uint256 buyIndex = 0;
        uint256 sellIndex = 0;
        
        while (buyIndex < buyOrders.length && sellIndex < sellOrders.length) {
            uint256 buyOrderId = buyOrders[buyIndex];
            uint256 sellOrderId = sellOrders[sellIndex];
            
            Order storage buyOrder = orderBook.orders[buyOrderId];
            Order storage sellOrder = orderBook.orders[sellOrderId];
            
            if (buyOrder.baseToken != sellOrder.baseToken || buyOrder.quoteToken != sellOrder.quoteToken) {
                buyIndex++;
                continue;
            }
            
            uint256 matchAmount = buyOrder.amount < sellOrder.amount ? 
                buyOrder.amount : sellOrder.amount;
            
            uint256 matchPrice = _calculateMatchPrice(buyOrder, sellOrder);
            
            _executeTrade(buyOrderId, sellOrderId, matchAmount, matchPrice);
            
            buyOrder.amount -= matchAmount;
            sellOrder.amount -= matchAmount;
            
            if (buyOrder.amount == 0) {
                buyOrder.isActive = false;
                buyIndex++;
            }
            if (sellOrder.amount == 0) {
                sellOrder.isActive = false;
                sellIndex++;
            }
        }
    }
    
    function _calculateMatchPrice(Order storage buyOrder, Order storage sellOrder) internal view returns (uint256) {
        if (!buyOrder.isMarketOrder && !sellOrder.isMarketOrder) {
            return (buyOrder.price + sellOrder.price) / 2;
        }
        
        if (buyOrder.isMarketOrder && sellOrder.isMarketOrder) {
            return _getOraclePrice(buyOrder.baseToken, buyOrder.quoteToken);
        }
        
        if (buyOrder.isMarketOrder) {
            return sellOrder.price;
        } else {
            return buyOrder.price;
        }
    }
    
    function _getOraclePrice(address baseToken, address quoteToken) internal view returns (uint256) {
        if (address(priceOracle) == address(0)) {
            return 100;
        }
        
        try priceOracle.isPriceFeedValid(baseToken, quoteToken) returns (bool isValid) {
            if (!isValid) {
                return 100;
            }
        } catch {
            return 100;
        }
        
        try priceOracle.getPrice(baseToken, quoteToken) returns (int256 price) {
            if (price <= 0) {
                return 100;
            }
            return uint256(price);
        } catch {
            return 100;
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
        
        uint256 totalValue = amount * price;
        
        uint256 fee = (totalValue * FEE_RATE) / FEE_DENOMINATOR;
        uint256 netValue = totalValue - fee;

        require(balances[address(this)][buyOrder.baseToken] >= amount, "Insufficient contract base token balance");
        require(balances[address(this)][sellOrder.quoteToken] >= netValue, "Insufficient contract quote token balance");
        
        _transferToUser(buyOrder.trader, buyOrder.baseToken, amount);
        _transferToUser(sellOrder.trader, sellOrder.quoteToken, netValue);
        
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
        totalBuyOrders = orderBook.buyOrderIds.length;
        totalSellOrders = orderBook.sellOrderIds.length;
        
        uint256 activeBuy = 0;
        uint256 activeSell = 0;
        
        for (uint256 i = 0; i < orderBook.buyOrderIds.length; i++) {
            uint256 orderId = orderBook.buyOrderIds[i];
            if (orderBook.orders[orderId].isActive) {
                activeBuy++;
            }
        }
        
        for (uint256 i = 0; i < orderBook.sellOrderIds.length; i++) {
            uint256 orderId = orderBook.sellOrderIds[i];
            if (orderBook.orders[orderId].isActive) {
                activeSell++;
            }
        }
        
        activeBuyOrders = activeBuy;
        activeSellOrders = activeSell;
        
        return (totalBuyOrders, totalSellOrders, activeBuyOrders, activeSellOrders);
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