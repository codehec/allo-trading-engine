import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer } from "ethers";

describe("OrderBook", function () {
    let OrderBook: ContractFactory;
    let MockPythFactory: ContractFactory;
    let ERC20MockFactory: ContractFactory;
    let orderBook: any;
    let mockPyth: any;
    let usdc: any;
    
    let owner: Signer;
    let traderBigMoney: Signer;
    let traderLoser: Signer;
    let liquidator: Signer;
    
    let ownerAddress: string;
    let traderBigMoneyAddress: string;
    let traderLoserAddress: string;
    let liquidatorAddress: string;
    
    const PAIR_INDEX_ETHER = 0;
    const PAIR_INDEX_BTC = 1;
    const INVALID_PAIR_INDEX = 5;
    const AMOUNT_COLLATERAL = ethers.parseEther("1000");
    const LEVERAGE = ethers.getBigInt("10000000");
    const MAX_LEVERAGE = ethers.getBigInt("150000000");
    const OVER_LEVERAGED = ethers.getBigInt("151000000");
    const ORDER_TYPE_LONG = 0;
    const ORDER_TYPE_SHORT = 1;
    const MAX_OPEN_INTEREST = ethers.parseEther("500000");
    
    const ETH_PRICE_ID = "0x000000000000000000000000000000000000000000000000000000000000abcd";
    const BTC_PRICE_ID = "0x0000000000000000000000000000000000000000000000000000000000001234";
    
    const USER_TRADE_INDEX_FIRST = 2;
    const USER_TRADE_INDEX_SECOND = 1;
    const USER_TRADE_INDEX_THIRD = 0;
    
    const MAX_OPEN_INTEREST_ARRAY = [MAX_OPEN_INTEREST, MAX_OPEN_INTEREST];
    
    let priceFeedIds: string[];
    let pairIndexes: number[];
    let pairSymbols: string[];
    let pythUpdateDataArray: any[];
    
    beforeEach(async function () {
        [owner, traderBigMoney, traderLoser, liquidator] = await ethers.getSigners();
        
        ownerAddress = await owner.getAddress();
        traderBigMoneyAddress = await traderBigMoney.getAddress();
        traderLoserAddress = await traderLoser.getAddress();
        liquidatorAddress = await liquidator.getAddress();
        
        console.log("Deploying MockPyth...");
        MockPythFactory = await ethers.getContractFactory("MockPyth");
        mockPyth = await MockPythFactory.deploy();
        await mockPyth.waitForDeployment();
        console.log("MockPyth deployed at:", await mockPyth.getAddress());
        
        console.log("Deploying ERC20Mock...");
        ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
        usdc = await ERC20MockFactory.deploy("USDC", "USDC");
        await usdc.waitForDeployment();
        console.log("ERC20Mock deployed at:", await usdc.getAddress());
        
        priceFeedIds = [ETH_PRICE_ID, BTC_PRICE_ID];
        pairIndexes = [0, 1];
        pairSymbols = ["ETH/USD", "BTC/USD"];
        
        console.log("Deploying OrderBook...");
        OrderBook = await ethers.getContractFactory("OrderBook");
        orderBook = await OrderBook.deploy(
            await mockPyth.getAddress(),
            await usdc.getAddress(),
            priceFeedIds,
            MAX_OPEN_INTEREST_ARRAY,
            pairIndexes,
            pairSymbols
        );
        await orderBook.waitForDeployment();
        console.log("OrderBook deployed at:", await orderBook.getAddress());
        
        const ethPrice = 1000;
        
        await mockPyth.createPriceFeedUpdateData(
            ETH_PRICE_ID,
            ethPrice * 100000,
            10 * 100000,
            -5,
            ethPrice * 100000,
            10 * 100000,
            Math.floor(Date.now() / 1000)
        );
        
        const updateData = ethers.randomBytes(32);
        pythUpdateDataArray = [updateData];
        
        await usdc.mint(traderBigMoneyAddress, ethers.parseEther("1000000"));
        await usdc.mint(traderLoserAddress, ethers.parseEther("1000000"));
        
        await usdc.connect(traderBigMoney).approve(await orderBook.getAddress(), ethers.MaxUint256);
        await usdc.connect(traderLoser).approve(await orderBook.getAddress(), ethers.MaxUint256);
    });
    
    describe("Constructor", function () {
        it("Should revert if array lengths don't match", async function () {
            const invalidPriceFeedIds = [ETH_PRICE_ID, BTC_PRICE_ID];
            const invalidPairIndexes = [0];
            const invalidPairSymbols = ["ETH/USD"];
            
            await expect(
                OrderBook.deploy(
                    await mockPyth.getAddress(),
                    await usdc.getAddress(),
                    invalidPriceFeedIds,
                    MAX_OPEN_INTEREST_ARRAY,
                    invalidPairIndexes,
                    invalidPairSymbols
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__ArrayLengthsMustMatch");
        });
        
        it("Should deploy successfully with valid parameters", async function () {
            console.log("OrderBook address:", await orderBook.getAddress());
            console.log("USDC address:", await usdc.getAddress());
            console.log("MockPyth address:", await mockPyth.getAddress());
            
            const collateralAddress = await orderBook.getCollateralTokenAddress();
            const oracleAddress = await orderBook.getPriceOracleAddress();
            
            console.log("Collateral address from contract:", collateralAddress);
            console.log("Oracle address from contract:", oracleAddress);
            
            expect(collateralAddress).to.equal(await usdc.getAddress());
            expect(oracleAddress).to.equal(await mockPyth.getAddress());
        });
    });
    
    describe("Market Orders", function () {
        it("Should open a long position with correct price", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const positionDetails = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST
            );
            
            const expectedOpenPrice = ethers.getBigInt("101000000000");
            expect(positionDetails.entryPrice).to.equal(expectedOpenPrice);
        });
        
        it("Should open a short position with correct price", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const positionDetails = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST
            );
            
            const expectedOpenPrice = ethers.getBigInt("99000000000");
            expect(positionDetails.entryPrice).to.equal(expectedOpenPrice);
        });
        
        it("Should record market order correctly", async function () {
            const initialBalance = await usdc.balanceOf(traderBigMoneyAddress);
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const totalLongAmount = await orderBook.getTotalLongAmount(PAIR_INDEX_ETHER);
            expect(totalLongAmount).to.be.gt(0);
            
            const positionDetails = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST
            );
            
            expect(positionDetails.assetPairId).to.equal(PAIR_INDEX_ETHER);
            expect(positionDetails.leverageMultiplier).to.equal(LEVERAGE);
        });
        
        it("Should allow opening and closing trades", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await ethers.provider.send("evm_increaseTime", [13 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);
            
            await orderBook.connect(traderBigMoney).closePosition(
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
        });
        
        it("Should allow opening max trades per pair", async function () {
            const btcPrice = 2000;
            
            await mockPyth.createPriceFeedUpdateData(
                BTC_PRICE_ID,
                btcPrice * 100000,
                10 * 100000,
                -5,
                btcPrice * 100000,
                10 * 100000,
                Math.floor(Date.now() / 1000)
            );
            
            const btcUpdateData = ethers.randomBytes(32);
            const btcUpdateDataArray = [btcUpdateData];
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_BTC,
                AMOUNT_COLLATERAL + ethers.parseEther("100"),
                LEVERAGE,
                ORDER_TYPE_LONG,
                btcUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_BTC,
                AMOUNT_COLLATERAL + ethers.parseEther("200"),
                LEVERAGE,
                ORDER_TYPE_SHORT,
                btcUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_BTC,
                AMOUNT_COLLATERAL + ethers.parseEther("300"),
                LEVERAGE,
                ORDER_TYPE_LONG,
                btcUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const allPositions = await orderBook.getAllUserPositions(traderBigMoneyAddress);
            expect(allPositions.length).to.equal(15);
        });
    });
    
    describe("Limit Orders", function () {
        it("Should place and execute limit order", async function () {
            const targetPrice = ethers.getBigInt("100000000000");
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            const allLimitOrders = await orderBook.getAllUserLimitOrders(traderBigMoneyAddress);
            
            let foundOrder = false;
            for (let i = 0; i < allLimitOrders.length; i++) {
                if (allLimitOrders[i].executionPrice === targetPrice) {
                    foundOrder = true;
                    expect(allLimitOrders[i].executionPrice).to.equal(targetPrice);
                    break;
                }
            }
            expect(foundOrder).to.be.true;
            
            await orderBook.connect(traderLoser).executeLimitOrder(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                2,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
        });
        
        it("Should revert if price slippage is too high", async function () {
            const targetPrice = ethers.getBigInt("100000000000");
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            const ethPrice = 1060;
            
            await mockPyth.createPriceFeedUpdateData(
                ETH_PRICE_ID,
                ethPrice * 100000,
                10 * 100000,
                -5,
                ethPrice * 100000,
                10 * 100000,
                Math.floor(Date.now() / 1000)
            );
            
            const updateData = ethers.randomBytes(32);
            const updateDataArray = [updateData];
            
            await expect(
                orderBook.connect(traderLoser).executeLimitOrder(
                    traderBigMoneyAddress,
                    PAIR_INDEX_ETHER,
                    2,
                    updateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__SlippageExceedsMaximum");
        });
        
        it("Should revert if more than three limit orders", async function () {
            const targetPrice = ethers.getBigInt("100000000000");
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            await expect(
                orderBook.connect(traderBigMoney).createLimitOrder(
                    PAIR_INDEX_ETHER,
                    AMOUNT_COLLATERAL,
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    targetPrice
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__MaximumOpenPositionsReached");
        });
        
        it("Should revert if max 3 trades with mixed limit and market orders", async function () {
            const targetPrice = ethers.getBigInt("100000000000");
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            await orderBook.connect(traderBigMoney).createLimitOrder(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                targetPrice
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await expect(
                orderBook.connect(traderBigMoney).createLimitOrder(
                    PAIR_INDEX_ETHER,
                    AMOUNT_COLLATERAL,
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    targetPrice
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__MaximumOpenPositionsReached");
        });
    });
    
    describe("Modifiers", function () {
        it("Should only allow three open trades per pair", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    AMOUNT_COLLATERAL,
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__MaximumOpenPositionsReached");
        });
        
        it("Should enforce max leverage of 150", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                MAX_LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    AMOUNT_COLLATERAL,
                    OVER_LEVERAGED,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__LeverageExceedsMaximum");
        });
        
        it("Should only allow trades with valid pairs", async function () {
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    INVALID_PAIR_INDEX,
                    AMOUNT_COLLATERAL,
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__InvalidAssetPair");
        });
        
        it("Should not allow trades with zero amounts", async function () {
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    0,
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__ValueMustBeGreaterThanZero");
            
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    AMOUNT_COLLATERAL,
                    0,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__ValueMustBeGreaterThanZero");
        });
        
        it("Should enforce max open interest for longs", async function () {
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    MAX_OPEN_INTEREST + ethers.parseEther("1"),
                    LEVERAGE,
                    ORDER_TYPE_LONG,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__LongPositionLimitReached");
        });
        
        it("Should enforce max open interest for shorts", async function () {
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    MAX_OPEN_INTEREST + ethers.parseEther("1"),
                    LEVERAGE,
                    ORDER_TYPE_SHORT,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__ShortPositionLimitReached");
        });
        
        it("Should revert if closing non-existing position", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await expect(
                orderBook.connect(traderBigMoney).closePosition(
                    PAIR_INDEX_ETHER,
                    0,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__PositionDoesNotExist");
        });
        
        it("Should enforce minimum trade size", async function () {
            const collateralTooSmall = ethers.parseEther("10");
            
            await expect(
                orderBook.connect(traderBigMoney).openMarketPosition(
                    PAIR_INDEX_ETHER,
                    collateralTooSmall,
                    LEVERAGE,
                    ORDER_TYPE_SHORT,
                    pythUpdateDataArray,
                    { value: ethers.parseEther("0.001") }
                )
            ).to.be.revertedWithCustomError(orderBook, "OrderBook__PositionSizeBelowMinimum");
        });
    });
    
    describe("View and Getter Functions", function () {
        it("Should get current borrow rate for pair", async function () {
            const currentRate = await orderBook.getCurrentInterestRate(PAIR_INDEX_ETHER);
            expect(currentRate).to.be.gte(0);
        });
        
        it("Should get all user open trades", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const allPositions = await orderBook.getAllUserPositions(traderBigMoneyAddress);
            expect(allPositions.length).to.equal(15);
        });
        
        it("Should get user open trades for specific asset", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const tradeSlots = await orderBook.getUserActivePositions(traderBigMoneyAddress, PAIR_INDEX_ETHER);
            expect(tradeSlots[2]).to.equal(1);
        });
        
        it("Should get liquidation price for short position", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const [liquidationPrice, borrowFee] = await orderBook.getLiquidationPrice(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST
            );
            
            expect(liquidationPrice).to.be.gt(0);
            expect(borrowFee).to.be.gte(0);
        });
        
        it("Should get liquidation price for long position", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await ethers.provider.send("evm_increaseTime", [52 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);
            
            const [liquidationPrice, borrowFee] = await orderBook.getLiquidationPrice(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST
            );
            
            expect(liquidationPrice).to.be.gt(0);
            expect(borrowFee).to.be.gte(0);
        });
    });
    
    describe("Liquidation", function () {
        it("Should liquidate user by price change", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine", []);
            
            const ethPrice = 900;
            
            await mockPyth.createPriceFeedUpdateData(
                ETH_PRICE_ID,
                ethPrice * 100000,
                10 * 100000,
                -5,
                ethPrice * 100000,
                10 * 100000,
                Math.floor(Date.now() / 1000)
            );
            
            const updateData = ethers.randomBytes(32);
            const updateDataArray = [updateData];
            
            await orderBook.connect(liquidator).liquidatePosition(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST,
                updateDataArray,
                { value: ethers.parseEther("0.001") }
            );
        });
        
        it("Should liquidate user by borrow fees", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await ethers.provider.send("evm_increaseTime", [65 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);
            
            const ethPrice = 1020;
            
            await mockPyth.createPriceFeedUpdateData(
                ETH_PRICE_ID,
                ethPrice * 100000,
                10 * 100000,
                -5,
                ethPrice * 100000,
                10 * 100000,
                Math.floor(Date.now() / 1000)
            );
            
            const updateData = ethers.randomBytes(32);
            const updateDataArray = [updateData];
            
            await orderBook.connect(liquidator).liquidatePosition(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST,
                updateDataArray,
                { value: ethers.parseEther("0.001") }
            );
        });
    });
    
    describe("Trade Management", function () {
        it("Should open and close trades correctly", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const allPositions = await orderBook.getAllUserPositions(traderBigMoneyAddress);
            let openPositionCount = 0;
            for (let i = 0; i < allPositions.length; i++) {
                if (allPositions[i].leverageMultiplier !== 0n) {
                    openPositionCount++;
                }
            }
            expect(openPositionCount).to.equal(3);
            
            await ethers.provider.send("evm_increaseTime", [1000]);
            await ethers.provider.send("evm_mine", []);
            
            const ethPrice = 500;
            
            await mockPyth.createPriceFeedUpdateData(
                ETH_PRICE_ID,
                ethPrice * 100000,
                10 * 100000,
                -5,
                ethPrice * 100000,
                10 * 100000,
                Math.floor(Date.now() / 1000)
            );
            
            const updateData = ethers.randomBytes(32);
            const updateDataArray = [updateData];
            
            await orderBook.connect(traderBigMoney).closePosition(
                PAIR_INDEX_ETHER,
                USER_TRADE_INDEX_FIRST,
                updateDataArray,
                { value: ethers.parseEther("0.001") }
            );
        
            const positionsAfterClose = await orderBook.getAllUserPositions(traderBigMoneyAddress);
            let openPositionCountAfterClose = 0;
            for (let i = 0; i < positionsAfterClose.length; i++) {
                if (positionsAfterClose[i].leverageMultiplier !== 0n) {
                    openPositionCountAfterClose++;
                }
            }
            expect(openPositionCountAfterClose).to.equal(2);
        });
        
        it("Should allow different users to open and close trades", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderLoser).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderLoser).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderLoser).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const bigMoneyPositions = await orderBook.getAllUserPositions(traderBigMoneyAddress);
            const loserPositions = await orderBook.getAllUserPositions(traderLoserAddress);
            
            expect(bigMoneyPositions.length).to.equal(15);
            expect(loserPositions.length).to.equal(15);
        });
    });
    
    describe("Ownership", function () {
        it("Should allow ownership transfer", async function () {
            await orderBook.connect(owner).transferOwnership(traderBigMoneyAddress);
            expect(await orderBook.owner()).to.equal(traderBigMoneyAddress);
        });
    });
    
    describe("Market Order Storage", function () {
        it("Should correctly store market orders in mapping", async function () {
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_SHORT,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            await orderBook.connect(traderBigMoney).openMarketPosition(
                PAIR_INDEX_ETHER,
                AMOUNT_COLLATERAL,
                LEVERAGE,
                ORDER_TYPE_LONG,
                pythUpdateDataArray,
                { value: ethers.parseEther("0.001") }
            );
            
            const firstTrade = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                1
            );
            
            const secondTrade = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                2
            );
            
            const thirdTrade = await orderBook.getUserPositionDetails(
                traderBigMoneyAddress,
                PAIR_INDEX_ETHER,
                3
            );
            
            expect(firstTrade.assetPairId).to.equal(PAIR_INDEX_ETHER);
            expect(secondTrade.assetPairId).to.equal(PAIR_INDEX_ETHER);
            expect(thirdTrade.assetPairId).to.equal(PAIR_INDEX_ETHER);
        });
    });
});
