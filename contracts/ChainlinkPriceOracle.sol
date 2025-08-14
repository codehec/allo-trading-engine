// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IPriceOracle} from "./IPriceOracle.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function decimals() external view returns (uint8);
}

contract ChainlinkPriceOracle is IPriceOracle, Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    
    struct PriceFeed {
        address aggregator;
        uint8 decimals;
        bool isActive;
        uint256 heartbeat;
        uint256 maxPriceDeviation;
    }
    
    mapping(address => mapping(address => PriceFeed)) public priceFeeds;
    mapping(address => mapping(address => uint256)) public lastPrices;
    mapping(address => mapping(address => uint256)) public lastUpdateTime;
    
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_PRICE_DEVIATION = 50; 
    uint256 public constant DEFAULT_HEARTBEAT = 1 hours;
    
    event PriceFeedAdded(address baseToken, address quoteToken, address aggregator);
    event PriceFeedUpdated(address baseToken, address quoteToken, address aggregator);
    event PriceUpdated(address baseToken, address quoteToken, uint256 price, uint256 timestamp);
    event MaxPriceDeviationUpdated(address baseToken, address quoteToken, uint256 maxDeviation);
    
    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }
    
    function addPriceFeed(
        address baseToken,
        address quoteToken,
        address aggregator,
        uint256 maxPriceDeviation
    ) external onlyOwner {
        require(baseToken != address(0) && quoteToken != address(0), "Invalid tokens");
        require(aggregator != address(0), "Invalid aggregator");
        require(maxPriceDeviation <= MAX_PRICE_DEVIATION, "Deviation too high");
        
        AggregatorV3Interface priceAggregator = AggregatorV3Interface(aggregator);
        uint8 decimals = priceAggregator.decimals();
        
        PriceFeed memory feed = PriceFeed({
            aggregator: aggregator,
            decimals: decimals,
            isActive: true,
            heartbeat: DEFAULT_HEARTBEAT,
            maxPriceDeviation: maxPriceDeviation
        });
        
        priceFeeds[baseToken][quoteToken] = feed;
        
        _updatePrice(baseToken, quoteToken);
        
        emit PriceFeedAdded(baseToken, quoteToken, aggregator);
    }
    
    function updatePriceFeed(
        address baseToken,
        address quoteToken,
        address aggregator,
        uint256 maxPriceDeviation
    ) external onlyOwner {
        PriceFeed storage feed = priceFeeds[baseToken][quoteToken];
        require(feed.aggregator != address(0), "Price feed not found");
        
        if (aggregator != address(0)) {
            AggregatorV3Interface priceAggregator = AggregatorV3Interface(aggregator);
            feed.decimals = priceAggregator.decimals();
            feed.aggregator = aggregator;
        }
        
        if (maxPriceDeviation > 0) {
            require(maxPriceDeviation <= MAX_PRICE_DEVIATION, "Deviation too high");
            feed.maxPriceDeviation = maxPriceDeviation;
        }
        
        emit PriceFeedUpdated(baseToken, quoteToken, aggregator);
    }
    
    function setMaxPriceDeviation(
        address baseToken,
        address quoteToken,
        uint256 maxDeviation
    ) external onlyOwner {
        require(maxDeviation <= MAX_PRICE_DEVIATION, "Deviation too high");
        priceFeeds[baseToken][quoteToken].maxPriceDeviation = maxDeviation;
        emit MaxPriceDeviationUpdated(baseToken, quoteToken, maxDeviation);
    }
    
    function getPrice(address baseToken, address quoteToken) external view override returns (int256) {
        PriceFeed memory feed = priceFeeds[baseToken][quoteToken];
        require(feed.isActive, "Price feed not active");
        
        uint256 price = _fetchPrice(baseToken, quoteToken);
        require(price > 0, "Invalid price");
        
        return int256(price);
    }
    
    function getPriceWithValidation(address baseToken, address quoteToken) external view returns (int256) {
        PriceFeed memory feed = priceFeeds[baseToken][quoteToken];
        require(feed.isActive, "Price feed not active");
        
        uint256 currentPrice = _fetchPrice(baseToken, quoteToken);
        require(currentPrice > 0, "Invalid price");
        
        require(block.timestamp - lastUpdateTime[baseToken][quoteToken] <= feed.heartbeat, "Price too old");
        
        uint256 lastPrice = lastPrices[baseToken][quoteToken];
        if (lastPrice > 0) {
            uint256 deviation = _calculatePriceDeviation(currentPrice, lastPrice);
            require(deviation <= feed.maxPriceDeviation, "Price deviation too high");
        }
        
        return int256(currentPrice);
    }
    
    function updatePrice(address baseToken, address quoteToken) external {
        _updatePrice(baseToken, quoteToken);
    }
    
    function _updatePrice(address baseToken, address quoteToken) internal {
        PriceFeed memory feed = priceFeeds[baseToken][quoteToken];
        require(feed.isActive, "Price feed not active");
        
        uint256 newPrice = _fetchPrice(baseToken, quoteToken);
        require(newPrice > 0, "Invalid price");
        
        uint256 lastPrice = lastPrices[baseToken][quoteToken];
        if (lastPrice > 0) {
            uint256 deviation = _calculatePriceDeviation(newPrice, lastPrice);
            require(deviation <= feed.maxPriceDeviation, "Price deviation too high");
        }
        
        lastPrices[baseToken][quoteToken] = newPrice;
        lastUpdateTime[baseToken][quoteToken] = block.timestamp;
        
        emit PriceUpdated(baseToken, quoteToken, newPrice, block.timestamp);
    }
    
    function _fetchPrice(address baseToken, address quoteToken) internal view returns (uint256) {
        PriceFeed memory feed = priceFeeds[baseToken][quoteToken];
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed.aggregator);
        
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = aggregator.latestRoundData();
        
        require(answer > 0, "Invalid answer");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        
        uint256 price = uint256(answer);
        if (feed.decimals < 18) {
            price = price * (10 ** (18 - feed.decimals));
        } else if (feed.decimals > 18) {
            price = price / (10 ** (feed.decimals - 18));
        }
        
        return price;
    }
    
    function _calculatePriceDeviation(uint256 newPrice, uint256 oldPrice) internal pure returns (uint256) {
        if (oldPrice == 0) return 0;
        
        uint256 difference = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        return (difference * 100) / oldPrice;
    }
    
    function getPriceFeedInfo(address baseToken, address quoteToken) external view returns (
        address aggregator,
        uint8 decimals,
        bool isActive,
        uint256 heartbeat,
        uint256 maxPriceDeviation,
        uint256 lastPrice,
        uint256 lastUpdate
    ) {
        PriceFeed memory feed = priceFeeds[baseToken][quoteToken];
        return (
            feed.aggregator,
            feed.decimals,
            feed.isActive,
            feed.heartbeat,
            feed.maxPriceDeviation,
            lastPrices[baseToken][quoteToken],
            lastUpdateTime[baseToken][quoteToken]
        );
    }
    
    function isPriceFeedActive(address baseToken, address quoteToken) external view returns (bool) {
        return priceFeeds[baseToken][quoteToken].isActive;
    }
    
    function getPriceForTokenAmount(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external view returns (uint256 amountOut) {
        int256 price = this.getPrice(tokenIn, tokenOut);
        return uint256(price) * amount / 1e18;
    }
    
    function decimals(address base, address quote) external view returns (uint8) {
        PriceFeed memory feed = priceFeeds[base][quote];
        return feed.decimals;
    }
    
    function isPriceFeedValid(address base, address quote) external view returns (bool) {
        PriceFeed memory feed = priceFeeds[base][quote];
        if (!feed.isActive) return false;
        
        if (block.timestamp - lastUpdateTime[base][quote] > feed.heartbeat) {
            return false;
        }
        
        return true;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 