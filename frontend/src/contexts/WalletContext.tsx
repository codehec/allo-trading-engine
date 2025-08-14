import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import CONFIG from '../config'

interface WalletContextType {
  account: string | null
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
  chainId: string | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const isConnected = !!account && !!provider && !!signer

  useEffect(() => {
    checkWalletConnection()
    setupEventListeners()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window.ethereum === 'undefined') return

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length > 0) {
        await connectWallet()
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const setupEventListeners = () => {
    if (typeof window.ethereum === 'undefined') return

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setAccount(accounts[0])
      }
    })

    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(chainId)
      window.location.reload()
    })
  }

  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Please install MetaMask or another Web3 wallet')
      return
    }

    setIsConnecting(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      setProvider(provider)
      setSigner(signer)
      setAccount(accounts[0])
      setChainId(network.chainId.toString())

      // Check if we're on the correct network
      const targetChainId = CONFIG.NETWORKS.BSC_TESTNET.chainId
      if (network.chainId.toString() !== targetChainId) {
        await switchNetwork()
      }

      toast.success('Wallet connected successfully!')
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      toast.error(error.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAccount(null)
    setProvider(null)
    setSigner(null)
    setChainId(null)
    toast.success('Wallet disconnected')
  }

  const switchNetwork = async () => {
    if (typeof window.ethereum === 'undefined') return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CONFIG.NETWORKS.BSC_TESTNET.chainId }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CONFIG.NETWORKS.BSC_TESTNET],
          })
        } catch (addError) {
          console.error('Error adding network:', addError)
          toast.error('Failed to add BSC Testnet to MetaMask')
        }
      } else {
        console.error('Error switching network:', switchError)
        toast.error('Failed to switch to BSC Testnet')
      }
    }
  }

  const value: WalletContextType = {
    account,
    provider,
    signer,
    chainId,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    switchNetwork,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}
