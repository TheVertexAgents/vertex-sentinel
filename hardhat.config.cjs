/** @type {import('hardhat/config').HardhatUserConfig} */
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");
require("dotenv").config();

const INFURA_KEY = process.env.INFURA_KEY || "";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun"
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 100000
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : [],
    },
  },
};
