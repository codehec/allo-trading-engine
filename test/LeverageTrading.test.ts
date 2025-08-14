import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Leverage Trading System", function () {
  let mockERC20: any;
  let mockPriceOracle: any;
  let liquidityPool: any;
  let positionManager: any;
  let leverageTrading: any;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Mock Token", "MTK", ethers.parseEther("1000000"));

    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    
    await mockPriceOracle.setPrice(await mockERC20.getAddress(), await mockERC20.getAddress(), 1000000000000000000n);

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = await LiquidityPool.deploy(await mockERC20.getAddress());

    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(await mockPriceOracle.getAddress());

    const LeverageTrading = await ethers.getContractFactory("LeverageTrading");
    leverageTrading = await LeverageTrading.deploy(
      await mockPriceOracle.getAddress(),
      await liquidityPool.getAddress(),
      await positionManager.getAddress()
    );

    await mockERC20.mint(await user1.getAddress(), ethers.parseEther("10000"));
    await mockERC20.mint(await user2.getAddress(), ethers.parseEther("10000"));
  });

  describe("LiquidityPool", function () {
    it("Should allow users to stake tokens", async function () {
      const amount = ethers.parseEther("1000");
      await mockERC20.connect(user1).approve(await liquidityPool.getAddress(), amount);
      await liquidityPool.connect(user1).stake(amount);
      
      const userStake = await liquidityPool.userStakes(await user1.getAddress());
      expect(userStake.amount).to.equal(amount);
    });

    it("Should allow users to withdraw staked tokens", async function () {
      const amount = ethers.parseEther("1000");
      await mockERC20.connect(user1).approve(await liquidityPool.getAddress(), amount);
      await liquidityPool.connect(user1).stake(amount);
      
      await liquidityPool.connect(user1).withdraw(amount);
      const userStake = await liquidityPool.userStakes(await user1.getAddress());
      expect(userStake.amount).to.equal(0);
    });
  });

  describe("PositionManager", function () {
    it("Should open a long position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), collateral);
      
      const tx = await positionManager.connect(user1).openPosition(
        await mockERC20.getAddress(),
        await mockERC20.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should open a short position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("1000");
      const leverage = 10;
      
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), collateral);
      
      const tx = await positionManager.connect(user1).openPosition(
        await mockERC20.getAddress(),
        await mockERC20.getAddress(),
        collateral,
        size,
        false,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });
  });

  describe("LeverageTrading", function () {
    it("Should check approval works", async function () {
      const amount = ethers.parseEther("100");
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), amount);
      const allowance = await mockERC20.allowance(await user1.getAddress(), await positionManager.getAddress());
      expect(allowance).to.equal(amount);
    });

    it("Should check PositionManager can transfer tokens", async function () {
      const amount = ethers.parseEther("100");
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), amount);
      
      const userBalanceBefore = await mockERC20.balanceOf(await user1.getAddress());
      const contractBalanceBefore = await mockERC20.balanceOf(await positionManager.getAddress());
      
      await mockERC20.connect(user1).transfer(await positionManager.getAddress(), amount);
      
      const userBalanceAfter = await mockERC20.balanceOf(await user1.getAddress());
      const contractBalanceAfter = await mockERC20.balanceOf(await positionManager.getAddress());
      
      expect(userBalanceAfter).to.equal(userBalanceBefore - amount);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + amount);
    });

    it("Should open position directly in PositionManager", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("150");
      const leverage = 2;
      
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), collateral);
      
      const tx = await positionManager.connect(user1).openPosition(
        await mockERC20.getAddress(),
        await mockERC20.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should open a leverage position", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("150");
      const leverage = 2;
      const borrowedAmount = size - collateral;
      
      console.log("PositionManager address:", await positionManager.getAddress());
      console.log("User address:", await user1.getAddress());
      
      const allowanceBefore = await mockERC20.allowance(await user1.getAddress(), await positionManager.getAddress());
      console.log("Allowance before approval:", allowanceBefore.toString());
      
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), collateral);
      
      const allowanceAfter = await mockERC20.allowance(await user1.getAddress(), await positionManager.getAddress());
      console.log("Allowance after approval:", allowanceAfter.toString());
      
      await mockERC20.connect(user1).approve(await leverageTrading.getAddress(), borrowedAmount);
      
      const tx = await leverageTrading.connect(user1).openLeveragePosition(
        await mockERC20.getAddress(),
        await mockERC20.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should calculate interest correctly", async function () {
      const collateral = ethers.parseEther("100");
      const size = ethers.parseEther("150");
      const leverage = 2;
      const borrowedAmount = size - collateral;
      
      await mockERC20.connect(user1).approve(await positionManager.getAddress(), collateral);
      await mockERC20.connect(user1).approve(await leverageTrading.getAddress(), borrowedAmount);
      
      const tx = await leverageTrading.connect(user1).openLeveragePosition(
        await mockERC20.getAddress(),
        await mockERC20.getAddress(),
        collateral,
        size,
        true,
        leverage
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      const positionId = 0;
      const interest = await leverageTrading.calculateInterest(positionId);
      expect(interest).to.equal(0);
    });
  });
});
