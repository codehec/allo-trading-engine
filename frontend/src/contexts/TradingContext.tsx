import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './WalletContext'
import toast from 'react-hot-toast'
import CONFIG from '../config'

// Contract ABIs
const TRADING_ENGINE_ABI = [
  'function placeLimitOrder(address baseToken, address quoteToken, uint256 amount, uint256 price, bool isBuy) external returns (uint256)',
  'function placeMarketOrder(address baseToken, address quoteToken, uint256 amount, bool isBuy) external returns (uint256)',
  'function cancelOrder(uint256 orderId) external',
  'function getOrderBookStats() external view returns (uint256, uint256, uint256, uint256)',
  'function isTradingPairAllowed(address baseToken, address quoteToken) external view returns (bool)',
  'function getOrder(uint256 orderId) external view returns (address, address, address, uint256, uint256, bool, bool, uint256, uint256, uint256)',
]

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
]

interface Order {
  id: number
  trader: string
  baseToken: string
  quoteToken: string
  amount: string
  price: string
  isBuy: boolean
  isMarketOrder: boolean
  timestamp: number
  isActive: boolean
  quoteAmount: string
  filledAmount: string
}

interface TokenBalance {
  symbol: string
  name: string
  balance: string
  decimals: number
  address: string
}

interface TradingContextType {
  // Order book
  orderBook: {
    buyOrders: Order[]
    sellOrders: Order[]
    stats: {
      totalBuyOrders: number
      totalSellOrders: number
      activeBuyOrders: number
      activeSellOrders: number
    }
  }
  
  // Balances
  balances: TokenBalance[]
  
  // Trading functions
  placeLimitOrder: (baseToken: string, quoteToken: string, amount: string, price: string, isBuy: boolean) => Promise<void>
  placeMarketOrder: (baseToken: string, quoteToken: string, amount: string, isBuy: boolean) => Promise<void>
  cancelOrder: (orderId: number) => Promise<void>
  
  // Utility functions
  refreshOrderBook: () => Promise<void>
  refreshBalances: () => Promise<void>
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<void>
  checkTokenAllowance: (tokenAddress: string, spenderAddress: string) => Promise<string>
  
  // Loading states
  isLoading: boolean
  isPlacingOrder: boolean
}

const TradingContext = createContext<TradingContextType | undefined>(undefined)

export const useTrading = () => {
  const context = useContext(TradingContext)
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider')
  }
  return context
}

interface TradingProviderProps {
  children: ReactNode
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  const { provider, signer, account, isConnected } = useWallet()
  
  const [orderBook, setOrderBook] = useState<{
    buyOrders: Order[]
    sellOrders: Order[]
    stats: {
      totalBuyOrders: number
      totalSellOrders: number
      activeBuyOrders: number
      activeSellOrders: number
    }
  }>({
    buyOrders: [],
    sellOrders: [],
    stats: {
      totalBuyOrders: 0,
      totalSellOrders: 0,
      activeBuyOrders: 0,
      activeSellOrders: 0,
    }
  })
  
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  // Initialize contracts when wallet connects
  useEffect(() => {
    if (isConnected) {
      console.log('Wallet connected, initializing contracts and fetching data...')
      refreshOrderBook()
      refreshBalances()
    }
  }, [isConnected])

  // Auto-refresh orderbook every 5 seconds when connected
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(async () => {
      try {
        // Only refresh if not already loading
        if (!isLoading) {
          await refreshOrderBook()
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error)
        // Don't show toast for auto-refresh errors to avoid spam
      }
    }, 5000) // 5 seconds

