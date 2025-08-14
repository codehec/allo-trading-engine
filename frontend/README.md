# Allo Trading Engine Frontend

A modern React-based frontend for the Allo Trading Engine, built with TypeScript, Tailwind CSS, and Ethers.js.

## Features

- 🔗 **MetaMask Integration** - Connect your wallet seamlessly
- 📊 **Order Book Display** - Real-time view of buy/sell orders
- 💰 **Limit & Market Orders** - Place orders with ease
- 💎 **Token Balances** - View your WETH and USDC balances
- 🌐 **BSC Testnet Support** - Test on Binance Smart Chain testnet
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Real-time Updates** - Live order book and balance updates

## Prerequisites

- Node.js 18+ and npm/yarn
- MetaMask wallet extension
- BSC Testnet tokens (WETH and USDC)

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Browser**
   Navigate to `http://localhost:3000`

4. **Connect Wallet**
   - Click "Connect Wallet" button
   - Approve MetaMask connection
   - Switch to BSC Testnet if prompted

## Configuration

The frontend is configured to work with the deployed contracts on BSC Testnet:

- **Trading Engine**: `0x8ae2557E9acdf7259311200388F9133bEf149340`
- **WETH Token**: `0xdC858B71EE44CaB1F2c39710aDAb399dA1Fb9659`
- **USDC Token**: `0x82f29E95F5474a1c1364a882a8298572e018c59B`
- **Price Oracle**: `0x3AFA4ff8611085b785a7a06dd8CCEFdfbE90B91d`

## Trading Features

### Order Types

- **Limit Orders**: Set your desired price and wait for execution
- **Market Orders**: Execute immediately at current market price

### Order Sides

- **Buy Orders**: Purchase WETH with USDC
- **Sell Orders**: Sell WETH for USDC

### Trading Limits

- **Minimum Order**: 0.01 WETH
- **Maximum Order**: 100 WETH
- **Trading Fee**: 0.05%

## Network Support

- **BSC Testnet** (Chain ID: 97) - Primary network
- **Hardhat Local** (Chain ID: 31337) - Development network

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Navigation and wallet connection
│   ├── TradingInterface.tsx # Main trading layout
│   ├── OrderBook.tsx   # Order book display
│   ├── TradingForm.tsx # Order placement form
│   └── Balances.tsx    # Token balance display
├── contexts/           # React contexts
│   ├── WalletContext.tsx # Wallet connection state
│   └── TradingContext.tsx # Trading operations state
├── types/              # TypeScript type definitions
└── main.tsx           # Application entry point
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Ethers.js 6** - Ethereum interaction
- **Vite** - Build tool
- **React Hot Toast** - Notifications

## Usage Guide

### 1. Wallet Connection

1. Click "Connect Wallet" button
2. Approve MetaMask connection
3. Ensure you're on BSC Testnet
4. Verify your account is displayed

### 2. Viewing Balances

- Token balances are automatically loaded
- Click "Refresh" to update balances
- View total USD value of holdings

### 3. Placing Orders

1. **Select Order Type**: Choose between Limit or Market
2. **Select Order Side**: Buy (green) or Sell (red)
3. **Enter Amount**: Specify WETH amount (0.01 - 100)
4. **Set Price**: For limit orders only
5. **Submit Order**: Review and confirm

### 4. Monitoring Orders

- View active orders in the order book
- Monitor order status and execution
- Cancel orders if needed

## Troubleshooting

### Common Issues

1. **"Wrong Network" Error**
   - Switch to BSC Testnet in MetaMask
   - Use the "Switch Network" button

2. **"Insufficient Balance" Error**
   - Ensure you have enough tokens
   - Check token approvals

3. **"Transaction Failed" Error**
   - Verify gas settings in MetaMask
   - Check if you have enough BNB for gas

### Getting Test Tokens

- **BSC Testnet Faucet**: https://testnet.binance.org/faucet-smart
- **Request WETH and USDC** for testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review contract deployment logs
- Open an issue on GitHub

---

**Note**: This is a testnet deployment. Never use real funds for testing.
