import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import '@nomicfoundation/hardhat-toolbox';
import type { HardhatUserConfig } from 'hardhat/config';

// Secrets live only in apps/backend/nft/.env, never in this file
// (nft_context.md §0.2, rule 6). Node 22 loads it without dotenv.
const envFile = resolve(__dirname, '../.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

const fujiRpcUrl =
  nonEmpty(process.env.CHAIN_RPC_URL) ??
  'https://api.avax-test.network/ext/bc/C/rpc';
const minterPrivateKey = nonEmpty(process.env.MINTER_PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: 'http://127.0.0.1:8545' },
    fuji: {
      url: fujiRpcUrl,
      chainId: 43113,
      accounts: minterPrivateKey === undefined ? [] : [minterPrivateKey],
    },
  },
  // [À VÉRIFIER] Verification through Routescan's Etherscan-compatible API
  // for Snowtrace (nft_context.md §8.5), before the Fuji deployment.
  etherscan: {
    apiKey: { avalancheFujiTestnet: 'snowtrace' },
    customChains: [
      {
        network: 'avalancheFujiTestnet',
        chainId: 43113,
        urls: {
          apiURL:
            'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan',
          browserURL: 'https://testnet.snowtrace.io',
        },
      },
    ],
  },
  sourcify: { enabled: false },
  // Generated types stay under a "generated" folder, which the shared
  // ESLint, Prettier and Git ignore rules exclude.
  typechain: { outDir: 'generated/typechain', target: 'ethers-v6' },
};

export default config;
