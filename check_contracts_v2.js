const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const RISK_ROUTER = "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC";
const AGENT_REGISTRY = "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3";
const REPUTATION_REGISTRY = "0x423a9904e39537a9997fbaF0f220d79D7d545763";
const VALIDATION_REGISTRY = "0x92bF63E5C7Ac6980f237a7164Ab413BE226187F1";

async function run() {
    const contracts = { RISK_ROUTER, AGENT_REGISTRY, REPUTATION_REGISTRY, VALIDATION_REGISTRY };
    for (const [name, addr] of Object.entries(contracts)) {
        const res = await (await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getCode", params: [addr, "latest"], id: 1 })
        })).json();
        console.log(`${name}: ${res.result ? res.result.length : 'null'}`);
    }
}
run();
