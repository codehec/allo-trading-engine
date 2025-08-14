// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    
    mapping(bytes32 => Price) public prices;
    
    function createPriceFeedUpdateData(
        bytes32 priceId,
        int64 price,
        uint64 conf,
        int32 expo,
        int64 emaPrice,
        uint64 emaConf,
        uint64 publishTime
    ) external returns (bytes memory) {
        prices[priceId] = Price(price, conf, expo, publishTime);
        return abi.encode(priceId, price, conf, expo, emaPrice, emaConf, publishTime);
    }
    
    function getPrice(bytes32 priceId) external view returns (Price memory) {
        return prices[priceId];
    }
    
    function getPriceUnsafe(bytes32 priceId) external view returns (Price memory) {
        return prices[priceId];
    }
    
    function getUpdateFee(bytes[] calldata) external pure returns (uint256) {
        return 0.001 ether;
    }
    
    function updatePriceFeeds(bytes[] calldata) external payable {
        // Mock implementation - just accept the fee
    }
}
