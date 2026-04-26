/**
 * @dev Chainlink Price Feed Aggregator Addresses
 * Data sourced from: https://docs.chain.link/data-feeds/price-feeds/addresses
 */
export const CHAINLINK_FEEDS: Record<string, Record<string, `0x${string}`>> = {
  sepolia: {
    'BTC/USD': '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',
    'ETH/USD': '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    'SOL/USD': '0x011313f57A4d7454173855bfA225d640211c60be',
  },
  mainnet: {
    'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'SOL/USD': '0xCfE54B5CD566aB89272946F602D76Ea879CAb4a8',
  },
  // Add other networks (Base, Arbitrum) as needed
  base: {
    'BTC/USD': '0xcD2A119bD1F0DF23d79BBCA8128366761C686D60',
    'ETH/USD': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    'SOL/USD': '0x1062d3714131fdBb217b796aB674697e7f009088',
  },
  arbitrum: {
    'BTC/USD': '0x6ce185860a4963106506C203335A2910AD718248',
    'ETH/USD': '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    'SOL/USD': '0x3ec8593F73033E0394448e894628e692419add7D',
  }
};
