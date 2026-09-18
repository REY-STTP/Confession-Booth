import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-gas-reporter';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {},
    localhost: { url: 'http://127.0.0.1:8545' },
    sepolia: {
      url: process.env.RPC_URL ?? '',
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
  // Etherscan API V2 (endpoint V1 deprecated): satu apiURL + chainid per jaringan.
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'sepolia',
        chainId: 11155111,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=11155111',
          browserURL: 'https://sepolia.etherscan.io',
        },
      },
    ],
  },
  sourcify: { enabled: false },
  // P2 #16: snapshot gas hanya bila REPORT_GAS=1 (tak memperlambat test default).
  gasReporter: {
    enabled: process.env.REPORT_GAS === '1',
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
  },
};

export default config;
