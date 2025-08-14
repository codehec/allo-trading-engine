import React from 'react'
import { Toaster } from 'react-hot-toast'
import { WalletProvider } from './contexts/WalletContext'
import { TradingProvider } from './contexts/TradingContext'
import TradingInterface from './components/TradingInterface'
import Header from './components/Header'

function App() {
  return (
    <WalletProvider>
      <TradingProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <TradingInterface />
          </main>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </TradingProvider>
    </WalletProvider>
  )
}

export default App
