// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPriceOracle {
    /**
     * @notice Returns the latest price for a base/quote pair
     * @param base base asset address
     * @param quote quote asset address
     * @return The latest token price of the pair
     */
    function getPrice(address base, address quote) external view returns (int256);

    /**
     * @notice Returns the latest price for a specific amount
     * @param tokenIn token asset address
     * @param tokenOut token asset address
     * @param amount token amount
     * @return amountOut The latest token price of the pair
     */
    function getPriceForTokenAmount(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external view returns (uint256 amountOut);

    /**
     * @notice Returns the decimals of a token pair price feed
     * @param base base asset address
     * @param quote quote asset address
     * @return Decimals of the token pair
     */
    function decimals(address base, address quote) external view returns (uint8);

    /**
     * @notice Check if a price feed is active and not expired
     * @param base base asset address
     * @param quote quote asset address
     * @return True if the price feed is valid
     */
    function isPriceFeedValid(address base, address quote) external view returns (bool);
} 