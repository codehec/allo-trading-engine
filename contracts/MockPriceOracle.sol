// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPriceOracle} from "./IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    mapping(address => mapping(address => int256)) public prices;
    mapping(address => mapping(address => bool)) public priceFeedValid;
    mapping(address => mapping(address => uint8)) public tokenDecimals;
    
    constructor() {}
    
    function setPrice(address base, address quote, int256 price) external {
        prices[base][quote] = price;
        priceFeedValid[base][quote] = true;
        tokenDecimals[base][quote] = 18;
    }
    
    function setPriceFeedValid(address base, address quote, bool valid) external {
        priceFeedValid[base][quote] = valid;
    }
    
    function getPrice(address base, address quote) external view override returns (int256) {
        return prices[base][quote];
    }
    
    function getPriceForTokenAmount(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external view override returns (uint256 amountOut) {
        int256 price = prices[tokenIn][tokenOut];
        if (price <= 0) return 0;
        return uint256(price) * amount / 1e18;
    }
    
    function decimals(address base, address quote) external view override returns (uint8) {
        return tokenDecimals[base][quote];
    }
    
    function isPriceFeedValid(address base, address quote) external view override returns (bool) {
        return priceFeedValid[base][quote];
    }
} 