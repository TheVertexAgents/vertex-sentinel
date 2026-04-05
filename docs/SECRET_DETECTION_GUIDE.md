# 🔐 Secret Detection & Prevention Guide

## Overview

Vertex Sentinel implements comprehensive secret detection to prevent accidental exposure of sensitive credentials in version control. This document explains our security implementation and best practices.

## Security Tools Installed

### GitGuardian (ggshield)
- **Purpose**: Detects secrets before they're committed
- **Version**: 1.44.1+
- **Installation**: `pip install ggshield`

## Prevention Mechanisms

### 1. Pre-commit Hook (Local)

The `.git/hooks/pre-commit` hook runs **before every commit** to scan for secrets.

**How it works**:
```bash
# Automatically runs on: git commit
# Scans: All staged files
# If secrets found: Commit is blocked
```

**To manually run**:
```bash
.git/hooks/pre-commit
```

### 2. GitHub Actions Workflow (Remote)

The `.github/workflows/secret-detection.yml` workflow runs on every push and PR:
- Scans entire repository history
- Integrates with GitGuardian API
- Blocks merge if secrets are detected

### 3. Configuration

**.gitguardian.yaml** - Detection rules:
```yaml
# Detects:
- Private keys (0x-prefixed hex strings)
- API keys and tokens
- Environment variable secrets
- Database credentials
- OAuth tokens

# Ignores:
- Test data with "mock-" prefix
- Example files (.env.example)
- Documentation
- Node modules
```

## What NOT to Commit

❌ **Never commit these**:
```
KRAKEN_API_KEY=<actual-key>
KRAKEN_SECRET=<actual-secret>
AGENT_PRIVATE_KEY=0x<actual-hex>
GOOGLE_GENAI_API_KEY=<actual-key>
INFURA_KEY=<actual-key>
STRYKR_PRISM_API=<actual-key>
```

## How to Use Safely

### ✅ Correct Way: Use Environment Variables

```bash
# 1. Add to .env (which is .gitignored)
echo "KRAKEN_API_KEY=your-real-key" >> .env
echo "AGENT_PRIVATE_KEY=0x..." >> .env

# 2. Code accesses via process.env
const apiKey = process.env.KRAKEN_API_KEY;

# 3. Commit code, NOT secrets
git add src/
git commit -m "Add API integration"
```

### ✅ For Documentation

Only use **placeholders** or **example values**:

```markdown
# Example Configuration

Configure your environment:
```bash
KRAKEN_API_KEY=<your-read-only-key>
KRAKEN_SECRET=<your-api-secret>
AGENT_PRIVATE_KEY=0x<your-private-key>
```
```

### ❌ Never Do This

```markdown
# WRONG! Don't commit real credentials

My API key: REDACTED_DUMMY_API_KEY
My private key: 0xREDACTED_SECRET_KEY_REPLAY_PROTECTED
```

## If You Accidentally Commit a Secret

### Immediate Action

1. **DO NOT PUSH** - If it's still local
2. **Revoke the credential immediately** in your provider (Kraken, Google, etc.)
3. **Remove the secret** from the file
4. **Amend the commit**:

```bash
# Remove the secret from files
vim src/file-with-secret.ts

# Update the staging area
git add src/file-with-secret.ts

# Amend the last commit
git commit --amend --no-edit

# Force push only if not yet public
git push --force-with-lease origin branch-name
```

### If Already Pushed

1. **Immediately revoke the credential** - This is the most important step
2. **Create a new commit removing the secret**:
```bash
# Remove the secret from files
vim src/file-with-secret.ts

# Commit the removal
git add src/file-with-secret.ts
git commit -m "security: remove exposed credential"

# Push the removal
git push origin branch-name
```

3. **Notify security team** - Update your API key/secret

### Full Repository Cleanup

If a secret was committed and pushed, you may need to:

```bash
# Rewrite history to remove secret
git log --all -p -- filename.txt | grep -i "secret"

# Use git-filter-branch or BFG to remove
bfg --delete-files filename.txt

# Force push cleaned history (⚠️ requires force!)
git push origin --force
```

## Workflow Rules

### Before Committing

```bash
# Always run pre-commit check manually first
.git/hooks/pre-commit

# If it fails, review what was detected
git diff --cached | grep -i "secret\|private\|password\|key"
```

### During Development

```bash
# 1. Create your .env file (auto-ignored)
echo "KRAKEN_API_KEY=your-real-key" >> .env

# 2. Work normally with code
git add src/logic/agent_brain.ts

# 3. Pre-commit hook runs automatically
git commit -m "feat: add kraken integration"
# ✅ If secrets aren't in staged files, commit succeeds
# ❌ If secrets are found, commit is blocked

# 4. Remove secrets and try again
git reset HEAD .env  # Unstage if .env was accidentally staged
git add .env  # If .env isn't in .gitignore, add it to .gitignore
git commit -m "feat: add kraken integration"
```

### CI/CD Pipeline

GitHub Actions will:
1. Run on every push to main or develop
2. Scan full repository
3. Block merge if secrets detected
4. Show detailed remediation steps

## Environment Configuration Template

Use `.env.example` for documentation:

```bash
# .env.example - Copy this to .env and fill in real values

# Kraken Exchange API (read-only credentials)
KRAKEN_API_KEY=<your-read-only-api-key>
KRAKEN_SECRET=<your-api-secret>

# Agent Identity
AGENT_PRIVATE_KEY=0x<your-agent-private-key>

# Infura Provider
INFURA_KEY=<your-infura-api-key>

# Google Generative AI
GOOGLE_GENAI_API_KEY=<your-google-api-key>

# Strykr Prism API
STRYKR_PRISM_API=<your-prism-api-key>
```

Users can then run:
```bash
cp .env.example .env
# Edit .env with real values
# .env is auto-ignored by .gitignore
```

## Verification

### Verify Setup

```bash
# Check pre-commit hook exists and is executable
ls -la .git/hooks/pre-commit

# Check .gitignore includes .env
grep "^\.env" .gitignore

# Check .gitguardian.yaml exists
ls -la .gitguardian.yaml

# Test ggshield installation
ggshield --version
```

### Test Secret Detection

```bash
# Create a test file with a fake secret
echo "test_key=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > test_secret.txt

# Try to stage it
git add test_secret.txt

# Try to commit (should be blocked by pre-commit hook)
git commit -m "test" 

# If blocked ✅, detection is working
# If not blocked ❌, hook may need reinstalling

# Clean up
rm test_secret.txt
git reset HEAD test_secret.txt
```

## Team Best Practices

### ✅ DO

- ✅ Use `.env` for all sensitive credentials
- ✅ Add `.env` to `.gitignore`
- ✅ Use `.env.example` for documentation
- ✅ Run `git diff --cached` before committing
- ✅ Revoke credentials if ever exposed
- ✅ Use environment variables in code
- ✅ Mark secrets as read-only when possible

### ❌ DON'T

- ❌ Commit real API keys or secrets
- ❌ Include secrets in documentation
- ❌ Hardcode credentials in code
- ❌ Share credentials in Git
- ❌ Use weak secret detection
- ❌ Ignore security warnings
- ❌ Leave secrets in commit history

## Resources

- [GitGuardian Documentation](https://docs.gitguardian.com/ggshield-docs/integrations/git-hooks/pre-commit)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub: Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## Questions or Issues?

If you detect a security issue or need help:
1. **DON'T** post in public channels
2. **DO** contact the security team privately
3. **DO** revoke exposed credentials immediately

---

**Last Updated**: 2026-04-05  
**Version**: 1.0  
**Status**: Active & Enforced
