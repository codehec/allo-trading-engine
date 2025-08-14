import { expect } from "chai";
import { ethers } from "hardhat";
import { TradingEngine, MockERC20, MockPriceOracle } from "../typechain-types";

describe("BSC Network Trading - USDC/aTSLA", function () {
  let tradingEngine: TradingEngine;
  let usdc: MockERC20;
  let atsla: MockERC20;
  let mockPriceOracle: MockPriceOracle;
  let owner: any;
  let user1: any; 
  let user2: any; 
  let whaleAtsla: any;
  let whaleUsdc: any;

  const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const ATSLA_ADDRESS = "0x8Be4948ec40CefaB6F7E4D10beFebCAF5f291316";
  
  const WHALE_ATSLA_ADDRESS = "0xeb7a5de7924946082520fc2b3d953fdf12684804";
  const WHALE_USDC_ADDRESS = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
  
  const WHALE_ATSLA_BALANCE = ethers.parseEther("0.2");
  const WHALE_USDC_BALANCE = ethers.parseEther("1000"); 
  
  const INITIAL_ATSLA_PRICE = 1; 
  const MIN_ORDER_AMOUNT = ethers.parseEther("0.0001"); 
  const MAX_ORDER_AMOUNT = ethers.parseEther("1000"); 
  
  const TEST_ATSLA_AMOUNT = ethers.parseEther("0.01"); 
  const TEST_USDC_AMOUNT = ethers.parseEther("0.00000001"); 

  beforeEach(async function () {
    [owner, user1, user2, whaleAtsla, whaleUsdc] = await ethers.getSigners();
    
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    
    usdc = await MockERC20Factory.deploy("USD Coin", "USDC", ethers.parseEther("1000000"));
    
    atsla = await MockERC20Factory.deploy("Tesla Token", "aTSLA", ethers.parseEther("1000000"));
    
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
      await atsla.getAddress(),
      await usdc.getAddress(),
      ethers.parseEther("1")
    );
    
    await mockPriceOracle.setPrice(
      await usdc.getAddress(),
      await atsla.getAddress(),
      ethers.parseEther("1") / ethers.parseEther(INITIAL_ATSLA_PRICE.toString())
    );
    
    await atsla.transfer(whaleAtsla.address, WHALE_ATSLA_BALANCE);
    
    await usdc.transfer(whaleUsdc.address, WHALE_USDC_BALANCE);
    
    await atsla.connect(whaleAtsla).transfer(user1.address, ethers.parseEther("0.1"));
    
    await usdc.connect(whaleUsdc).transfer(user2.address, ethers.parseEther("100"));
    
    await atsla.connect(user1).approve(await tradingEngine.getAddress(), ethers.parseEther("1"));
    await usdc.connect(user2).approve(await tradingEngine.getAddress(), ethers.parseEther("10000"));
    
    await atsla.connect(whaleAtsla).approve(await tradingEngine.getAddress(), ethers.parseEther("1"));
    await usdc.connect(whaleUsdc).approve(await tradingEngine.getAddress(), ethers.parseEther("10000"));
    
    await tradingEngine.setTradingPairAllowed(await atsla.getAddress(), await usdc.getAddress(), true);
    await tradingEngine.setTradingPairAllowed(await usdc.getAddress(), await atsla.getAddress(), true);
  });

  describe("BSC Network Setup", function () {
    it("Should have correct token addresses", async function () {
      expect(await atsla.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await usdc.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have correct user balances after whale transfer", async function () {
      expect(await atsla.balanceOf(user1.address)).to.equal(ethers.parseEther("0.1"));
      
      expect(await usdc.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should have correct price oracle setup", async function () {
      const price = await tradingEngine.getOraclePrice(await atsla.getAddress(), await usdc.getAddress());
      expect(price).to.equal(ethers.parseEther(INITIAL_ATSLA_PRICE.toString()));
    });
  });

  describe("Limit Order Trading", function () {
    it("Should place a limit buy order for aTSLA at 340.7 USDC", async function () {
      await tradingEngine.connect(user2).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        "340700000000000000000",
        true // isBuy
      );
      
      const orderId = 0;
      const order = await tradingEngine.getOrder(orderId);
      expect(order.trader).to.equal(user2.address);
      expect(order.baseToken).to.equal(await atsla.getAddress());
      expect(order.quoteToken).to.equal(await usdc.getAddress());
      expect(order.amount).to.equal(TEST_ATSLA_AMOUNT);
      expect(order.price).to.equal("340700000000000000000");
      expect(order.isBuy).to.be.true;
      expect(order.isMarketOrder).to.be.false;
      expect(order.isActive).to.be.true;
    });

    it("Should place a limit sell order for aTSLA at 340.7 USDC", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        "340700000000000000000",
        false // isSell
      );
      
      const orderId = 0;
      const order = await tradingEngine.getOrder(orderId);
      expect(order.trader).to.equal(user1.address);
      expect(order.baseToken).to.equal(await atsla.getAddress());
      expect(order.quoteToken).to.equal(await usdc.getAddress());
      expect(order.amount).to.equal(TEST_ATSLA_AMOUNT);
      expect(order.price).to.equal("340700000000000000000");
      expect(order.isBuy).to.be.false;
      expect(order.isMarketOrder).to.be.false;
      expect(order.isActive).to.be.true;
    });

    it("Should match limit buy and sell orders at the same price", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("0.01"),
        "340700000000000000000",
        false // isSell
      );
      
      await tradingEngine.connect(user2).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("0.01"),
       "340700000000000000000",
        true // isBuy
      );
      
      const sellOrder = await tradingEngine.getOrder(0);
      const buyOrder = await tradingEngine.getOrder(1);
      
      expect(sellOrder.filledAmount).to.equal(ethers.parseEther("0.01"));
      expect(buyOrder.filledAmount).to.equal(ethers.parseEther("0.01"));
      expect(sellOrder.isActive).to.be.false;
      expect(buyOrder.isActive).to.be.false;
    });
  });

  describe("Market Order Trading", function () {
    it("Should place a market buy order for aTSLA", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther(INITIAL_ATSLA_PRICE.toString()),
        false // isSell
      );
      
      await usdc.connect(user2).approve(
        tradingEngine.getAddress(),
        ethers.parseEther("1000") 
      );
      await tradingEngine.connect(user2).placeMarketOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        true // isBuy
      );
      
      const order = await tradingEngine.getOrder(1);
      expect(order.trader).to.equal(user2.address);
      expect(order.isMarketOrder).to.be.true;
      expect(order.isActive).to.be.false; 
    });

    it("Should place a market sell order for aTSLA", async function () {
      await tradingEngine.connect(user2).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseUnits(INITIAL_ATSLA_PRICE.toString(), 6),
        true // isBuy
      );
      
      await tradingEngine.connect(user1).placeMarketOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        false // isSell
      );
      
      const order = await tradingEngine.getOrder(1);
      expect(order.trader).to.equal(user1.address);
      expect(order.isMarketOrder).to.be.true;
        expect(order.isActive).to.be.false; 
    });
  });

  describe("Order Book Management", function () {
    it("Should track active buy and sell orders correctly", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther("340"), 
        false // isSell
      );
      
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther("341"), 
        false // isSell
      );
      
      await tradingEngine.connect(whaleUsdc).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther("340.5"), 
        true // isBuy
      );
      
      const stats = await tradingEngine.getOrderBookStats();
      expect(stats.totalSellOrders).to.equal(2);
      expect(stats.totalBuyOrders).to.equal(1);
      expect(stats.activeSellOrders).to.equal(1);
      expect(stats.activeBuyOrders).to.equal(0);
    });

    it("Should allow order cancellation", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther(INITIAL_ATSLA_PRICE.toString()),
        false // isSell
      );
      
      await tradingEngine.connect(user1).cancelOrder(0);
      
      const order = await tradingEngine.getOrder(0);
      expect(order.isActive).to.be.false;
    });
  });

  describe("Fee Collection", function () {
    it("Should collect fees on successful trades", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther(INITIAL_ATSLA_PRICE.toString()),
        false // isSell
      );
      
      await tradingEngine.connect(user2).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        TEST_ATSLA_AMOUNT,
        ethers.parseEther(INITIAL_ATSLA_PRICE.toString()),
        true // isBuy
      );
      
      const feeBalance = await tradingEngine.getFeeBalance(await usdc.getAddress());
      expect(feeBalance).to.be.gt(0);
    });
  });

  describe("Realistic Trading Scenario", function () {
    it("Should execute a complete trading scenario with multiple orders", async function () {
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("0.005"), 
        ethers.parseEther("340"), 
        false // isSell
      );
      
      await tradingEngine.connect(user1).placeLimitOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("0.005"), 
        ethers.parseEther("341"), 
        false // isSell
      );
      
      await tradingEngine.connect(user2).placeMarketOrder(
        await atsla.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("0.008"), 
        true // isBuy
      );
      
      const firstSellOrder = await tradingEngine.getOrder(0);
      expect(firstSellOrder.filledAmount).to.equal(ethers.parseEther("0.005"));
      expect(firstSellOrder.isActive).to.be.false;
      
      const secondSellOrder = await tradingEngine.getOrder(1);
      expect(secondSellOrder.filledAmount).to.equal(ethers.parseEther("0"));
      expect(secondSellOrder.isActive).to.be.true;
      
      const marketBuyOrder = await tradingEngine.getOrder(2);
      expect(marketBuyOrder.filledAmount).to.equal(ethers.parseEther("0.005"));
      expect(marketBuyOrder.isActive).to.be.true;
    });
  });
});
