import React, { useState } from 'react'
import { useTrading } from '../contexts/TradingContext'
import { useWallet } from '../contexts/WalletContext'
import { ArrowUp, ArrowDown, Clock, Zap } from 'lucide-react'
import CONFIG from '../config'

type OrderType = 'limit' | 'market'
type OrderSide = 'buy' | 'sell'

const TradingForm: React.FC = () => {
  const { placeLimitOrder, placeMarketOrder, isPlacingOrder } = useTrading()
  const { isConnected } = useWallet()
  
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [orderSide, setOrderSide] = useState<OrderSide>('buy')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('2000')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected) return
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      alert('Please enter a valid price for limit orders')
      return
    }

    const minAmount = parseFloat(CONFIG.MIN_ORDER_AMOUNT)
    const maxAmount = parseFloat(CONFIG.MAX_ORDER_AMOUNT)
    const amountNum = parseFloat(amount)

    if (amountNum < minAmount || amountNum > maxAmount) {
      alert(`Amount must be between ${minAmount} and ${maxAmount} WETH`)
      return
    }

    setIsSubmitting(true)
    try {
      if (orderType === 'limit') {
        await placeLimitOrder(
          CONFIG.WETH_ADDRESS,
          CONFIG.USDC_ADDRESS,
          amount,
          price,
          orderSide === 'buy'
        )
      } else {
        await placeMarketOrder(
          CONFIG.WETH_ADDRESS,
          CONFIG.USDC_ADDRESS,
          amount,
          orderSide === 'buy'
        )
      }
      
      // Reset form
      setAmount('')
      if (orderType === 'limit') {
        setPrice('2000')
      }
    } catch (error) {
      console.error('Error placing order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateTotal = () => {
    if (!amount || !price) return '0'
    const total = parseFloat(amount) * parseFloat(price)
    return total.toFixed(2)
  }

  const getOrderButtonText = () => {
    if (isSubmitting || isPlacingOrder) return 'Placing Order...'
    return `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${orderType === 'limit' ? 'Limit' : 'Market'}`
  }

  const getOrderButtonClass = () => {
    const baseClass = 'btn w-full py-3 font-semibold text-lg flex items-center justify-center space-x-2'
    if (orderSide === 'buy') {
      return `${baseClass} btn-success`
    } else {
      return `${baseClass} btn-danger`
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Place Order</h3>
        <div className="text-sm text-gray-500">
          WETH/USDC
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orderType === 'limit'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Limit</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orderType === 'market'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Zap className="w-4 h-4" />
                <span className="font-medium">Market</span>
              </div>
            </button>
          </div>
        </div>

        {/* Order Side Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Order Side</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOrderSide('buy')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orderSide === 'buy'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <ArrowUp className="w-4 h-4" />
                <span className="font-medium">Buy</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setOrderSide('sell')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orderSide === 'sell'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <ArrowDown className="w-4 h-4" />
                <span className="font-medium">Sell</span>
              </div>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Amount (WETH)
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.01"
            min={CONFIG.MIN_ORDER_AMOUNT}
            max={CONFIG.MAX_ORDER_AMOUNT}
            className="input"
            required
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Min: {CONFIG.MIN_ORDER_AMOUNT} WETH</span>
            <span>Max: {CONFIG.MAX_ORDER_AMOUNT} WETH</span>
          </div>
        </div>

        {/* Price Input (only for limit orders) */}
        {orderType === 'limit' && (
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
              Price (USDC per WETH)
            </label>
            <input
              type="number"
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              className="input"
              required
            />
          </div>
        )}

        {/* Total Calculation */}
        {orderType === 'limit' && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Value:</span>
              <span className="text-lg font-semibold text-gray-900">
                ${calculateTotal()} USDC
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isPlacingOrder || !isConnected}
          className={getOrderButtonClass()}
        >
          {isSubmitting || isPlacingOrder ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              {orderSide === 'buy' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
              <span>{getOrderButtonText()}</span>
            </>
          )}
        </button>

        {/* Trading Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Trading Information</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>• Trading Fee: {CONFIG.FEE_RATE}</div>
            <div>• Min Order: {CONFIG.MIN_ORDER_AMOUNT} WETH</div>
            <div>• Max Order: {CONFIG.MAX_ORDER_AMOUNT} WETH</div>
            <div>• Current Price: ${CONFIG.MOCK_PRICES['WETH/USDC']} USDC</div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default TradingForm
