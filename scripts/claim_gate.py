#!/usr/bin/env python3
"""Claim-gate verifier.

Validates that public-facing README claims are backed by docs/claims/claim_lock.yml.

Currently checks:
- Every explicit `claim_id` mentioned in README exists in the lockfile.
- No README claim uses a scope (simulation/testnet/live_exchange/mainnet) that
  conflicts with the lockfile entry's stated maturity/state when combined with
  investor packaging language.

Exit 0 on pass; exit 1 with a diff-like report on failure.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml")
    sys.exit(2)

REPO = Path(__file__).resolve().parent.parent.parent
README = REPO / "README.md"
LOCK = REPO / "docs" / "claims" / "claim_lock.yml"


def repo_root() -> Path:
    p = Path(__file__).resolve()
    for candidate in [p.parent.parent.parent, Path.cwd()]:
        if (candidate / "README.md").exists() and (candidate / "docs" / "claims" / "claim_lock.yml").exists():
            return candidate
    return p.parent.parent.parent


README = repo_root() / "README.md"
LOCK = repo_root() / "docs" / "claims" / "claim_lock.yml"


def extract_readme_claim_ids(text: str) -> set[str]:
    return set(re.findall(r"`([^`]+\.v\d+)`", text))


def load_lock(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def verify(claim_ids: set[str], lock: dict) -> list[str]:
    errors: list[str] = []
    known = {c["claim_id"] for c in lock.get("claims", [])}
    for cid in sorted(claim_ids):
        if cid not in known:
            errors.append(f"MISSING claim_id in lockfile: {cid}")
        else:
            entry = next(c for c in lock["claims"] if c["claim_id"] == cid)
            state = entry.get("state", "?")
            scope = entry.get("scope", "?")
            if state in {"planned", "retired"}:
                errors.append(
                    f"STALE claim_id referenced in README but lockfile state={state}: {cid}"
                )
            if scope == "testnet" and "Mainnet" in README.read_text(encoding="utf-8"):
                errors.append(
                    f"SCOPE MISMATCH: {cid} is testnet but README contains 'Mainnet' wording."
                )
    if lock.get("claim_lock_version") != "1.0.0":
        errors.append("Lockfile version header is missing or not 1.0.0")
    return errors


def main() -> int:
    if not README.exists() or not LOCK.exists():
        print("Missing README.md or docs/claims/claim_lock.yml — aborting.")
        return 2
    text = README.read_text(encoding="utf-8")
    claim_ids = extract_readme_claim_ids(text)
    if not claim_ids:
        print("No claim_ids referenced in README; nothing to verify.")
        return 0
    lock = load_lock(LOCK)
    errors = verify(claim_ids, lock)
    if errors:
        print("Claim-gate FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"Claim-gate PASSED — {len(claim_ids)} claim_id(s) verified against lockfile.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
