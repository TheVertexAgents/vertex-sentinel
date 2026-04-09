const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const AGENT_REGISTRY = "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3";
const AGENT_REGISTERED_TOPIC = "0xcc66f27f523818ed7eebbbb8e3cb65a0bb2e0d72041c113764747fa2c4fac07b";

async function run() {
    const blockNumRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
    });
    const currentBlock = parseInt((await blockNumRes.json()).result, 16);

    let aLogs = [];
    const step = 50000;
    for (let i = 0; i < 4; i++) {
        const payload = {
            jsonrpc: "2.0",
            method: "eth_getLogs",
            params: [{
                address: AGENT_REGISTRY,
                fromBlock: "0x" + (currentBlock - (i + 1) * step).toString(16),
                toBlock: "0x" + (currentBlock - i * step).toString(16),
                topics: [AGENT_REGISTERED_TOPIC]
            }],
            id: 1
        };
        const res = await (await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json();
        if (res.result) aLogs.push(...res.result);
    }

    const topIds = ["37", "38", "32", "18", "39"];

    for (const log of aLogs) {
        const id = BigInt(log.topics[1]).toString();
        if (topIds.includes(id)) {
            const agentWallet = "0x" + log.topics[2].slice(26);
            console.log(`Agent ID ${id}: Wallet ${agentWallet}`);

            const codeRes = await (await fetch(RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getCode", params: [agentWallet, "latest"], id: 1 })
            })).json();

            if (codeRes.result && codeRes.result !== "0x") {
                console.log(`  -> IS A SMART CONTRACT. Code length: ${codeRes.result.length}`);
            } else {
                console.log(`  -> Is an EOA.`);
            }
        }
    }
}

run();
