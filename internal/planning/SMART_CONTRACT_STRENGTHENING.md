# Smart Contract Strengthening Initiative

**Status:** In Planning
**Assignee:** Blockchain Developer
**Priority:** High (Leaderboard Impact)

## 🎯 Objective

Strengthen Solidity contracts to improve leaderboard reputation and validation scores by implementing missing ERC-8004 registries from the AI Trading Agent Template.

## 📋 Background

### Current Gap
- **Current contracts:** RiskRouter.sol (103 LOC) + MockRegistry.sol (14 LOC)
- **Template reference:** 5 production contracts (~1026 LOC)
- **Missing:** AgentRegistry, ReputationRegistry, ValidationRegistry, HackathonVault

### Impact on Leaderboard
- ❌ Reputation Score: Not calculated (no feedback system)
- ❌ Validation Score: Not calculated (no attestation system)
- ✅ Risk Router: Working but disconnected from identity layer

## 🔧 Deliverables Checklist

### Phase 1: Foundation (AgentRegistry)
- [ ] Create `src/contracts/AgentRegistry.sol` (ERC-721 + EIP-712)
  - ERC-721 agent identity minting
  - Agent metadata registration
  - Hot wallet management
  - Signing nonce tracking
  - Domain separator support
- [ ] Update `src/contracts/RiskRouter.sol` to integrate with AgentRegistry
  - Replace hardcoded mock checks
  - Proper signature verification
  - Nonce alignment
- [ ] Compile and verify no errors

### Phase 2: Reputation System (ReputationRegistry)
- [ ] Create `src/contracts/ReputationRegistry.sol`
  - Feedback submission (`submitFeedback()`)
  - Anti-sybil protections (no self-rating)
  - Outcome reference hashing
  - Average score calculation
  - Feedback history view functions
  - FeedbackType enum (TRADE_EXECUTION, RISK_MANAGEMENT, STRATEGY_QUALITY, GENERAL)
- [ ] Write tests for reputation feedback flow
- [ ] Verify deployment path

### Phase 3: Validation System (ValidationRegistry)
- [ ] Create `src/contracts/ValidationRegistry.sol`
  - Validator attestation posting
  - ProofType support (NONE, EIP712, TEE, ZKML)
  - Checkpoint hash verification
  - Average validation score
  - Validator management (add/remove/open validation)
- [ ] EIP-712 convenience function for checkpoint attestations
- [ ] Write tests for validator flow
- [ ] Verify deployment path

### Phase 4: Capital & Vault (HackathonVault) [Optional]
- [ ] Create `src/contracts/HackathonVault.sol`
  - Self-serve capital claim per agent
  - Per-team allocation tracking
  - Underfunding guards
- [ ] Write tests (optional, can skip if time-constrained)

### Phase 5: Integration & Deployment
- [ ] Update `hardhat.config.cjs` to compile all contracts
- [ ] Generate Typechain types for all new contracts
- [ ] Create deployment script (`scripts/deploy-registries.ts`)
  - Deploy AgentRegistry first
  - Deploy RiskRouter with AgentRegistry address
  - Deploy ReputationRegistry with AgentRegistry address
  - Deploy ValidationRegistry with AgentRegistry address
  - Deploy HackathonVault (optional)
- [ ] Write end-to-end integration test
  - Register agent
  - Submit trade intent
  - Record validation checkpoint
  - Verify scores on-chain
- [ ] Deploy to Sepolia testnet
- [ ] Verify leaderboard integration

### Phase 6: Verification & Documentation
- [ ] All contracts compile without warnings
- [ ] All tests pass (target: 90%+ coverage)
- [ ] Addresses logged to `deployments_sepolia.json`
- [ ] Update README with contract architecture
- [ ] Document integration points with RiskRouter
- [ ] Link checkpoint hashes to validation attestations

## 📚 References

### Template Contracts
- **Source:** `/home/asif1/hackathons/ai-trading-agent-template/contracts/`
- **AgentRegistry.sol** - 221 LOC (reference)
- **ReputationRegistry.sol** - 172 LOC (reference)
- **ValidationRegistry.sol** - 195 LOC (reference)
- **HackathonVault.sol** - 152 LOC (reference)

### Key Files to Update
- `src/contracts/RiskRouter.sol` - Enhance integration
- `src/contracts/AgentRegistry.sol` - NEW
- `src/contracts/ReputationRegistry.sol` - NEW
- `src/contracts/ValidationRegistry.sol` - NEW
- `src/contracts/HackathonVault.sol` - NEW
- `hardhat.config.cjs` - Compilation config
- `scripts/deploy-registries.ts` - NEW deployment script
- `test/contracts/` - NEW test files

## 🚀 Success Criteria

✅ All 4 contracts compile and pass Typechain generation
✅ Unit tests pass for all registries (>80% coverage)
✅ Deployed to Sepolia with correct initialization order
✅ Agent registration creates ERC-721 NFT
✅ Reputation feedback submittable and scores calculated
✅ Validators can attest checkpoints with proof types
✅ Leaderboard shows agent reputation score > 0
✅ Leaderboard shows agent validation score > 0
✅ Trade checkpoints link to validation attestations

## 📊 Tracking

**SQL Todos:** 9 tasks created
- phase1-agent-registry
- phase1-update-riskrouter
- phase2-reputation-registry
- phase3-validation-registry
- phase4-hackathon-vault
- testing-contracts
- deployment-scripts
- integration-test
- compile-verify

**Dependencies:**
```
phase1-agent-registry
  ├─ phase1-update-riskrouter
  ├─ phase2-reputation-registry
  └─ phase3-validation-registry
      └─ testing-contracts
           └─ deployment-scripts
               └─ integration-test
```

## 🔗 Related Issues

- Leaderboard reputation/validation score calculation
- ERC-8004 compliance verification
- On-chain identity for agents

---

**Created:** 2026-04-09
**Assignee:** Blockchain Developer
**Target Completion:** Before final leaderboard snapshot
