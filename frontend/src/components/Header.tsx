import React from 'react'
import { useWallet } from '../contexts/WalletContext'
import { Wallet, LogOut, RefreshCw } from 'lucide-react'
import CONFIG from '../config'

const Header: React.FC = () => {
  const { account, isConnected, isConnecting, connect, disconnect, switchNetwork, chainId } = useWallet()

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const isCorrectNetwork = chainId === CONFIG.NETWORKS.BSC_TESTNET.chainId

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Allo Trading Engine</h1>
              <p className="text-sm text-gray-600">Decentralized Trading on BSC</p>
            </div>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            {/* Network Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isCorrectNetwork ? 'BSC Testnet' : 'Wrong Network'}
              </span>
            </div>

            {/* Wallet Button */}
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="btn btn-primary flex items-center space-x-2"
              >
                {isConnecting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4" />
                )}
                <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                {/* Account Info */}
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="text-sm text-gray-600">Connected</div>
                  <div className="font-mono text-sm font-medium text-gray-900">
                    {formatAddress(account!)}
                  </div>
                </div>

                {/* Network Switch Button */}
                {!isCorrectNetwork && (
                  <button
                    onClick={switchNetwork}
                    className="btn btn-warning text-sm"
                  >
                    Switch Network
                  </button>
                )}

                {/* Disconnect Button */}
                <button
                  onClick={disconnect}
                  className="btn btn-secondary flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
