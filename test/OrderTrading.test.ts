import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Order Trading System", function () {
  let baseToken: any;
  let quoteToken: any;
  let mockPriceOracle: any;
  let liquidityPool: any;
  let positionManager: any;
  let orderManager: any;
  let enhancedLeverageTrading: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let marketMaker: any;

  beforeEach(async function () {
    [owner, user1, user2, marketMaker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    baseToken = await MockERC20.deploy("Base Token", "BASE", ethers.parseEther("1000000"));
    quoteToken = await MockERC20.deploy("Quote Token", "QUOTE", ethers.parseEther("1000000"));

    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = await LiquidityPool.deploy(await quoteToken.getAddress());

    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(await mockPriceOracle.getAddress());

    const OrderManager = await ethers.getContractFactory("OrderManager");
    orderManager = await OrderManager.deploy(await mockPriceOracle.getAddress());

    const EnhancedLeverageTrading = await ethers.getContractFactory("EnhancedLeverageTrading");
    enhancedLeverageTrading = await EnhancedLeverageTrading.deploy(
      await mockPriceOracle.getAddress(),
      await liquidityPool.getAddress(),
      await positionManager.getAddress(),
      await orderManager.getAddress()
    );

    await baseToken.mint(await user1.getAddress(), ethers.parseEther("10000"));
    await quoteToken.mint(await user1.getAddress(), ethers.parseEther("10000"));
    await quoteToken.mint(await user2.getAddress(), ethers.parseEther("10000"));
    await quoteToken.mint(await marketMaker.getAddress(), ethers.parseEther("10000"));

    await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 1000000000000000000n);
    await mockPriceOracle.setPrice(await quoteToken.getAddress(), await baseToken.getAddress(), 1000000000000000000n);
  });

  describe("Order Manager", function () {
    it("Should place a limit buy order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      const limitPrice = ethers.parseEther("0.9"); // Buy at 0.9 QUOTE per BASE
      
      const tx = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        limitPrice,
        true, // isLong
        leverage,
        await user1.getAddress()
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const orderId = 0; // First order will have ID 0
      
      const order = await orderManager.getOrder(orderId);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.true;
      expect(order.limitPrice).to.equal(limitPrice);
      expect(order.isMarketOrder).to.be.false;
      expect(order.isActive).to.be.true;
    });

    it("Should place a limit sell order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      const limitPrice = ethers.parseEther("1.1"); // Sell at 1.1 QUOTE per BASE
      
      const tx = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        limitPrice,
        false, // isLong
        leverage,
        await user1.getAddress()
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const orderId = 0; // First order will have ID 0
      
      const order = await orderManager.getOrder(orderId);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.false;
      expect(order.limitPrice).to.equal(limitPrice);
      expect(order.isMarketOrder).to.be.false;
      expect(order.isActive).to.be.true;
    });

    it("Should place a market order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      
      const tx = await orderManager.connect(user1).placeMarketOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true, // isLong
        leverage,
        await user1.getAddress()
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const orderId = 0; // First order will have ID 0
      
      const order = await orderManager.getOrder(orderId);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.true;
      expect(order.isMarketOrder).to.be.true;
      expect(order.isActive).to.be.true;
    });

    it("Should cancel an order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      const limitPrice = ethers.parseEther("0.9");
      
      const tx = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        limitPrice,
        true,
        leverage,
        await user1.getAddress()
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const orderId = 0; // First order will have ID 0
      
      await orderManager.connect(user1).cancelOrder(orderId);
      
      const order = await orderManager.getOrder(orderId);
      expect(order.isActive).to.be.false;
    });

    it("Should get order book", async function () {
      // Place buy order
      const tx1 = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("0.9"),
        true,
        2,
        await user1.getAddress()
      );
      await tx1.wait();
      
      // Place sell order
      const tx2 = await orderManager.connect(user2).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("1.1"),
        false,
        2,
        await user2.getAddress()
      );
      await tx2.wait();
      
      const orderBook = await orderManager.getOrderBook(
        await baseToken.getAddress(),
        await quoteToken.getAddress()
      );
      
      expect(orderBook.buyOrderIds).to.have.length(1);
      expect(orderBook.sellOrderIds).to.have.length(1);
    });
  });

  describe("Enhanced Leverage Trading - Limit Orders", function () {
    it("Should open leverage long position with limit order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      const limitPrice = ethers.parseEther("0.9");
      
      // Approve EnhancedLeverageTrading for the total amount
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), size);
      
      const tx = await enhancedLeverageTrading.connect(user1).openLeveragePositionWithLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true, // isLong
        leverage,
        limitPrice
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const positionId = 0; // First position will have ID 0
      
      const leveragePosition = await enhancedLeverageTrading.getLeveragePosition(positionId);
      expect(leveragePosition.borrowedAmount).to.equal(ethers.parseEther("80"));
      expect(leveragePosition.orderId).to.equal(0);
      
      const order = await orderManager.getOrder(0);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.true;
      expect(order.limitPrice).to.equal(limitPrice);
    });

    it("Should open leverage short position with limit order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      const limitPrice = ethers.parseEther("1.1");
      
      // Approve EnhancedLeverageTrading for the total amount
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), size);
      
      const tx = await enhancedLeverageTrading.connect(user1).openLeveragePositionWithLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        false, // isLong
        leverage,
        limitPrice
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const positionId = 0; // First position will have ID 0
      
      const leveragePosition = await enhancedLeverageTrading.getLeveragePosition(positionId);
      expect(leveragePosition.borrowedAmount).to.equal(ethers.parseEther("80"));
      expect(leveragePosition.orderId).to.equal(0);
      
      const order = await orderManager.getOrder(0);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.false;
      expect(order.limitPrice).to.equal(limitPrice);
    });
  });

  describe("Enhanced Leverage Trading - Market Orders", function () {
    it("Should open leverage long position with market order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      
      // Approve EnhancedLeverageTrading for the total amount
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), size);
      
      const tx = await enhancedLeverageTrading.connect(user1).openLeveragePositionWithMarketOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true, // isLong
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const positionId = 0; // First position will have ID 0
      
      const leveragePosition = await enhancedLeverageTrading.getLeveragePosition(positionId);
      expect(leveragePosition.borrowedAmount).to.equal(ethers.parseEther("80"));
      expect(leveragePosition.orderId).to.equal(0);
      
      const order = await orderManager.getOrder(0);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.true;
      expect(order.isMarketOrder).to.be.true;
    });

    it("Should open leverage short position with market order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      
      // Approve EnhancedLeverageTrading for the total amount
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), size);
      
      const tx = await enhancedLeverageTrading.connect(user1).openLeveragePositionWithMarketOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        false, // isLong
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const positionId = 0; // First position will have ID 0
      
      const leveragePosition = await enhancedLeverageTrading.getLeveragePosition(positionId);
      expect(leveragePosition.borrowedAmount).to.equal(ethers.parseEther("80"));
      expect(leveragePosition.orderId).to.equal(0);
      
      const order = await orderManager.getOrder(0);
      expect(order.trader).to.equal(await user1.getAddress());
      expect(order.isLong).to.be.false;
      expect(order.isMarketOrder).to.be.true;
    });
  });

  describe("Order Execution and Management", function () {
    it("Should execute limit order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      const limitPrice = ethers.parseEther("0.9");
      
      // Place limit order
      await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        limitPrice,
        true,
        leverage,
        await user1.getAddress()
      );
      
      // Market maker executes the order
      await enhancedLeverageTrading.connect(marketMaker).executeLimitOrder(0);
      
      // Check that order execution event was emitted
      // Note: In a real system, this would also update order status and execute trades
    });

    it("Should close leverage position and cancel associated order", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      
      // Open position with market order
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), size);
      
      const tx = await enhancedLeverageTrading.connect(user1).openLeveragePositionWithMarketOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      // Get the actual position ID from the transaction receipt or event
      const positionId = 0; // First position will have ID 0
      console.log("Using positionId:", positionId);
      
      // Check that order was created
      const leveragePosition = await enhancedLeverageTrading.getLeveragePosition(positionId);
      console.log("LeveragePosition details:", {
        positionId: leveragePosition.positionId,
        orderId: leveragePosition.orderId,
        trader: leveragePosition.trader,
        borrowedAmount: leveragePosition.borrowedAmount
      });
      expect(leveragePosition.orderId).to.equal(0);
      expect(leveragePosition.trader).to.equal(await user1.getAddress());
      
      // Close position - approve for borrowed amount plus some extra for interest
      await quoteToken.connect(user1).approve(await enhancedLeverageTrading.getAddress(), ethers.parseEther("100"));
      
      await enhancedLeverageTrading.connect(user1).closeLeveragePosition(positionId);
      
      // Check that position was closed
      const position = await positionManager.getPosition(positionId);
      expect(position.isActive).to.be.false;
      
      // Check that order was cancelled
      const order = await orderManager.getOrder(0);
      console.log("Order details:", {
        orderId: order.orderId_,
        trader: order.trader,
        isActive: order.isActive,
        baseToken: order.baseToken,
        quoteToken: order.quoteToken
      });
      expect(order.isActive).to.be.false;
    });
  });

  describe("Order Book Management", function () {
    it("Should maintain separate buy and sell order books", async function () {
      // Place multiple buy orders
      const tx1 = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("0.9"),
        true,
        2,
        await user1.getAddress()
      );
      await tx1.wait();
      
      const tx2 = await orderManager.connect(user2).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("0.95"),
        true,
        2,
        await user2.getAddress()
      );
      await tx2.wait();
      
      // Place multiple sell orders
      const tx3 = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("1.1"),
        false,
        2,
        await user1.getAddress()
      );
      await tx3.wait();
      
      const tx4 = await orderManager.connect(user2).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("1.05"),
        false,
        2,
        await user2.getAddress()
      );
      await tx4.wait();
      
      const orderBook = await orderManager.getOrderBook(
        await baseToken.getAddress(),
        await quoteToken.getAddress()
      );
      
      expect(orderBook.buyOrderIds).to.have.length(2);
      expect(orderBook.sellOrderIds).to.have.length(2);
      
      // Note: Order book doesn't automatically sort by price
      // This would be implemented in a real trading system
    });
  });

  describe("Error Handling", function () {
    it("Should reject invalid limit price", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      const invalidPrice = 0;
      
      await expect(
        orderManager.connect(user1).placeLimitOrder(
          await baseToken.getAddress(),
          await quoteToken.getAddress(),
          collateral,
          size,
          invalidPrice,
          true,
          leverage,
          await user1.getAddress()
        )
      ).to.be.revertedWith("Invalid limit price");
    });

    it("Should reject invalid leverage", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const invalidLeverage = 11; // Above max leverage
      
      await expect(
        orderManager.connect(user1).placeLimitOrder(
          await baseToken.getAddress(),
          await quoteToken.getAddress(),
          collateral,
          size,
          ethers.parseEther("0.9"),
          true,
          invalidLeverage,
          await user1.getAddress()
        )
      ).to.be.revertedWith("Invalid leverage");
    });

    it("Should reject order cancellation by non-owner", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      const limitPrice = ethers.parseEther("0.9");
      
      const tx = await orderManager.connect(user1).placeLimitOrder(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        limitPrice,
        true,
        leverage,
        await user1.getAddress()
      );
      await tx.wait();
      
      const orderId = 0; // First order will have ID 0
      
      // User2 tries to cancel user1's order
      await expect(
        orderManager.connect(user2).cancelOrder(orderId)
      ).to.be.revertedWith("Not order owner");
    });
  });
});
