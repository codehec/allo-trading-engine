// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library ErrorLibrary {
    error InvalidAmount();
    error InvalidAddress();
    error InsufficientBalance();
    error TransferFailed();
    error CallFailed();
    error ReentrancyGuardReentrantCall();
    error CallerNotOwner();
    error ContractPaused();
    error TokenNotWhitelisted();
    error PriceOracleExpired();
    error PriceOracleInvalid();
    error TokenNotInPriceOracle();
    error SwapFailed();
    error InvalidSlippage();
    error OrderNotFound();
    error OrderNotActive();
    error OrderNotYours();
    error InvalidPrice();
    error TradingPairNotAllowed();
    error AmountTooSmall();
    error AmountTooLarge();
}
