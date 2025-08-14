import React, { useState, useCallback, useEffect } from 'react'
import { useTrading } from '../contexts/TradingContext'
import { useWallet } from '../contexts/WalletContext'
import { Wallet, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const Balances: React.FC = () => {
  const { balances, refreshBalances, isLoading, approveToken, checkTokenAllowance } = useTrading()
  const { account, isConnected } = useWallet()
  
  const [isApproving, setIsApproving] = useState<string | null>(null)
  const [tokenAllowances, setTokenAllowances] = useState<{[key: string]: string}>({})
  const [isCheckingAllowances, setIsCheckingAllowances] = useState(false)
  const [allowancesFetched, setAllowancesFetched] = useState(false)

  // Memoize the checkAllowances function to prevent infinite re-renders
  const checkAllowances = useCallback(async () => {
    if (isCheckingAllowances) return // Prevent multiple simultaneous calls
    
    console.log('Starting allowance check...', { balances: balances.length, isConnected })
    setIsCheckingAllowances(true)
    
    try {
      const allowances: {[key: string]: string} = {}
      for (const token of balances) {
        try {
          console.log(`Checking allowance for ${token.symbol}...`)
          const allowance = await checkTokenAllowance(token.address, '0x8ae2557E9acdf7259311200388F9133bEf149340')
          console.log(`${token.symbol} allowance:`, allowance)
          allowances[token.symbol] = allowance
        } catch (error) {
          console.error(`Failed to check allowance for ${token.symbol}:`, error)
          allowances[token.symbol] = '0'
        }
      }
      console.log('Final allowances:', allowances)
      setTokenAllowances(allowances)
      setAllowancesFetched(true) // Mark as fetched to prevent re-fetching
    } catch (error) {
      console.error('Error checking allowances:', error)
    } finally {
      setIsCheckingAllowances(false)
    }
  }, [balances, checkTokenAllowance, isCheckingAllowances])

  // Check token allowances when component mounts or when balances change
  useEffect(() => {
    if (isConnected && balances.length > 0 && !allowancesFetched && !isCheckingAllowances) {
      console.log('useEffect triggered - checking allowances', { isConnected, balancesLength: balances.length, allowancesFetched })
      checkAllowances()
    } else {
      console.log('useEffect not triggered', { isConnected, balancesLength: balances.length, allowancesFetched, isCheckingAllowances })
    }
  }, [isConnected, balances.length, allowancesFetched, isCheckingAllowances])

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      setIsCheckingAllowances(false)
      setIsApproving(null)
    }
  }, [])

  // Reset allowances when balances change significantly - simplified to prevent loops
  useEffect(() => {
    if (balances.length === 0) {
      setTokenAllowances({})
      setAllowancesFetched(false)
    }
  }, [balances.length])

  // Manual refresh function for allowances
  const manualRefreshAllowances = useCallback(async () => {
    console.log('Manual refresh of allowances requested')
    setAllowancesFetched(false) // Reset the flag to allow re-fetching
    // Use setTimeout to break the synchronous update cycle
    setTimeout(() => {
      checkAllowances()
    }, 0)
  }, [checkAllowances])

  const handleApproveToken = async (tokenAddress: string, symbol: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsApproving(symbol)
    try {
      // Approve a large amount for trading
      const approvalAmount = '1000000' // 1M tokens
      await approveToken(tokenAddress, '0x8ae2557E9acdf7259311200388F9133bEf149340', approvalAmount)
      toast.success(`${symbol} approved successfully!`)
      
      // Refresh allowances after approval
      setAllowancesFetched(false) // Reset to allow re-fetching after approval
      await checkAllowances()
      await refreshBalances()
    } catch (error: any) {
      console.error('Approval failed:', error)
      toast.error(`Failed to approve ${symbol}: ${error.message}`)
    } finally {
      setIsApproving(null)
    }
  }

  const getApprovalStatus = (token: any) => {
    const allowance = tokenAllowances[token.symbol]
    const balance = parseFloat(token.balance)
    
    // If we haven't checked allowances yet, show loading
    if (allowance === undefined) {
      return 'loading'
    }
    
    const allowanceNum = parseFloat(allowance)
    
    // Consider approved if allowance is greater than or equal to current balance
    return allowanceNum >= balance && balance > 0
  }

  const getApprovalStatusText = (token: any) => {
    const status = getApprovalStatus(token)
    if (status === 'loading') {
      return 'Checking...'
    }
    return status ? 'Approved for Trading' : 'Approval Required'
  }

  const getApprovalStatusIcon = (token: any) => {
    const status = getApprovalStatus(token)
    if (status === 'loading') {
      return <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
    }
    return status ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <AlertCircle className="w-4 h-4 text-yellow-600" />
    )
  }

  const isApprovalButtonDisabled = (token: any) => {
    const status = getApprovalStatus(token)
    return isApproving === token.symbol || status === 'loading' || status === true
  }

  const formatBalance = (balance: string, decimals: number) => {
    const num = parseFloat(balance)
    if (num === 0) return '0.00'
    
    // Format based on the size of the number
    if (num < 0.01) {
      return num.toFixed(6)
    } else if (num < 1) {
      return num.toFixed(4)
    } else if (num < 100) {
      return num.toFixed(2)
    } else {
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
    }
  }

  const getTokenIcon = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'WETH':
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">Ξ</span>
          </div>
        )
      case 'USDC':
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">$</span>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
        )
    }
  }

  const getTokenColor = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'WETH':
        return 'text-orange-600'
      case 'USDC':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Token Balances</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              console.log('Manual balance refresh requested')
              refreshBalances()
            }}
            disabled={isLoading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Balances</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading balances...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Account Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Wallet className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Connected Account</span>
            </div>
            <div className="font-mono text-sm text-gray-900 break-all">
              {account}
            </div>
            
            {/* Debug Info */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div>Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
                <div>Loading State: {isLoading ? '🔄 Loading...' : '✅ Ready'}</div>
                <div>Balances Count: {balances.length}</div>
                <div>Account: {account || 'None'}</div>
              </div>
            </div>
          </div>

          {/* Token Balances */}
          {balances.length > 0 ? (
            <div className="space-y-3">
              {balances.map((token) => (
                <div key={token.address} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getTokenIcon(token.symbol)}
                      <div>
                        <div className="font-medium text-gray-900">{token.symbol}</div>
                        <div className="text-sm text-gray-500">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getTokenColor(token.symbol)}`}>
                        {formatBalance(token.balance, token.decimals)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {token.symbol} tokens
                      </div>
                    </div>
                  </div>
                  
                  {/* Token Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      {getApprovalStatusIcon(token)}
                      <span className={`text-sm ${
                        getApprovalStatus(token) === 'loading' 
                          ? 'text-gray-500' 
                          : getApprovalStatus(token) 
                            ? 'text-green-600' 
                            : 'text-yellow-600'
                      }`}>
                        {getApprovalStatusText(token)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Manual refresh button for allowances */}
                      <button
                        onClick={() => {
                          console.log(`Refreshing allowance for ${token.symbol}`)
                          manualRefreshAllowances()
                        }}
                        disabled={isCheckingAllowances}
                        className="btn btn-secondary text-xs py-1 px-2"
                        title="Refresh allowance status"
                      >
                        {isCheckingAllowances ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </button>
                      
                      {/* Approval button */}
                      <button
                        onClick={() => handleApproveToken(token.address, token.symbol)}
                        disabled={isApprovalButtonDisabled(token)}
                        className={`btn text-sm py-1 px-3 ${
                          getApprovalStatus(token) === true
                            ? 'btn-success cursor-not-allowed opacity-50' 
                            : getApprovalStatus(token) === 'loading'
                            ? 'btn-secondary cursor-not-allowed opacity-50'
                            : 'btn-primary'
                        }`}
                      >
                        {isApproving === token.symbol ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : getApprovalStatus(token) === true ? (
                          'Approved'
                        ) : getApprovalStatus(token) === 'loading' ? (
                          'Checking...'
                        ) : (
                          'Approve'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No token balances found</p>
              <p className="text-sm">
                {isConnected 
                  ? 'Loading balances...' 
                  : 'Connect your wallet to see balances'
                }
              </p>
              {isConnected && (
                <button
                  onClick={refreshBalances}
                  className="btn btn-primary mt-3"
                >
                  Refresh Balances
                </button>
              )}
            </div>
          )}

          {/* Balance Summary */}
          {balances.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total Value (USD):</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${balances.reduce((total, token) => {
                      const balance = parseFloat(token.balance)
                      if (token.symbol === 'WETH') {
                        return total + (balance * 2000) // Mock price
                      } else if (token.symbol === 'USDC') {
                        return total + balance
                      }
                      return total
                    }, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* Approval Status Summary */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Approval Status:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          console.log('Check All button clicked')
                          manualRefreshAllowances()
                        }}
                        disabled={isCheckingAllowances}
                        className="btn btn-secondary text-xs py-1 px-2 flex items-center space-x-1"
                        title="Check all token allowances"
                      >
                        {isCheckingAllowances ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            <span>Checking...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            <span>Check All</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-600">
                    {(() => {
                      const totalTokens = balances.length
                      const approvedTokens = balances.filter(token => getApprovalStatus(token) === true).length
                      const pendingTokens = balances.filter(token => getApprovalStatus(token) === 'loading').length
                      const unapprovedTokens = balances.filter(token => getApprovalStatus(token) === false).length
                      
                      if (isCheckingAllowances) {
                        return '🔄 Checking allowances...'
                      } else if (pendingTokens > 0) {
                        return `Checking ${pendingTokens} tokens...`
                      } else if (unapprovedTokens > 0) {
                        return `${approvedTokens}/${totalTokens} tokens approved • ${unapprovedTokens} need approval`
                      } else if (approvedTokens > 0) {
                        return `✅ All ${totalTokens} tokens approved for trading!`
                      } else if (allowancesFetched) {
                        return `📊 Allowances loaded • ${approvedTokens}/${totalTokens} approved`
                      } else {
                        return 'No tokens found'
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Balances