    return () => clearInterval(interval)
  }, [isConnected, isLoading])

  const getContract = (address: string, abi: any) => {
    if (!signer) {
      console.error('getContract: Signer not available')
      throw new Error('Signer not available')
    }
    
    console.log('getContract: Creating contract instance', { address, hasSigner: !!signer })
    const contract = new ethers.Contract(address, abi, signer)
    console.log('getContract: Contract created successfully', { address, contract: !!contract })
    return contract
  }

  const validateTokenContract = async (tokenAddress: string, expectedSymbol: string) => {
    try {
      const contract = getContract(tokenAddress, ERC20_ABI)
      
      // Try to call basic ERC20 functions to validate the contract
      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(account),
        contract.decimals(),
        contract.symbol(),
      ])
      
      console.log(`Token validation successful for ${expectedSymbol}:`, {
        address: tokenAddress,
        balance: balance.toString(),
        decimals: decimals.toString(),
        symbol: symbol
      })
      
      return true
    } catch (error) {
      console.error(`Token validation failed for ${expectedSymbol} at ${tokenAddress}:`, error)
      return false
    }
  }

  const refreshOrderBook = async () => {
    if (!isConnected) return

    setIsLoading(true)
    try {
      const tradingEngine = getContract(CONFIG.TRADING_ENGINE_ADDRESS, TRADING_ENGINE_ABI)
      const stats = await tradingEngine.getOrderBookStats()
      
      // For now, we'll use mock data since the contract doesn't have a getOrderBook function
      // In a real implementation, you'd fetch actual orders from the contract
      const mockBuyOrders: Order[] = [
        {
          id: 1,
          trader: '0x1234...',
          baseToken: CONFIG.WETH_ADDRESS,
          quoteToken: CONFIG.USDC_ADDRESS,
          amount: '0.5',
          price: '2000',
          isBuy: true,
          isMarketOrder: false,
          timestamp: Date.now() - 1000000,
          isActive: true,
          quoteAmount: '1000',
          filledAmount: '0',
        }
      ]
      
      const mockSellOrders: Order[] = [
        {
          id: 2,
          trader: '0x5678...',
          baseToken: CONFIG.WETH_ADDRESS,
          quoteToken: CONFIG.USDC_ADDRESS,
          amount: '0.3',
          price: '2005',
          isBuy: false,
          isMarketOrder: false,
          timestamp: Date.now() - 500000,
          isActive: true,
          quoteAmount: '601.5',
          filledAmount: '0',
        }
      ]

      setOrderBook({
        buyOrders: mockBuyOrders,
        sellOrders: mockSellOrders,
        stats: {
          totalBuyOrders: Number(stats[2]),
          totalSellOrders: Number(stats[3]),
          activeBuyOrders: Number(stats[0]),
          activeSellOrders: Number(stats[1]),
        }
      })
    } catch (error) {
      console.error('Error refreshing order book:', error)
      toast.error('Failed to refresh order book')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshBalances = async () => {
    if (!isConnected || !provider) return

    console.log('Starting balance refresh...', { account, provider: !!provider })

    try {
      const tokens = [
        { address: CONFIG.WETH_ADDRESS, symbol: 'WETH', name: 'Wrapped Ether' },
        { address: CONFIG.USDC_ADDRESS, symbol: 'USDC', name: 'USD Coin' },
      ]

      console.log('Token addresses to check:', tokens.map(t => ({ symbol: t.symbol, address: t.address })))

      const balancePromises = tokens.map(async (token) => {
        try {
          console.log(`Fetching balance for ${token.symbol} at ${token.address}...`)
          const contract = getContract(token.address, ERC20_ABI)
          
          // Get balance first - this is the most important call
          const balance = await contract.balanceOf(account)
          console.log(`${token.symbol} raw balance:`, balance.toString())
          
          // Try to get token metadata, with fallbacks
          let decimals = 18
          let symbol = token.symbol
          let name = token.name
          
          try {
            decimals = await contract.decimals()
            console.log(`${token.symbol} decimals:`, decimals)
          } catch (error) {
            console.warn(`Failed to get decimals for ${token.symbol}, using default 18:`, error)
          }
          
          try {
            symbol = await contract.symbol()
            console.log(`${token.symbol} symbol:`, symbol)
          } catch (error) {
            console.warn(`Failed to get symbol for ${token.symbol}, using fallback:`, error)
          }
          
          try {
            name = await contract.name()
            console.log(`${token.symbol} name:`, name)
          } catch (error) {
            console.warn(`Failed to get name for ${token.symbol}, using fallback:`, error)
          }

          const formattedBalance = ethers.formatUnits(balance, decimals)
          console.log(`${token.symbol} formatted balance:`, formattedBalance)

          return {
            symbol,
            name,
            balance: formattedBalance,
            decimals,
            address: token.address,
          }
        } catch (error) {
          console.error(`Error getting balance for ${token.symbol}:`, error)
          // Return a fallback balance object with zero balance
          return {
            symbol: token.symbol,
            name: token.name,
            balance: '0',
            decimals: 18,
            address: token.address,
          }
        }
      })

      console.log('Waiting for all balance promises to resolve...')
      const tokenBalances = await Promise.all(balancePromises)
      console.log('All balances resolved:', tokenBalances)
      
      setBalances(tokenBalances)
      console.log('Balances state updated successfully')
    } catch (error) {
      console.error('Error refreshing balances:', error)
      toast.error('Failed to refresh balances')
    }
  }

  const approveToken = async (tokenAddress: string, spenderAddress: string, amount: string) => {
    if (!isConnected) throw new Error('Wallet not connected')

    try {
      const tokenContract = getContract(tokenAddress, ERC20_ABI)
      const decimals = await tokenContract.decimals()
      const amountWei = ethers.parseUnits(amount, decimals)
      
      const tx = await tokenContract.approve(spenderAddress, amountWei)
      await tx.wait()
      
      toast.success('Token approved successfully!')
    } catch (error: any) {
      console.error('Error approving token:', error)
      toast.error(error.message || 'Failed to approve token')
      throw error
    }
  }

  const checkTokenAllowance = async (tokenAddress: string, spenderAddress: string) => {
    if (!isConnected) throw new Error('Wallet not connected')

    try {
      const tokenContract = getContract(tokenAddress, ERC20_ABI)
      
      // Get allowance first
      const allowance = await tokenContract.allowance(account, spenderAddress)
      
      // Try to get decimals, with fallback
      let decimals = 18
      try {
        decimals = await tokenContract.decimals()
      } catch (error) {
        console.warn(`Failed to get decimals for token ${tokenAddress}, using default 18:`, error)
      }
      
      return ethers.formatUnits(allowance, decimals)
    } catch (error: any) {
      console.error('Error checking token allowance:', error)
      
      // Don't show toast for allowance check errors to avoid spam
      // Just return '0' as fallback
      return '0'
    }
  }

  const placeLimitOrder = async (baseToken: string, quoteToken: string, amount: string, price: string, isBuy: boolean) => {
    if (!isConnected) throw new Error('Wallet not connected')

    setIsPlacingOrder(true)
    try {
      // Check if trading pair is allowed
      const tradingEngine = getContract(CONFIG.TRADING_ENGINE_ADDRESS, TRADING_ENGINE_ABI)
      const isAllowed = await tradingEngine.isTradingPairAllowed(baseToken, quoteToken)
      
      if (!isAllowed) {
        throw new Error('Trading pair not allowed')
      }

      // Get token decimals
      const baseTokenContract = getContract(baseToken, ERC20_ABI)
      const quoteTokenContract = getContract(quoteToken, ERC20_ABI)
      const [baseDecimals, quoteDecimals] = await Promise.all([
        baseTokenContract.decimals(),
        quoteTokenContract.decimals(),
      ])

      // Parse amounts
      const amountWei = ethers.parseUnits(amount, baseDecimals)
      const priceWei = ethers.parseUnits(price, quoteDecimals)

      // Check if user has approved the trading engine
      const allowance = await baseTokenContract.allowance(account, CONFIG.TRADING_ENGINE_ADDRESS)
      if (allowance < amountWei) {
        await approveToken(baseToken, CONFIG.TRADING_ENGINE_ADDRESS, amount)
      }

      // Place the order
      const tx = await tradingEngine.placeLimitOrder(baseToken, quoteToken, amountWei, priceWei, isBuy)
      await tx.wait()

      toast.success('Limit order placed successfully!')
      await refreshOrderBook()
      await refreshBalances()
    } catch (error: any) {
      console.error('Error placing limit order:', error)
      toast.error(error.message || 'Failed to place limit order')
      throw error
    } finally {
      setIsPlacingOrder(false)
    }
  }

  const placeMarketOrder = async (baseToken: string, quoteToken: string, amount: string, isBuy: boolean) => {
    if (!isConnected) throw new Error('Wallet not connected')

    setIsPlacingOrder(true)
    try {
      // Check if trading pair is allowed
      const tradingEngine = getContract(CONFIG.TRADING_ENGINE_ADDRESS, TRADING_ENGINE_ABI)
      const isAllowed = await tradingEngine.isTradingPairAllowed(baseToken, quoteToken)
      
      if (!isAllowed) {
        throw new Error('Trading pair not allowed')
      }

      // Get token decimals
      const baseTokenContract = getContract(baseToken, ERC20_ABI)
      const baseDecimals = await baseTokenContract.decimals()

      // Parse amounts
      const amountWei = ethers.parseUnits(amount, baseDecimals)

      // Check if user has approved the trading engine
      const allowance = await baseTokenContract.allowance(account, CONFIG.TRADING_ENGINE_ADDRESS)
      if (allowance < amountWei) {
        await approveToken(baseToken, CONFIG.TRADING_ENGINE_ADDRESS, amount)
      }

      // Place the order
      const tx = await tradingEngine.placeMarketOrder(baseToken, quoteToken, amountWei, isBuy)
      await tx.wait()

      toast.success('Market order placed successfully!')
      await refreshOrderBook()
      await refreshBalances()
    } catch (error: any) {
      console.error('Error placing market order:', error)
      toast.error(error.message || 'Failed to place market order')
      throw error
    } finally {
      setIsPlacingOrder(false)
    }
  }

  const cancelOrder = async (orderId: number) => {
    if (!isConnected) throw new Error('Wallet not connected')

    try {
      const tradingEngine = getContract(CONFIG.TRADING_ENGINE_ADDRESS, TRADING_ENGINE_ABI)
      const tx = await tradingEngine.cancelOrder(orderId)
      await tx.wait()

      toast.success('Order cancelled successfully!')
      await refreshOrderBook()
      await refreshBalances()
    } catch (error: any) {
      console.error('Error cancelling order:', error)
      toast.error(error.message || 'Failed to cancel order')
      throw error
    }
  }

  const value: TradingContextType = {
    orderBook,
    balances,
    placeLimitOrder,
    placeMarketOrder,
    cancelOrder,
    refreshOrderBook,
    refreshBalances,
    approveToken,
    checkTokenAllowance,
    isLoading,
    isPlacingOrder,
  }

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  )
}
