import { ethers } from "hardhat";

// BSC Token Addresses
const USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
const ATSLA_ADDRESS = "0x38B3608a3cECaF6fB6076BE8d69B9D297F9af018";

// Known rich accounts on BSC (you can replace these with any accounts that have USDT/ATSLA)
const RICH_ACCOUNTS = [
  "0x8894e0a0c962cb723c1976a4421c95949be2d4e3", // Binance Hot Wallet
  "0x28c6c06298d514db089934071355e5743bf21d60", // Binance Hot Wallet 2
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549", // Binance Hot Wallet 3
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

async function main() {
  console.log("Setting up BSC fork test environment...");
  
  // Get signers
  const [owner, trader1, trader2, trader3] = await ethers.getSigners();
  
  // Connect to real token contracts
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, ethers.provider) as any;
  const atsla = new ethers.Contract(ATSLA_ADDRESS, ERC20_ABI, ethers.provider) as any;
  
  console.log("Connected to tokens:");
  console.log("USDT:", USDT_ADDRESS);
  console.log("ATSLA:", ATSLA_ADDRESS);
  
  // Check token symbols
  const usdtSymbol = await usdt.symbol();
  const atslaSymbol = await atsla.symbol();
  console.log("USDT Symbol:", usdtSymbol);
  console.log("ATSLA Symbol:", atslaSymbol);
  
  // Find an account with USDT balance
  let richAccount = null;
  let richAccountAddress = "";
  
  for (const account of RICH_ACCOUNTS) {
    try {
      const balance = await usdt.balanceOf(account);
      console.log(`Account ${account} has ${ethers.formatUnits(balance, 18)} USDT`);
      
      if (balance > ethers.parseUnits("10000", 18)) { // At least 10k USDT
        richAccountAddress = account;
        break;
      }
    } catch (error: any) {
      console.log(`Error checking account ${account}:`, error.message);
    }
  }
  
  if (!richAccountAddress) {
    console.log("No rich account found with sufficient USDT balance");
    console.log("You may need to manually fund the test accounts or use a different account");
    return;
  }
  
  console.log(`Using rich account: ${richAccountAddress}`);
  
  // Impersonate the rich account
  await ethers.provider.send("hardhat_impersonateAccount", [richAccountAddress]);
  richAccount = await ethers.getSigner(richAccountAddress);
  
  // Fund the account with some BNB for gas
  await owner.sendTransaction({
    to: richAccountAddress,
    value: ethers.parseEther("10")
  });
  
  // Get balances
  const usdtBalance = await usdt.balanceOf(richAccountAddress);
  const atslaBalance = await atsla.balanceOf(richAccountAddress);
  
  console.log(`Rich account balances:`);
  console.log(`USDT: ${ethers.formatUnits(usdtBalance, 18)}`);
  console.log(`ATSLA: ${ethers.formatUnits(atslaBalance, 18)}`);
  
  // Distribute tokens to test accounts
  const testAccounts = [trader1.address, trader2.address, trader3.address];
  const usdtAmount = ethers.parseUnits("1000", 18); // 1000 USDT each
  const atslaAmount = ethers.parseUnits("10", 18);   // 10 ATSLA each
  
  console.log("\nDistributing tokens to test accounts...");
  
  for (const account of testAccounts) {
    try {
      // Transfer USDT
      const usdtTx = await usdt.connect(richAccount).transfer(account, usdtAmount);
      await usdtTx.wait();
      console.log(`Transferred ${ethers.formatUnits(usdtAmount, 18)} USDT to ${account}`);
      
      // Transfer ATSLA
      const atslaTx = await atsla.connect(richAccount).transfer(account, atslaAmount);
      await atslaTx.wait();
      console.log(`Transferred ${ethers.formatUnits(atslaAmount, 18)} ATSLA to ${account}`);
      
    } catch (error: any) {
      console.log(`Error transferring to ${account}:`, error.message);
    }
  }
  
  // Verify distributions
  console.log("\nVerifying token distributions...");
  
  for (const account of testAccounts) {
    const usdtBalance = await usdt.balanceOf(account);
    const atslaBalance = await atsla.balanceOf(account);
    
    console.log(`Account ${account}:`);
    console.log(`  USDT: ${ethers.formatUnits(usdtBalance, 18)}`);
    console.log(`  ATSLA: ${ethers.formatUnits(atslaBalance, 18)}`);
  }
  
  console.log("\nBSC fork test environment setup complete!");
  console.log("You can now run the BSC fork tests with:");
  console.log("npx hardhat test test/TradingEngineBSC.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 