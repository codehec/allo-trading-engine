# Allo Trading Engine Frontend Demo

This guide will walk you through testing the trading frontend with the deployed contracts on BSC Testnet.

## 🚀 Quick Demo Setup

1. **Start the Frontend**
   ```bash
   cd frontend
   ./setup.sh
   ```

2. **Open Browser**
   Navigate to `http://localhost:3000`

## 🔗 Wallet Connection Demo

1. **Connect MetaMask**
   - Click "Connect Wallet" button
   - Approve connection in MetaMask
   - Verify account address is displayed

2. **Network Verification**
   - Ensure you're on BSC Testnet (Chain ID: 97)
   - Use "Switch Network" button if needed
   - Green dot should indicate correct network

## 💰 Balance Display Demo

1. **View Token Balances**
   - WETH balance should be displayed
   - USDC balance should be displayed
   - Total USD value calculated automatically

2. **Refresh Balances**
   - Click "Refresh" button
   - Watch loading spinner
   - Verify balances update

## 📊 Order Book Demo

1. **View Order Book**
   - Sell orders (red) at top
   - Current market price in center
   - Buy orders (green) at bottom
   - Order statistics displayed

2. **Mock Data**
   - Sample buy order: 0.5 WETH at $2,000
   - Sample sell order: 0.3 WETH at $2,005
   - Order timestamps and amounts

## 🎯 Trading Demo

### Limit Order Demo

1. **Select Limit Order**
   - Click "Limit" button (blue highlight)
   - Verify price input field appears

2. **Set Order Parameters**
   - Choose "Buy" (green) or "Sell" (red)
   - Enter amount: 0.1 WETH
   - Set price: $2,000 USDC
   - Verify total calculation: $200 USDC

3. **Submit Order**
   - Click order button
   - Approve token spending in MetaMask
   - Watch transaction confirmation
   - Verify success toast notification

### Market Order Demo

1. **Select Market Order**
   - Click "Market" button (blue highlight)
   - Verify price input field disappears

2. **Set Order Parameters**
   - Choose "Buy" or "Sell"
   - Enter amount: 0.05 WETH
   - No price needed for market orders

3. **Submit Order**
   - Click order button
   - Approve token spending
   - Watch immediate execution
   - Verify success notification

## 🔄 Real-time Updates Demo

1. **Refresh Data**
   - Click "Refresh" button in header
   - Watch order book update
   - Verify balances refresh
   - Check loading states

2. **Order Placement**
   - Place a new order
   - Watch order book update
   - Verify balance changes
   - Check order statistics

## 📱 Responsive Design Demo

1. **Desktop View**
   - Full 3-column layout
   - Order book, trading form, balances
   - Hover effects and animations

2. **Mobile View**
   - Resize browser window
   - Single column layout
   - Touch-friendly buttons
   - Responsive grid system

## 🎨 UI Components Demo

1. **Color Scheme**
   - Green for buy orders
   - Red for sell orders
   - Blue for primary actions
   - Gray for secondary elements

2. **Interactive Elements**
   - Hover effects on cards
   - Loading spinners
   - Toast notifications
   - Button state changes

3. **Typography**
   - Clear hierarchy with font weights
   - Monospace for addresses
   - Responsive text sizing
   - Consistent spacing

## 🧪 Error Handling Demo

1. **Network Errors**
   - Switch to wrong network
   - Verify error message
   - Use "Switch Network" button

2. **Validation Errors**
   - Try invalid amounts
   - Submit without required fields
   - Verify error messages

3. **Transaction Errors**
   - Insufficient balance
   - Gas limit issues
   - Network congestion

## 📊 Performance Demo

1. **Loading States**
   - Connect wallet
   - Refresh data
   - Place orders
   - Verify smooth transitions

2. **Responsiveness**
   - Quick button clicks
   - Form interactions
   - Real-time updates
   - Smooth animations

## 🔧 Configuration Demo

1. **Contract Addresses**
   - Verify correct addresses in config
   - Check network compatibility
   - Test contract interactions

2. **Trading Limits**
   - Try minimum order (0.01 WETH)
   - Try maximum order (100 WETH)
   - Verify validation messages

## 🎯 Success Criteria

The demo is successful when:

✅ Wallet connects to BSC Testnet  
✅ Token balances display correctly  
✅ Order book shows mock data  
✅ Limit orders can be placed  
✅ Market orders can be placed  
✅ Real-time updates work  
✅ Responsive design functions  
✅ Error handling works  
✅ UI is polished and professional  

## 🚨 Troubleshooting

If something doesn't work:

1. **Check Console**
   - Open browser developer tools
   - Look for JavaScript errors
   - Verify network requests

2. **Check MetaMask**
   - Ensure correct network
   - Verify account unlocked
   - Check transaction history

3. **Check Contracts**
   - Verify contract addresses
   - Check BSC Testnet status
   - Verify contract deployment

## 🎉 Demo Complete!

You've successfully tested all major features of the Allo Trading Engine Frontend. The interface provides a professional, user-friendly way to interact with the trading smart contracts on BSC Testnet.
