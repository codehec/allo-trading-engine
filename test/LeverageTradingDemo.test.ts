import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Leverage Trading Demo", function () {
  let baseToken: any;
  let quoteToken: any;
  let mockPriceOracle: any;
  let liquidityPool: any;
  let positionManager: any;
  let leverageTrading: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    baseToken = await MockERC20.deploy("Base Token", "BASE", ethers.parseEther("1000000"));
    quoteToken = await MockERC20.deploy("Quote Token", "QUOTE", ethers.parseEther("1000000"));

    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = await LiquidityPool.deploy(await quoteToken.getAddress());

    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(await mockPriceOracle.getAddress());

    const LeverageTrading = await ethers.getContractFactory("LeverageTrading");
    leverageTrading = await LeverageTrading.deploy(
      await mockPriceOracle.getAddress(),
      await liquidityPool.getAddress(),
      await positionManager.getAddress()
    );

    await baseToken.mint(await user1.getAddress(), ethers.parseEther("10000"));
    await quoteToken.mint(await user1.getAddress(), ethers.parseEther("10000"));
    await quoteToken.mint(await user2.getAddress(), ethers.parseEther("10000"));

    await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 1000000000000000000n);
    await mockPriceOracle.setPrice(await quoteToken.getAddress(), await baseToken.getAddress(), 1000000000000000000n);
  });

  describe("Liquidity Pool Setup", function () {
    it("Should add initial liquidity to the pool", async function () {
      const liquidityAmount = ethers.parseEther("1000");
      await quoteToken.connect(user2).approve(await liquidityPool.getAddress(), liquidityAmount);
      await liquidityPool.connect(user2).stake(liquidityAmount);
      
      const totalLiquidity = await liquidityPool.getTotalLiquidity();
      expect(totalLiquidity).to.equal(liquidityAmount);
    });
  });

  describe("Position Manager", function () {
    it("Should open a long position with 10x leverage", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const position = await positionManager.getPosition(0);
      expect(position.isActive).to.be.true;
      expect(position.isLong).to.be.true;
      expect(position.leverage).to.equal(leverage);
    });

    it("Should open a short position with 10x leverage", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        false,
        leverage
      );
      
      const position = await positionManager.getPosition(0);
      expect(position.isActive).to.be.true;
      expect(position.isLong).to.be.false;
      expect(position.leverage).to.equal(leverage);
    });
  });

  describe("Leverage Trading", function () {
    it("Should open a leverage long position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      const borrowedAmount = size - collateral;
      
      // Approve LeverageTrading for the total amount (collateral + borrowed)
      await quoteToken.connect(user1).approve(await leverageTrading.getAddress(), size);
      
      const tx = await leverageTrading.connect(user1).openLeveragePosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should open a leverage short position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("180");
      const leverage = 2;
      const borrowedAmount = size - collateral;
      
      // Approve LeverageTrading for the total amount (collateral + borrowed)
      await quoteToken.connect(user1).approve(await leverageTrading.getAddress(), size);
      
      const tx = await leverageTrading.connect(user1).openLeveragePosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        false,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });
  });

  describe("Basic Position Tests", function () {
    it("Should create a basic position and check health", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("100");
      const leverage = 1;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const position = await positionManager.getPosition(0);
      console.log("Basic position:", {
        collateral: position.collateral.toString(),
        size: position.size.toString(),
        borrowedAmount: position.borrowedAmount.toString(),
        entryPrice: position.entryPrice.toString()
      });
      
      const health = await positionManager.getPositionHealth(0);
      console.log("Basic position health:", health.toString());
      
      expect(health).to.be.gt(0);
    });
  });

  describe("Price Changes and PnL", function () {
    it("Should calculate profit when price increases for long position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const positionBefore = await positionManager.getPosition(0);
      expect(positionBefore.entryPrice).to.equal(1000000000000000000n);
      expect(positionBefore.borrowedAmount).to.equal(ethers.parseEther("900"));
      
      const healthBefore = await positionManager.getPositionHealth(0);
      console.log("Position health before price change:", healthBefore.toString());
      
      await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 1100000000000000000n);
      
      const healthAfter = await positionManager.getPositionHealth(0);
      console.log("Position health after price increase:", healthAfter.toString());
      
      expect(healthAfter).to.be.gt(healthBefore);
    });

    it("Should calculate profit when price decreases for short position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        false,
        leverage
      );
      
      const positionBefore = await positionManager.getPosition(0);
      expect(positionBefore.entryPrice).to.equal(1000000000000000000n);
      
      const healthBefore = await positionManager.getPositionHealth(0);
      console.log("Position health before price change:", healthBefore.toString());
      
      await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 900000000000000000n);
      
      const healthAfter = await positionManager.getPositionHealth(0);
      console.log("Position health after price decrease:", healthAfter.toString());
      
      expect(healthAfter).to.be.gt(healthBefore);
    });
    
    it("Should calculate interest for borrowed amount", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const position = await positionManager.getPosition(0);
      expect(position.borrowedAmount).to.equal(ethers.parseEther("900"));
      
      const interest = await positionManager.calculateInterest(0);
      console.log("Initial interest:", interest.toString());
      expect(interest).to.equal(0);
      
      // Fast forward time to accrue interest
      await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
      await ethers.provider.send("evm_mine");
      
      const interestAfterDay = await positionManager.calculateInterest(0);
      console.log("Interest after 1 day:", interestAfterDay.toString());
      expect(interestAfterDay).to.be.gt(0);
    });
    
    it("Should test 90% liquidation threshold", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("200");
      const leverage = 2;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      // Position starts healthy
      const position = await positionManager.getPosition(0);
      console.log("Position created:", {
        collateral: position.collateral.toString(),
        size: position.size.toString(),
        entryPrice: position.entryPrice.toString(),
        isActive: position.isActive
      });
      
      let health = await positionManager.getPositionHealth(0);
      console.log("Initial position health:", health.toString());
      
      // Check current price
      const currentPrice = await mockPriceOracle.getPrice(await baseToken.getAddress(), await quoteToken.getAddress());
      console.log("Current price:", currentPrice.toString());
      
      // Check if position is liquidatable
      const liquidatable = await positionManager.isLiquidatable(0);
      console.log("Is liquidatable:", liquidatable);
      
      expect(health).to.be.gte(10000);
      
      // Price drops to make position unhealthy but not liquidatable
      await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 950000000000000000n);
      health = await positionManager.getPositionHealth(0);
      console.log("Health after price drop:", health.toString());
      expect(health).to.be.lt(10000);
      expect(health).to.be.gte(9000); // At or above 90% threshold
      
      // Price drops further to make position liquidatable
      await mockPriceOracle.setPrice(await baseToken.getAddress(), await quoteToken.getAddress(), 900000000000000000n);
      health = await positionManager.getPositionHealth(0);
      console.log("Health at liquidation threshold:", health.toString());
      expect(health).to.be.lte(9000); // At or below 90% threshold
      
      const isLiquidatable = await positionManager.isLiquidatable(0);
      expect(isLiquidatable).to.be.true;
    });
  });

  describe("Position Management", function () {
    it("Should allow adding collateral", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const additionalCollateral = ethers.parseEther("50");
      await quoteToken.connect(user1).approve(await positionManager.getAddress(), additionalCollateral);
      
      await positionManager.connect(user1).addCollateral(0, additionalCollateral);
      
      const position = await positionManager.getPosition(0);
      expect(position.collateral).to.equal(collateral + additionalCollateral);
    });

    it("Should allow closing position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      // Transfer collateral tokens to PositionManager first
      await quoteToken.connect(user1).transfer(await positionManager.getAddress(), collateral);
      
      await positionManager.connect(user1).openPosition(
        await baseToken.getAddress(),
        await quoteToken.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const userBalanceBefore = await quoteToken.balanceOf(await user1.getAddress());
      
      await positionManager.connect(user1).closePosition(0);
      
      const userBalanceAfter = await quoteToken.balanceOf(await user1.getAddress());
      expect(userBalanceAfter).to.be.gte(userBalanceBefore);
      
      const position = await positionManager.getPosition(0);
      expect(position.isActive).to.be.false;
    });
  });
});
