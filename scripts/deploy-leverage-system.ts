import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance));

  console.log("\n=== Deploying Leverage Trading System ===\n");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const LeverageTradingEngine = await ethers.getContractFactory("LeverageTradingEngine");
  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");

  console.log("1. Deploying MockERC20 tokens...");
  const usdc = await MockERC20.deploy("USDC", "USDC", 6);
  await usdc.deployed();
  console.log("USDC deployed to:", usdc.address);

  const weth = await MockERC20.deploy("WETH", "WETH", 18);
  await weth.deployed();
  console.log("WETH deployed to:", weth.address);

  console.log("\n2. Deploying MockPriceOracle...");
  const priceOracle = await MockPriceOracle.deploy();
  await priceOracle.deployed();
  console.log("MockPriceOracle deployed to:", priceOracle.address);

  console.log("\n3. Deploying LiquidityPool...");
  const liquidityPool = await LiquidityPool.deploy();
  await liquidityPool.deployed();
  console.log("LiquidityPool deployed to:", liquidityPool.address);

  console.log("\n4. Deploying PositionManager...");
  const positionManager = await PositionManager.deploy();
  await positionManager.deployed();
  console.log("PositionManager deployed to:", positionManager.address);

  console.log("\n5. Deploying LeverageTradingEngine...");
  const leverageTradingEngine = await LeverageTradingEngine.deploy();
  await leverageTradingEngine.deployed();
  console.log("LeverageTradingEngine deployed to:", leverageTradingEngine.address);

  console.log("\n6. Deploying LiquidationEngine...");
  const liquidationEngine = await LiquidationEngine.deploy();
  await liquidationEngine.deployed();
  console.log("LiquidationEngine deployed to:", liquidationEngine.address);

  console.log("\n=== Initializing Contracts ===\n");

  console.log("1. Initializing LiquidityPool...");
  await liquidityPool.initialize();
  console.log("LiquidityPool initialized");

  console.log("2. Initializing PositionManager...");
  await positionManager.initialize(priceOracle.address);
  console.log("PositionManager initialized");

  console.log("3. Initializing LeverageTradingEngine...");
  await leverageTradingEngine.initialize(
    "0x0000000000000000000000000000000000000000", // TradingEngine placeholder
    liquidityPool.address,
    positionManager.address,
    priceOracle.address
  );
  console.log("LeverageTradingEngine initialized");

  console.log("4. Initializing LiquidationEngine...");
  await liquidationEngine.initialize(positionManager.address, liquidityPool.address);
  console.log("LiquidationEngine initialized");

  console.log("\n=== Setting up Permissions ===\n");

  console.log("1. Adding supported tokens to LiquidityPool...");
  await liquidityPool.addSupportedToken(usdc.address);
  await liquidityPool.addSupportedToken(weth.address);
  console.log("Supported tokens added");

  console.log("2. Authorizing LeverageTradingEngine as borrower...");
  await liquidityPool.authorizeBorrower(leverageTradingEngine.address);
  console.log("LeverageTradingEngine authorized as borrower");

  console.log("3. Authorizing LiquidationEngine...");
  await liquidityPool.authorizeBorrower(liquidationEngine.address);
  console.log("LiquidationEngine authorized");

  console.log("\n4. Setting up price feeds...");
  await priceOracle.setPrice(usdc.address, weth.address, ethers.utils.parseUnits("2000", 18));
  await priceOracle.setPrice(weth.address, usdc.address, ethers.utils.parseUnits("0.0005", 6));
  console.log("Price feeds set");

  console.log("\n=== Minting Initial Tokens ===\n");

  console.log("1. Minting USDC to deployer...");
  await usdc.mint(deployer.address, ethers.utils.parseUnits("1000000", 6));
  console.log("USDC minted");

  console.log("2. Minting WETH to deployer...");
  await weth.mint(deployer.address, ethers.utils.parseUnits("1000", 18));
  console.log("WETH minted");

  console.log("\n=== Deployment Summary ===\n");
  console.log("USDC:", usdc.address);
  console.log("WETH:", weth.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log("LiquidityPool:", liquidityPool.address);
  console.log("PositionManager:", positionManager.address);
  console.log("LeverageTradingEngine:", leverageTradingEngine.address);
  console.log("LiquidationEngine:", liquidationEngine.address);

  console.log("\n=== Next Steps ===\n");
  console.log("1. Deploy the main TradingEngine contract");
  console.log("2. Update LeverageTradingEngine with TradingEngine address");
  console.log("3. Set up the backend monitoring system");
  console.log("4. Test the leverage trading functionality");

  console.log("\n=== Environment Variables for Backend ===\n");
  console.log(`POSITION_MANAGER_ADDRESS=${positionManager.address}`);
  console.log(`LIQUIDATION_ENGINE_ADDRESS=${liquidationEngine.address}`);
  console.log(`LIQUIDITY_POOL_ADDRESS=${liquidityPool.address}`);
  console.log(`RPC_URL=${process.env.RPC_URL || "http://localhost:8545"}`);
  console.log(`PRIVATE_KEY=${process.env.PRIVATE_KEY || "YOUR_PRIVATE_KEY"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
