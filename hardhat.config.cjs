/** @type {import('hardhat/config').HardhatUserConfig} */
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun"
    }
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 100000
  }
};
