import { ethers, run } from "hardhat";
import { Contract } from "ethers";

async function main() {
    console.log("🚀 Deploying AlloTradingProtocol to BSC Testnet...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", await deployer.getAddress());
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));
    
    // Deploy mock tokens for testing
    console.log("\n📦 Deploying mock tokens...");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped Ether", "WETH", ethers.utils.parseEther("1000000"));
    await weth.deployed();
    console.log("WETH deployed to:", weth.address);
    
    const usdc = await MockERC20.deploy("USD Coin", "USDC", ethers.utils.parseEther("1000000"));
    await usdc.deployed();
    console.log("USDC deployed to:", usdc.address);
    
    const btc = await MockERC20.deploy("Bitcoin", "BTC", ethers.utils.parseEther("1000000"));
    await btc.deployed();
    console.log("BTC deployed to:", btc.address);
    
    // Deploy price oracles
    console.log("\n🔗 Deploying price oracles...");
    
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const mockOracle = await MockPriceOracle.deploy();
    await mockOracle.deployed();
    console.log("MockPriceOracle deployed to:", mockOracle.address);
    
    const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
    const chainlinkOracle = await ChainlinkPriceOracle.deploy();
    await chainlinkOracle.initialize();
    console.log("ChainlinkPriceOracle deployed to:", chainlinkOracle.address);
    
    // Deploy main protocol
    console.log("\n🏦 Deploying AlloTradingProtocol...");
    
    const AlloTradingProtocol = await ethers.getContractFactory("AlloTradingProtocol");
    const alloProtocol = await AlloTradingProtocol.deploy();
    await alloProtocol.initialize(mockOracle.address);
    console.log("AlloTradingProtocol deployed to:", alloProtocol.address);
    
    // Set up mock prices
    console.log("\n💰 Setting up mock prices...");
    
    await mockOracle.setPrice(weth.address, usdc.address, ethers.utils.parseEther("2000")); // 1 ETH = 2000 USDC
    await mockOracle.setPrice(btc.address, usdc.address, ethers.utils.parseEther("40000")); // 1 BTC = 40000 USDC
    await mockOracle.setPrice(weth.address, btc.address, ethers.utils.parseEther("0.05")); // 1 ETH = 0.05 BTC
    
    console.log("✅ Mock prices set:");
    console.log("  - 1 ETH = 2000 USDC");
    console.log("  - 1 BTC = 40000 USDC");
    console.log("  - 1 ETH = 0.05 BTC");
    
    // Add trading pairs
    console.log("\n🔄 Adding trading pairs...");
    
    await alloProtocol.addTradingPair(
        weth.address,
        usdc.address,
        10, // max leverage
        150, // min collateral ratio
        120  // liquidation threshold
    );
    console.log("✅ Added WETH/USDC trading pair");
    
    await alloProtocol.addTradingPair(
        btc.address,
        usdc.address,
        20, // max leverage
        150, // min collateral ratio
        120  // liquidation threshold
    );
    console.log("✅ Added BTC/USDC trading pair");
    
    await alloProtocol.addTradingPair(
        weth.address,
        btc.address,
        5, // max leverage
        150, // min collateral ratio
        120  // liquidation threshold
    );
    console.log("✅ Added WETH/BTC trading pair");
    
    // Distribute tokens to test accounts
    console.log("\n🎁 Distributing tokens to test accounts...");
    
    const testAccounts = await ethers.getSigners();
    const distributionAmount = ethers.utils.parseEther("10000");
    
    for (let i = 1; i < Math.min(testAccounts.length, 6); i++) {
        const account = testAccounts[i];
        await weth.transfer(account.address, distributionAmount);
        await usdc.transfer(account.address, distributionAmount);
        await btc.transfer(account.address, distributionAmount);
        console.log(`✅ Distributed tokens to ${account.address}`);
    }
    
    // Wait for a few block confirmations before verification
    console.log("\n⏳ Waiting for block confirmations...");
    await alloProtocol.deployTransaction.wait(5);
    
    // Verify contracts on BSCScan
    console.log("\n🔍 Verifying contracts on BSCScan...");
    
    try {
        console.log("Verifying MockERC20 (WETH)...");
        await run("verify:verify", {
            address: weth.address,
            constructorArguments: ["Wrapped Ether", "WETH", ethers.utils.parseEther("1000000")],
        });
        console.log("✅ WETH verified");
    } catch (error) {
        console.log("⚠️ WETH verification failed:", error.message);
    }
    
    try {
        console.log("Verifying MockERC20 (USDC)...");
        await run("verify:verify", {
            address: usdc.address,
            constructorArguments: ["USD Coin", "USDC", ethers.utils.parseEther("1000000")],
        });
        console.log("✅ USDC verified");
    } catch (error) {
        console.log("⚠️ USDC verification failed:", error.message);
    }
    
    try {
        console.log("Verifying MockERC20 (BTC)...");
        await run("verify:verify", {
            address: btc.address,
            constructorArguments: ["Bitcoin", "BTC", ethers.utils.parseEther("1000000")],
        });
        console.log("✅ BTC verified");
    } catch (error) {
        console.log("⚠️ BTC verified");
    }
    
    try {
        console.log("Verifying MockPriceOracle...");
        await run("verify:verify", {
            address: mockOracle.address,
        });
        console.log("✅ MockPriceOracle verified");
    } catch (error) {
        console.log("⚠️ MockPriceOracle verification failed:", error.message);
    }
    
    try {
        console.log("Verifying ChainlinkPriceOracle...");
        await run("verify:verify", {
            address: chainlinkOracle.address,
        });
        console.log("✅ ChainlinkPriceOracle verified");
    } catch (error) {
        console.log("⚠️ ChainlinkPriceOracle verification failed:", error.message);
    }
    
    try {
        console.log("Verifying AlloTradingProtocol...");
        await run("verify:verify", {
            address: alloProtocol.address,
            constructorArguments: [],
        });
        console.log("✅ AlloTradingProtocol verified");
    } catch (error) {
        console.log("⚠️ AlloTradingProtocol verification failed:", error.message);
    }
    
    // Print deployment summary
    console.log("\n🎉 Deployment Summary:");
    console.log("========================");
    console.log("Network: BSC Testnet");
    console.log("Deployer:", await deployer.getAddress());
    console.log("WETH:", weth.address);
    console.log("USDC:", usdc.address);
    console.log("BTC:", btc.address);
    console.log("MockPriceOracle:", mockOracle.address);
    console.log("ChainlinkPriceOracle:", chainlinkOracle.address);
    console.log("AlloTradingProtocol:", alloProtocol.address);
    console.log("\n🔗 BSCScan Testnet Explorer: https://testnet.bscscan.com");
    console.log("📝 Contract addresses saved above for future reference");
    
    // Save deployment info to a file
    const deploymentInfo = {
        network: "BSC Testnet",
        deployer: await deployer.getAddress(),
        contracts: {
            weth: weth.address,
            usdc: usdc.address,
            btc: btc.address,
            mockPriceOracle: mockOracle.address,
            chainlinkPriceOracle: chainlinkOracle.address,
            alloTradingProtocol: alloProtocol.address,
        },
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
    };
    
    const fs = require("fs");
    fs.writeFileSync(
        "deployment-bsc-testnet.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to deployment-bsc-testnet.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
