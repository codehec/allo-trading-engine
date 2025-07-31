import { expect } from "chai";
import { ethers } from "hardhat";
import { TradingEngine, MockERC20, MockPriceOracle } from "../typechain-types";

describe("TradingEngine", function () {
  let tradingEngine: TradingEngine;
  let mockBaseToken: MockERC20;
  let mockQuoteToken: MockERC20;
  let mockPriceOracle: MockPriceOracle;
  let owner: any;
  let trader1: any;
  let trader2: any;
  let trader3: any;

  const INITIAL_SUPPLY = ethers.parseEther("100000000");
  const MIN_ORDER_AMOUNT = ethers.parseEther("1");
  const MAX_ORDER_AMOUNT = ethers.parseEther("100000");
  const ORACLE_PRICE = 150;

  beforeEach(async function () {
    [owner, trader1, trader2, trader3] = await ethers.getSigners();
    
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockBaseToken = await MockERC20Factory.deploy("Base Token", "BASE", INITIAL_SUPPLY);
    mockQuoteToken = await MockERC20Factory.deploy("Quote Token", "QUOTE", INITIAL_SUPPLY);
    
    const MockPriceOracleFactory = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracleFactory.deploy();
    
    const TradingEngineFactory = await ethers.getContractFactory("TradingEngine");
    tradingEngine = await TradingEngineFactory.deploy();
    
    await tradingEngine.initialize(
      await mockPriceOracle.getAddress(),
      MIN_ORDER_AMOUNT,
      MAX_ORDER_AMOUNT
    );
    
    await mockPriceOracle.setPrice(
      await mockBaseToken.getAddress(),
      await mockQuoteToken.getAddress(),
      ORACLE_PRICE
    );
    
    await mockBaseToken.transfer(trader1.address, ethers.parseEther("10000"));
    await mockBaseToken.transfer(trader2.address, ethers.parseEther("10000"));
    await mockBaseToken.transfer(trader3.address, ethers.parseEther("10000"));
    
    await mockQuoteToken.transfer(trader1.address, ethers.parseEther("20000000"));
    await mockQuoteToken.transfer(trader2.address, ethers.parseEther("20000000"));
    await mockQuoteToken.transfer(trader3.address, ethers.parseEther("20000000"));
    
    await mockBaseToken.connect(trader1).approve(await tradingEngine.getAddress(), ethers.parseEther("10000"));
    await mockBaseToken.connect(trader2).approve(await tradingEngine.getAddress(), ethers.parseEther("10000"));
    await mockBaseToken.connect(trader3).approve(await tradingEngine.getAddress(), ethers.parseEther("10000"));
    
    await mockQuoteToken.connect(trader1).approve(await tradingEngine.getAddress(), ethers.parseEther("20000000"));
    await mockQuoteToken.connect(trader2).approve(await tradingEngine.getAddress(), ethers.parseEther("20000000"));
    await mockQuoteToken.connect(trader3).approve(await tradingEngine.getAddress(), ethers.parseEther("20000000"));
  });

  describe("Deployment and Initialization", function () {
    it("Should set the right owner", async function () {
      expect(await tradingEngine.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await tradingEngine.MIN_ORDER_AMOUNT()).to.equal(MIN_ORDER_AMOUNT);
      expect(await tradingEngine.MAX_ORDER_AMOUNT()).to.equal(MAX_ORDER_AMOUNT);
    });

    it("Should set the correct price oracle", async function () {
      expect(await tradingEngine.priceOracle()).to.equal(await mockPriceOracle.getAddress());
    });
  });

  describe("Token Pair Validation", function () {
    it("Should validate supported token pairs", async function () {
      const isValid = await tradingEngine.isOracleValid(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress()
      );
      expect(isValid).to.be.true;
    });

    it("Should reject invalid token pairs", async function () {
      const invalidToken = ethers.Wallet.createRandom().address;
      const isValid = await tradingEngine.isOracleValid(
        invalidToken,
        await mockQuoteToken.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it("Should reject orders with invalid token addresses", async function () {
      const zeroAddress = ethers.ZeroAddress;
      
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          zeroAddress,
          await mockQuoteToken.getAddress(),
          ethers.parseEther("10"),
          true
        )
      ).to.be.revertedWith("Invalid token addresses");
    });

    it("Should reject orders with same base and quote tokens", async function () {
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockBaseToken.getAddress(),
          ethers.parseEther("10"),
          true
        )
      ).to.be.revertedWith("Base and quote tokens must be different");
    });
  });

  describe("Market Orders", function () {
    it("Should place a buy market order", async function () {
      const amount = ethers.parseEther("10");
      const isBuy = true;

      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          isBuy
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader1.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), amount, 0, isBuy, true);

      const [trader, baseToken, quoteToken, orderAmount, price, isBuyOrder, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader1.address);
      expect(baseToken).to.equal(await mockBaseToken.getAddress());
      expect(quoteToken).to.equal(await mockQuoteToken.getAddress());
      expect(orderAmount).to.equal(amount);
      expect(price).to.equal(0);
      expect(isBuyOrder).to.equal(isBuy);
      expect(isActive).to.equal(true);
      expect(quoteAmount).to.equal(amount * BigInt(ORACLE_PRICE));
    });

    it("Should place a sell market order", async function () {
      const amount = ethers.parseEther("5");
      const isBuy = false;

      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          isBuy
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader2.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), amount, 0, isBuy, true);

      const [trader, baseToken, quoteToken, orderAmount, price, isBuyOrder, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader2.address);
      expect(baseToken).to.equal(await mockBaseToken.getAddress());
      expect(quoteToken).to.equal(await mockQuoteToken.getAddress());
      expect(orderAmount).to.equal(amount);
      expect(price).to.equal(0);
      expect(isBuyOrder).to.equal(isBuy);
      expect(isActive).to.equal(true);
      expect(quoteAmount).to.equal(0); 
    });

    it("Should reject orders with amount too small", async function () {
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          ethers.parseEther("0.5"),
          true
        )
      ).to.be.revertedWith("Amount too small");
    });

    it("Should reject orders with amount too large", async function () {
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          ethers.parseEther("200000"),
          true
        )
      ).to.be.revertedWith("Amount too large");
    });

    it("Should transfer funds on order placement", async function () {
      const amount = ethers.parseEther("10");
      const initialBalance = await mockQuoteToken.balanceOf(trader1.address);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      const finalBalance = await mockQuoteToken.balanceOf(trader1.address);
      const expectedCost = amount * BigInt(ORACLE_PRICE);
      
      expect(initialBalance - finalBalance).to.equal(expectedCost);
    });
  });

  describe("Limit Orders", function () {
    it("Should place a buy limit order", async function () {
      const amount = ethers.parseEther("10");
      const price = 160;
      const isBuy = true;

      await expect(
        tradingEngine.connect(trader1).placeLimitOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          price,
          isBuy
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader1.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), amount, price, isBuy, false);

      const [trader, baseToken, quoteToken, orderAmount, orderPrice, isBuyOrder, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader1.address);
      expect(baseToken).to.equal(await mockBaseToken.getAddress());
      expect(quoteToken).to.equal(await mockQuoteToken.getAddress());
      expect(orderAmount).to.equal(amount);
      expect(orderPrice).to.equal(price);
      expect(isBuyOrder).to.equal(isBuy);
      expect(isActive).to.equal(true);
      expect(quoteAmount).to.equal(amount * BigInt(price));
    });

    it("Should place a sell limit order", async function () {
      const amount = ethers.parseEther("5");
      const price = 140;
      const isBuy = false;

      await expect(
        tradingEngine.connect(trader2).placeLimitOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          price,
          isBuy
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader2.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), amount, price, isBuy, false);

      const [trader, baseToken, quoteToken, orderAmount, orderPrice, isBuyOrder, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader2.address);
      expect(baseToken).to.equal(await mockBaseToken.getAddress());
      expect(quoteToken).to.equal(await mockQuoteToken.getAddress());
      expect(orderAmount).to.equal(amount);
      expect(orderPrice).to.equal(price);
      expect(isBuyOrder).to.equal(isBuy);
      expect(isActive).to.equal(true);
      expect(quoteAmount).to.equal(0); 
    });

    it("Should reject limit orders with zero price", async function () {
      await expect(
        tradingEngine.connect(trader1).placeLimitOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          ethers.parseEther("10"),
          0,
          true
        )
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should transfer funds on limit order placement", async function () {
      const amount = ethers.parseEther("10");
      const price = 160;
      const initialBalance = await mockQuoteToken.balanceOf(trader1.address);
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        price,
        true
      );
      
      const finalBalance = await mockQuoteToken.balanceOf(trader1.address);
      const expectedCost = amount * BigInt(price);
      
      expect(initialBalance - finalBalance).to.equal(expectedCost);
    });
  });

  describe("Order Matching", function () {
    it("Should match buy and sell market orders", async function () {
      const amount = ethers.parseEther("10");
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        false
      );
      
      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          true
        )
      )
        .to.emit(tradingEngine, "OrderMatched")
        .withArgs(1, 0, amount, BigInt(ORACLE_PRICE), BigInt(ORACLE_PRICE) * amount * BigInt(5) / BigInt(10000));

      const [, , , buyOrderAmount, , , , , buyOrderIsActive] = await tradingEngine.getOrder(1);
      const [, , , sellOrderAmount, , , , , sellOrderIsActive] = await tradingEngine.getOrder(0);
      
      expect(buyOrderAmount).to.equal(0);
      expect(sellOrderAmount).to.equal(0);
      expect(buyOrderIsActive).to.equal(false);
      expect(sellOrderIsActive).to.equal(false);
    });

    it("Should match limit orders with market orders", async function () {
      const amount = ethers.parseEther("10");
      const limitPrice = 160;
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        limitPrice,
        false
      );
      
      const requiredQuoteAmount = amount * BigInt(limitPrice);

      await mockQuoteToken.transfer(trader2.address, requiredQuoteAmount);
      await mockQuoteToken.connect(trader2).approve(await tradingEngine.getAddress(), requiredQuoteAmount);
      
      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          true
        )
      )
        .to.emit(tradingEngine, "OrderMatched")
        .withArgs(1, 0, amount, BigInt(limitPrice), BigInt(limitPrice) * amount * BigInt(5) / BigInt(10000));

      const [, , , buyOrderAmount, , , , , buyOrderIsActive] = await tradingEngine.getOrder(1);
      const [, , , sellOrderAmount, , , , , sellOrderIsActive] = await tradingEngine.getOrder(0);
      
      expect(buyOrderAmount).to.equal(0);
      expect(sellOrderAmount).to.equal(0);
      expect(buyOrderIsActive).to.equal(false);
      expect(sellOrderIsActive).to.equal(false);
      
      const trader1QuoteBalance = await mockQuoteToken.balanceOf(trader1.address);
      const trader2BaseBalance = await mockBaseToken.balanceOf(trader2.address);
      
      expect(trader1QuoteBalance).to.be.gt(ethers.parseEther("100000"));
      expect(trader2BaseBalance).to.be.gt(ethers.parseEther("10000"));
    });
  });

  describe("Fee Collection", function () {
    it("Should collect 0.05% fee on trades", async function () {
      const amount = ethers.parseEther("100");
      const price = 150;
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        price,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      const totalValue = amount * BigInt(price);
      const expectedFee = totalValue * BigInt(5) / BigInt(10000);
      
      const feeBalance = await tradingEngine.getFeeBalance(await mockQuoteToken.getAddress());
      expect(feeBalance).to.equal(expectedFee);
    });

    it("Should emit FeeCollected event", async function () {
      const amount = ethers.parseEther("100");
      const price = 150;
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        price,
        false
      );
      
      const totalValue = amount * BigInt(price);
      const expectedFee = totalValue * BigInt(5) / BigInt(10000);
      
      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          amount,
          true
        )
      )
        .to.emit(tradingEngine, "FeeCollected")
        .withArgs(expectedFee, await mockQuoteToken.getAddress());
    });

    it("Should allow owner to withdraw fees", async function () {
      const amount = ethers.parseEther("100");
      const price = 150;
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        price,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      const feeBalance = await tradingEngine.getFeeBalance(await mockQuoteToken.getAddress());
      const initialOwnerBalance = await mockQuoteToken.balanceOf(owner.address);
      
      await tradingEngine.withdrawFees(await mockQuoteToken.getAddress(), feeBalance);
      
      const finalOwnerBalance = await mockQuoteToken.balanceOf(owner.address);
      expect(finalOwnerBalance - initialOwnerBalance).to.equal(feeBalance);
    });
  });

  describe("Order Cancellation", function () {
    it("Should cancel an order and refund funds", async function () {
      const amount = ethers.parseEther("10");
      const initialBalance = await mockQuoteToken.balanceOf(trader1.address);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      await expect(tradingEngine.connect(trader1).cancelOrder(0))
        .to.emit(tradingEngine, "OrderCancelled")
        .withArgs(0);

      const [, , , , , , , , isActive] = await tradingEngine.getOrder(0);
      expect(isActive).to.equal(false);
      
      const finalBalance = await mockQuoteToken.balanceOf(trader1.address);
      expect(finalBalance).to.equal(initialBalance);
    });

    it("Should not allow cancelling someone else's order", async function () {
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        ethers.parseEther("10"),
        true
      );
      
      await expect(
        tradingEngine.connect(trader2).cancelOrder(0)
      ).to.be.revertedWith("Order not found or not yours");
    });

    it("Should not allow cancelling an already cancelled order", async function () {
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        ethers.parseEther("10"),
        true
      );
      
      await tradingEngine.connect(trader1).cancelOrder(0);
      
      await expect(
        tradingEngine.connect(trader1).cancelOrder(0)
      ).to.be.revertedWith("Order already inactive");
    });
  });

  describe("Balance Management", function () {
    it("Should track user balances correctly", async function () {
      const amount = ethers.parseEther("10");
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      const trader1QuoteBalance = await mockQuoteToken.balanceOf(trader1.address);
      expect(trader1QuoteBalance).to.be.gt(ethers.parseEther("100000") - amount * BigInt(ORACLE_PRICE)); 
      
      const trader2BaseBalance = await mockBaseToken.balanceOf(trader2.address);
      expect(trader2BaseBalance).to.be.gt(ethers.parseEther("10000")); 
    });

    it("Should allow users to withdraw their balances", async function () {
      const amount = ethers.parseEther("10");
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        amount,
        true
      );
      
      const balance = await tradingEngine.getUserBalance(trader1.address, await mockQuoteToken.getAddress());
      const initialBalance = await mockQuoteToken.balanceOf(trader1.address);
      
      await tradingEngine.connect(trader1).withdrawBalance(await mockQuoteToken.getAddress(), balance);
      
      const finalBalance = await mockQuoteToken.balanceOf(trader1.address);
      expect(finalBalance - initialBalance).to.equal(balance);
    });
  });

  describe("Oracle Integration", function () {
    it("Should get correct oracle price", async function () {
      const price = await tradingEngine.getOraclePrice(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress()
      );
      expect(price).to.equal(ORACLE_PRICE);
    });

    it("Should handle oracle failures gracefully", async function () {
      await mockPriceOracle.setPriceFeedValid(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        false
      );
      
      const price = await tradingEngine.getOraclePrice(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress()
      );
      expect(price).to.equal(100);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle orders with minimum amounts", async function () {
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          MIN_ORDER_AMOUNT,
          true
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader1.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), MIN_ORDER_AMOUNT, 0, true, true);
    });

    it("Should handle orders with maximum amounts", async function () {
      const requiredAmount = MAX_ORDER_AMOUNT * BigInt(ORACLE_PRICE);
      await mockQuoteToken.transfer(trader1.address, requiredAmount);
      await mockQuoteToken.connect(trader1).approve(await tradingEngine.getAddress(), requiredAmount);
      
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          await mockBaseToken.getAddress(),
          await mockQuoteToken.getAddress(),
          MAX_ORDER_AMOUNT,
          true
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader1.address, await mockBaseToken.getAddress(), await mockQuoteToken.getAddress(), MAX_ORDER_AMOUNT, 0, true, true);
    });

    it("Should handle multiple orders from same trader", async function () {
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        ethers.parseEther("10"),
        true
      );
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        ethers.parseEther("5"),
        false
      );
      
      await tradingEngine.connect(trader1).placeLimitOrder(
        await mockBaseToken.getAddress(),
        await mockQuoteToken.getAddress(),
        ethers.parseEther("3"),
        160,
        true
      );
      
      const stats = await tradingEngine.getOrderBookStats();
      expect(stats.totalBuyOrders).to.equal(2);
      expect(stats.totalSellOrders).to.equal(1);
    });
  });
}); 