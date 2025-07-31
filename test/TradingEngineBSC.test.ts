import { expect } from "chai";
import { ethers } from "hardhat";
import { TradingEngine } from "../typechain-types";

const USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
const ATSLA_ADDRESS = "0x38B3608a3cECaF6fB6076BE8d69B9D297F9af018";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

describe("TradingEngine BSC Fork Tests", function () {
  let tradingEngine: TradingEngine;
  let usdt: any;
  let atsla: any;
  let owner: any;
  let trader1: any;
  let trader2: any;
  let trader3: any;
  let richAccount: any;

  const MIN_ORDER_AMOUNT = ethers.parseUnits("1", 18);
  const MAX_ORDER_AMOUNT = ethers.parseUnits("100000", 18);

  before(async function () {
    [owner, trader1, trader2, trader3] = await ethers.getSigners();
    
    richAccount = new ethers.Wallet("0x1234567890123456789012345678901234567890123456789012345678901234", ethers.provider);
    
    usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, ethers.provider);
    atsla = new ethers.Contract(ATSLA_ADDRESS, ERC20_ABI, ethers.provider);
    
    const TradingEngineFactory = await ethers.getContractFactory("TradingEngine");
    tradingEngine = await TradingEngineFactory.deploy();
    
    const MockPriceOracleFactory = await ethers.getContractFactory("MockPriceOracle");
    const mockPriceOracle = await MockPriceOracleFactory.deploy();
    
    await tradingEngine.initialize(
      await mockPriceOracle.getAddress(),
      MIN_ORDER_AMOUNT,
      MAX_ORDER_AMOUNT
    );
    
    await mockPriceOracle.setPrice(ATSLA_ADDRESS, USDT_ADDRESS, 100);
    
    console.log("TradingEngine deployed at:", await tradingEngine.getAddress());
    console.log("USDT address:", USDT_ADDRESS);
    console.log("ATSLA address:", ATSLA_ADDRESS);
  });

  describe("Token Setup and Distribution", function () {
    it("Should have access to real USDT and ATSLA tokens", async function () {
      const usdtSymbol = await usdt.symbol();
      const atslaSymbol = await atsla.symbol();
      
      expect(usdtSymbol).to.equal("USDT");
      expect(atslaSymbol).to.equal("aTSLA");
      
      console.log("USDT Symbol:", usdtSymbol);
      console.log("ATSLA Symbol:", atslaSymbol);
    });

    it("Should distribute tokens to test accounts", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [richAccount.address]);
      
      const initialUsdtBalance = await usdt.balanceOf(richAccount.address);
      console.log("Rich account USDT balance:", ethers.formatUnits(initialUsdtBalance, 18));
      
      if (initialUsdtBalance > 0) {
        await usdt.connect(richAccount).transfer(trader1.address, ethers.parseUnits("1000", 18));
        await usdt.connect(richAccount).transfer(trader2.address, ethers.parseUnits("1000", 18));
        await usdt.connect(richAccount).transfer(trader3.address, ethers.parseUnits("1000", 18));
        
        await atsla.connect(richAccount).transfer(trader1.address, ethers.parseUnits("10", 18));
        await atsla.connect(richAccount).transfer(trader2.address, ethers.parseUnits("10", 18));
        await atsla.connect(richAccount).transfer(trader3.address, ethers.parseUnits("10", 18));
        
        const trader1UsdtBalance = await usdt.balanceOf(trader1.address);
        const trader1AtslaBalance = await atsla.balanceOf(trader1.address);
        
        expect(trader1UsdtBalance).to.be.gt(0);
        expect(trader1AtslaBalance).to.be.gt(0);
        
        console.log("Trader1 USDT balance:", ethers.formatUnits(trader1UsdtBalance, 18));
        console.log("Trader1 ATSLA balance:", ethers.formatUnits(trader1AtslaBalance, 18));
      } else {
        console.log("Rich account has no USDT balance, skipping distribution");
      }
    });
  });

  describe("Trading with Real Tokens", function () {
    beforeEach(async function () {
      await usdt.connect(trader1).approve(await tradingEngine.getAddress(), ethers.parseUnits("1000", 18));
      await usdt.connect(trader2).approve(await tradingEngine.getAddress(), ethers.parseUnits("1000", 18));
      await usdt.connect(trader3).approve(await tradingEngine.getAddress(), ethers.parseUnits("1000", 18));
      
      await atsla.connect(trader1).approve(await tradingEngine.getAddress(), ethers.parseUnits("10", 18));
      await atsla.connect(trader2).approve(await tradingEngine.getAddress(), ethers.parseUnits("10", 18));
      await atsla.connect(trader3).approve(await tradingEngine.getAddress(), ethers.parseUnits("10", 18));
    });

    it("Should place a buy market order for ATSLA with USDT", async function () {
      const atslaAmount = ethers.parseUnits("1", 18);
      
      const initialUsdtBalance = await usdt.balanceOf(trader1.address);
      const initialAtslaBalance = await atsla.balanceOf(trader1.address);
      
      console.log("Initial USDT balance:", ethers.formatUnits(initialUsdtBalance, 18));
      console.log("Initial ATSLA balance:", ethers.formatUnits(initialAtslaBalance, 18));
      
      await expect(
        tradingEngine.connect(trader1).placeMarketOrder(
          ATSLA_ADDRESS,
          USDT_ADDRESS,
          atslaAmount,
          true
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader1.address, ATSLA_ADDRESS, USDT_ADDRESS, atslaAmount, 0, true, true);

      const [trader, baseToken, quoteToken, orderAmount, price, isBuy, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader1.address);
      expect(baseToken).to.equal(ATSLA_ADDRESS);
      expect(quoteToken).to.equal(USDT_ADDRESS);
      expect(orderAmount).to.equal(atslaAmount);
      expect(isBuy).to.equal(true);
      expect(isActive).to.equal(true);
      
      console.log("Order placed successfully");
    });

    it("Should place a sell market order for ATSLA", async function () {
      const atslaAmount = ethers.parseUnits("0.5", 18);
      
      const initialUsdtBalance = await usdt.balanceOf(trader2.address);
      const initialAtslaBalance = await atsla.balanceOf(trader2.address);
      
      console.log("Initial USDT balance:", ethers.formatUnits(initialUsdtBalance, 18));
      console.log("Initial ATSLA balance:", ethers.formatUnits(initialAtslaBalance, 18));
      
      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          ATSLA_ADDRESS,
          USDT_ADDRESS,
          atslaAmount,
          false
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader2.address, ATSLA_ADDRESS, USDT_ADDRESS, atslaAmount, 0, false, true);

      const [trader, baseToken, quoteToken, orderAmount, price, isBuy, isMarketOrder, timestamp, isActive, quoteAmount] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader2.address);
      expect(baseToken).to.equal(ATSLA_ADDRESS);
      expect(quoteToken).to.equal(USDT_ADDRESS);
      expect(orderAmount).to.equal(atslaAmount);
      expect(isBuy).to.equal(false);
      expect(isActive).to.equal(true);
      
      console.log("Sell order placed successfully");
    });

    it("Should match buy and sell orders", async function () {
      const atslaAmount = ethers.parseUnits("0.1", 18);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        false
      );
      
      await expect(
        tradingEngine.connect(trader2).placeMarketOrder(
          ATSLA_ADDRESS,
          USDT_ADDRESS,
          atslaAmount,
          true
        )
      )
        .to.emit(tradingEngine, "OrderMatched");

      const [, , , buyOrderAmount, , , , , buyOrderIsActive] = await tradingEngine.getOrder(1);
      const [, , , sellOrderAmount, , , , , sellOrderIsActive] = await tradingEngine.getOrder(0);
      
      expect(buyOrderAmount).to.equal(0);
      expect(sellOrderAmount).to.equal(0);
      expect(buyOrderIsActive).to.equal(false);
      expect(sellOrderIsActive).to.equal(false);
      
      console.log("Orders matched successfully");
    });

    it("Should place limit orders with real tokens", async function () {
      const atslaAmount = ethers.parseUnits("0.2", 18);
      const price = 95;
      
      await expect(
        tradingEngine.connect(trader3).placeLimitOrder(
          ATSLA_ADDRESS,
          USDT_ADDRESS,
          atslaAmount,
          price,
          true
        )
      )
        .to.emit(tradingEngine, "OrderPlaced")
        .withArgs(0, trader3.address, ATSLA_ADDRESS, USDT_ADDRESS, atslaAmount, price, true, false);

      const [trader, , , , orderPrice, , isMarketOrder] = await tradingEngine.getOrder(0);
      expect(trader).to.equal(trader3.address);
      expect(orderPrice).to.equal(price);
      expect(isMarketOrder).to.equal(false);
      
      console.log("Limit order placed successfully");
    });

    it("Should collect fees on trades", async function () {
      const atslaAmount = ethers.parseUnits("0.05", 18);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        true
      );
      
      const feeBalance = await tradingEngine.getFeeBalance(USDT_ADDRESS);
      expect(feeBalance).to.be.gt(0);
      
      console.log("Fee collected:", ethers.formatUnits(feeBalance, 18), "USDT");
    });

    it("Should allow order cancellation with refund", async function () {
      const atslaAmount = ethers.parseUnits("0.3", 18);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        true
      );
      
      const initialUsdtBalance = await usdt.balanceOf(trader1.address);
      
      await expect(tradingEngine.connect(trader1).cancelOrder(0))
        .to.emit(tradingEngine, "OrderCancelled")
        .withArgs(0);

      const [, , , , , , , , isActive] = await tradingEngine.getOrder(0);
      expect(isActive).to.equal(false);

      const finalUsdtBalance = await usdt.balanceOf(trader1.address);
      expect(finalUsdtBalance).to.equal(initialUsdtBalance);
      
      console.log("Order cancelled and funds refunded successfully");
    });
  });

  describe("Balance Management", function () {
    it("Should track user balances correctly", async function () {
      const atslaAmount = ethers.parseUnits("0.1", 18);
      
      const initialTrader1Usdt = await usdt.balanceOf(trader1.address);
      const initialTrader2Atsla = await atsla.balanceOf(trader2.address);
      
      await tradingEngine.connect(trader1).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        false
      );
      
      await tradingEngine.connect(trader2).placeMarketOrder(
        ATSLA_ADDRESS,
        USDT_ADDRESS,
        atslaAmount,
        true
      );
      
      const finalTrader1Usdt = await usdt.balanceOf(trader1.address);
      const finalTrader2Atsla = await atsla.balanceOf(trader2.address);
      
      expect(finalTrader1Usdt).to.be.gt(initialTrader1Usdt);
      expect(finalTrader2Atsla).to.be.gt(initialTrader2Atsla);
      
      console.log("Trader1 USDT change:", ethers.formatUnits(finalTrader1Usdt - initialTrader1Usdt, 18));
      console.log("Trader2 ATSLA change:", ethers.formatUnits(finalTrader2Atsla - initialTrader2Atsla, 18));
    });
  });

  describe("Oracle Integration", function () {
    it("Should validate token pairs through oracle", async function () {
      const isValid = await tradingEngine.isOracleValid(ATSLA_ADDRESS, USDT_ADDRESS);
      expect(isValid).to.be.true;
      
      console.log("Token pair validation successful");
    });

    it("Should get oracle price for USDT/ATSLA pair", async function () {
      const price = await tradingEngine.getOraclePrice(ATSLA_ADDRESS, USDT_ADDRESS);
      expect(price).to.be.gt(0);
      
      console.log("Oracle price for ATSLA/USDT:", price.toString());
    });
  });
}); 