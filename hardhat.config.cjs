const { HardhatUserConfig } = require("hardhat/config");
require("@nomicfoundation/hardhat-ethers");

const config = {
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
  }
};

module.exports = config;
