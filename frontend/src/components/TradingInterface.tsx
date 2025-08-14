import React from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useTrading } from '../contexts/TradingContext'
import OrderBook from './OrderBook'
import TradingForm from './TradingForm'
import Balances from './Balances'
import { RefreshCw } from 'lucide-react'

const TradingInterface: React.FC = () => {
  const { isConnected } = useWallet()
  const { refreshOrderBook, refreshBalances, isLoading } = useTrading()

  const handleRefresh = async () => {
    await Promise.all([refreshOrderBook(), refreshBalances()])
  }

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Connect your MetaMask wallet to start trading on the Allo Trading Engine.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Supported Networks</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• BSC Testnet (Chain ID: 97)</li>
              <li>• Hardhat Local (Chain ID: 31337)</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Trading Interface</h2>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="btn btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main trading layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Order Book */}
        <div className="lg:col-span-1">
          <OrderBook />
        </div>

        {/* Center column - Trading Form */}
        <div className="lg:col-span-1">
          <TradingForm />
        </div>

        {/* Right column - Balances */}
        <div className="lg:col-span-1">
          <Balances />
        </div>
      </div>

      {/* Market Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">$2,000</div>
            <div className="text-sm text-gray-600">Current Price</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">24h</div>
            <div className="text-sm text-gray-600">Change</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">$1.2M</div>
            <div className="text-sm text-gray-600">24h Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">0.05%</div>
            <div className="text-sm text-gray-600">Trading Fee</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradingInterface
