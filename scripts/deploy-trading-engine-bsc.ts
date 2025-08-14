import { ethers, run } from "hardhat";
import { Contract } from "ethers";

async function main() {
    console.log("Deploying TradingEngine to BSC Testnet");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", await deployer.getAddress());
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
    
    console.log("Deploying mock tokens");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const baseToken = await MockERC20.deploy("Wrapped Ether", "WETH", ethers.parseEther("1000000"));
    await baseToken.waitForDeployment();
    const baseTokenAddress = await baseToken.getAddress();
    console.log("Base Token (WETH) deployed to:", baseTokenAddress);
    
    const quoteToken = await MockERC20.deploy("USD Coin", "USDC", ethers.parseEther("1000000"));
    await quoteToken.waitForDeployment();
    const quoteTokenAddress = await quoteToken.getAddress();
    console.log("Quote Token (USDC) deployed to:", quoteTokenAddress);
    
    console.log("Deploying mock price oracle");
    
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const mockOracle = await MockPriceOracle.deploy();
    await mockOracle.waitForDeployment();
    const mockOracleAddress = await mockOracle.getAddress();
    console.log("MockPriceOracle deployed to:", mockOracleAddress);
    
    console.log("Deploying TradingEngine");
    
    const TradingEngine = await ethers.getContractFactory("TradingEngine");
    
    const minOrderAmount = ethers.parseEther("0.01");
    const maxOrderAmount = ethers.parseEther("100");
    
    const tradingEngine = await TradingEngine.deploy();
    await tradingEngine.waitForDeployment();
    const tradingEngineAddress = await tradingEngine.getAddress();
    console.log("TradingEngine deployed to:", tradingEngineAddress);
    
    console.log("Initializing TradingEngine");
    await tradingEngine.initialize(mockOracleAddress, minOrderAmount, maxOrderAmount);
    console.log("TradingEngine initialized");
    
    console.log("Setting up mock prices");
    
    await mockOracle.setPrice(baseTokenAddress, quoteTokenAddress, ethers.parseEther("2000"));
    console.log("Mock price set: 1 WETH = 2000 USDC");
    
    console.log("Setting up trading pair");
    await tradingEngine.setTradingPairAllowed(baseTokenAddress, quoteTokenAddress, true);
    console.log("WETH/USDC trading pair enabled");
    
    console.log("Distributing tokens to test accounts");
    
    const testAccounts = await ethers.getSigners();
    const distributionAmount = ethers.parseEther("10000");
    
    for (let i = 1; i < Math.min(testAccounts.length, 6); i++) {
        const account = testAccounts[i];
        await baseToken.transfer(await account.getAddress(), distributionAmount);
        await quoteToken.transfer(await account.getAddress(), distributionAmount);
        console.log(`Distributed tokens to ${await account.getAddress()}`);
    }
    
    console.log("Waiting for block confirmations");
    
    console.log("Verifying contracts on BSCScan");
    
    try {
        console.log("Verifying Base Token (WETH)");
        await run("verify:verify", {
            address: baseTokenAddress,
            constructorArguments: [
                "Wrapped Ether",           
                "WETH",                    
                ethers.parseEther("1000000") 
            ],
        });
        console.log("Base Token (WETH) verified");
    } catch (error:any) {
        console.log("Base Token verification failed:", error.message);
    }
    
    try {
        console.log("Verifying Quote Token (USDC)");
        await run("verify:verify", {
            address: quoteTokenAddress,
            constructorArguments: [
                "USD Coin",                
                "USDC",                    
                ethers.parseEther("1000000") 
            ],
        });
        console.log("Quote Token (USDC) verified");
    } catch (error:any) {
        console.log("Quote Token verification failed:", error.message);
    }
    
    try {
        console.log("Verifying MockPriceOracle");
        await run("verify:verify", {
            address: mockOracleAddress,
        });
        console.log("MockPriceOracle verified");
    } catch (error:any) {
        console.log("MockPriceOracle verification failed:", error.message);
    }
    
    try {
        console.log("Verifying TradingEngine");
        await run("verify:verify", {
            address: tradingEngineAddress,
            constructorArguments: [],
        });
        console.log("TradingEngine verified");
    } catch (error:any) {
        console.log("TradingEngine verification failed:", error.message);
    }
    
    console.log("Deployment Summary:");
    console.log("========================");
    console.log("Network: BSC Testnet");
    console.log("Deployer:", await deployer.getAddress());
    console.log("Base Token (WETH):", baseTokenAddress);
    console.log("Quote Token (USDC):", quoteTokenAddress);
    console.log("MockPriceOracle:", mockOracleAddress);
    console.log("TradingEngine:", tradingEngineAddress);
    
    const deploymentInfo = {
        network: "BSC Testnet",
        deployer: await deployer.getAddress(),
        contracts: {
            baseToken: {
                name: "WETH",
                address: baseTokenAddress,
                symbol: "WETH"
            },
            quoteToken: {
                name: "USDC", 
                address: quoteTokenAddress,
                symbol: "USDC"
            },
            mockPriceOracle: mockOracleAddress,
            tradingEngine: tradingEngineAddress,
        },
        tradingEngineConfig: {
            minOrderAmount: ethers.formatEther(minOrderAmount),
            maxOrderAmount: ethers.formatEther(maxOrderAmount),
            feeRate: "0.05%",
        },
        mockPrices: {
            "WETH/USDC": "2000"
        },
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
    };
    
    const fs = require("fs");
    fs.writeFileSync(
        "deployment-trading-engine-bsc.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
