interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

interface Config {
  TRADING_ENGINE_ADDRESS: string;
  WETH_ADDRESS: string;
  USDC_ADDRESS: string;
  MOCK_PRICE_ORACLE_ADDRESS: string;
  NETWORKS: {
    BSC_TESTNET: NetworkConfig;
    HARDHAT_LOCAL: NetworkConfig;
  };
  DEFAULT_NETWORK: string;
  MIN_ORDER_AMOUNT: string;
  MAX_ORDER_AMOUNT: string;
  FEE_RATE: string;
  MOCK_PRICES: {
    'WETH/USDC': string;
  };
}

const CONFIG: Config = {
  TRADING_ENGINE_ADDRESS: '0x8ae2557E9acdf7259311200388F9133bEf149340',
  WETH_ADDRESS: '0xdC858B71EE44CaB1F2c39710aDAb399dA1Fb9659',
  USDC_ADDRESS: '0x82f29E95F5474a1c1364a882a8298572e018c59B',
  MOCK_PRICE_ORACLE_ADDRESS: '0x3AFA4ff8611085b785a7a06dd8CCEFdfbE90B91d',
  
  NETWORKS: {
    BSC_TESTNET: {
      chainId: '0x61', // Hex format for chain ID 97
      chainName: 'BSC Testnet',
      nativeCurrency: {
        name: 'tBNB',
        symbol: 'tBNB',
        decimals: 18
      },
      rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
      blockExplorerUrls: ['https://testnet.bscscan.com/']
    },
    HARDHAT_LOCAL: {
      chainId: '0x7A69',
      chainName: 'Hardhat Local',
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: ['http://127.0.0.1:8545/'],
      blockExplorerUrls: []
    }
  },
  
  DEFAULT_NETWORK: 'BSC_TESTNET',
  
  // Trading configuration
  MIN_ORDER_AMOUNT: '0.01', // WETH
  MAX_ORDER_AMOUNT: '100.0', // WETH
  FEE_RATE: '0.05%', // 5/10000
  
  // Mock prices
  MOCK_PRICES: {
    'WETH/USDC': '2000'
  }
};

export default CONFIG;
