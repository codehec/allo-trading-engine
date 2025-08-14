import React, { useState, useEffect } from 'react'
import { useTrading } from '../contexts/TradingContext'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'

const OrderBook: React.FC = () => {
  const { orderBook, isLoading } = useTrading()
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Update timestamp when orderbook changes
  useEffect(() => {
    if (!isLoading && orderBook.buyOrders.length > 0 || orderBook.sellOrders.length > 0) {
      setLastUpdated(new Date())
    }
  }, [orderBook, isLoading])

  // Show refreshing indicator briefly when orderbook updates
  useEffect(() => {
    if (!isLoading && (orderBook.buyOrders.length > 0 || orderBook.sellOrders.length > 0)) {
      setIsRefreshing(true)
      const timer = setTimeout(() => setIsRefreshing(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [orderBook, isLoading])

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(2)
  }

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toFixed(4)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Order Book</h3>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            WETH/USDC
          </div>
          <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-700 font-medium">Auto-refresh: 5s</span>
          </div>
        </div>
      </div>

      {/* Last Updated Indicator */}
      <div className="mb-3 text-xs text-gray-500 text-center bg-gray-50 py-2 rounded flex items-center justify-center space-x-2">
        <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
        {isRefreshing && (
          <div className="flex items-center space-x-1 text-blue-500">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Updating...</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading order book...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sell Orders (Red) */}
          <div>
            <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
              <span className="flex items-center">
                <ArrowDown className="w-4 h-4 text-red-500 mr-1" />
                Sell Orders
              </span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                {orderBook.stats.activeSellOrders} active
              </span>
            </div>
            
            <div className="space-y-1">
              {orderBook.sellOrders.length > 0 ? (
                orderBook.sellOrders.map((order) => (
                  <div key={order.id} className="order-book-row order-book-sell">
                    <div className="text-left">
                      <div className="font-medium">{formatPrice(order.price)}</div>
                      <div className="text-xs text-gray-500">{formatTime(order.timestamp)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatAmount(order.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {formatAmount(order.quoteAmount)} USDC
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No sell orders
                </div>
              )}
            </div>
          </div>

          {/* Current Price */}
          <div className="border-t border-gray-200 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">$2,000.00</div>
              <div className="text-sm text-gray-500">Current Market Price</div>
            </div>
          </div>

          {/* Buy Orders (Green) */}
          <div>
            <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
              <span className="flex items-center">
                <ArrowUp className="w-4 h-4 text-green-500 mr-1" />
                Buy Orders
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                {orderBook.stats.activeBuyOrders} active
              </span>
            </div>
            
            <div className="space-y-1">
              {orderBook.buyOrders.length > 0 ? (
                orderBook.buyOrders.map((order) => (
                  <div key={order.id} className="order-book-row order-book-buy">
                    <div className="text-left">
                      <div className="font-medium">{formatPrice(order.price)}</div>
                      <div className="text-xs text-gray-500">{formatTime(order.timestamp)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatAmount(order.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {formatAmount(order.quoteAmount)} USDC
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No buy orders
                </div>
              )}
            </div>
          </div>

          {/* Order Book Stats */}
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-gray-900">{orderBook.stats.totalBuyOrders}</div>
                <div className="text-gray-500">Total Buy Orders</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900">{orderBook.stats.totalSellOrders}</div>
                <div className="text-gray-500">Total Sell Orders</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderBook
