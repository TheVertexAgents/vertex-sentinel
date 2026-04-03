# Problem Statement: Kraken MCP Modularization and Constitution Alignment

## Background
The `Vertex Sentinel Layer` project is undergoing a transition to a more modular architecture. Specifically, the Kraken exchange interaction logic is being moved into a dedicated Model Context Protocol (MCP) server. 

At the same time, the project has adopted **Constitution v2.0.0**, which mandates:
1.  **Fail-Closed Security**: Any critical failure (invalid environment, exchange errors in sensitive operations) must halt execution.
2.  **Strict Type Safety**: Use of `any` is prohibited. Zod schemas must be used for all I/O validation.
3.  **Structured JSON Logging**: All events and errors must be logged in a machine-readable JSON format to `stderr`.
4.  **Viem Migration**: Replacing `ethers.js` with `viem` for blockchain interactions (as per PR #12).

## Current Issue
The `feat/kraken-mcp-modular` branch was behind the current state of the main development line (specifically PR #12). This created several technical challenges:
- **Dependency Drift**: Incompatible versions of `viem` and `zod` were present.
- **Constitution Non-Compliance**: The initial modular implementation did not follow the "Fail-Closed" principle or use structured logging.
- **Missing Infrastructure**: The transition to ESM (NodeNext) required updates to `tsconfig.json` and `package.json` to support modern TypeScript features and test runners.

## Objective
To successfully deliver the modular Kraken MCP, we must:
1.  **Align with Constitution v2.0.0**: Ensure the `KrakenMcpServer` follows all security and logging guidelines.
2.  **Implement TDD**: Use Test-Driven Development to verify the robustness of the server before integration.
3.  **Resolve ESM/TS Issues**: Fix module resolution and type definition gaps to ensure a stable build and test environment.
4.  **Security Guardrails**: Implement `CriticalSecurityException` for sensitive operations like `place_order`.

## Progress Status
- Environment validation (`validateEnv`) has been updated with Kraken credentials.
- `KrakenMcpServer` has been refactored for "Fail-Closed" behavior and structured logging.
- A test suite `test/mcp/kraken_mcp.test.ts` has been implemented and dependencies have been installed.
- Work is currently in the "Green Stage" of TDD, with some minor TypeScript scope issues in tests recently resolved.
