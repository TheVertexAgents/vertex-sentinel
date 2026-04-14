#!/bin/bash
# Setup Git hooks for secret detection

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "🔐 Setting up Git hooks..."

# Check if ggshield is installed
if ! command -v ggshield &> /dev/null; then
    echo "⚠️  WARNING: ggshield (GitGuardian CLI) is not installed."
    echo "   Secret detection will be skipped until you install it."
    echo "   Run: pip install ggshield"
    echo "   Then authenticate with: ggshield auth login"
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash
# Pre-commit hook to detect secrets using GitGuardian (ggshield)

set -e

# Support for non-interactive shells
export PATH="$PATH:/usr/local/bin:$HOME/.local/bin"

# Check if ggshield is available
if ! command -v ggshield &> /dev/null; then
  echo "⚠️  ggshield not found. Skipping secret scan."
  echo "   Please install it for better security: pip install ggshield"
  exit 0
fi

# Check if authenticated
# 'auth check' returns non-zero if not authenticated
if ! ggshield auth check &> /dev/null; then
  echo "⚠️  ggshield is not authenticated. Skipping secret scan."
  echo "   Please run: ggshield auth login"
  exit 0
fi

echo "🔐 Running secret detection with ggshield..."

# Run ggshield on staged files
# We use 'pre-commit' mode which automatically scans staged changes
if ggshield secret scan pre-commit; then
  echo "✅ Secret detection passed!"
  exit 0
else
  echo "❌ Secret detection failed! Commit blocked."
  echo "   If these are false positives, you can ignore them in .gitguardian.yaml"
  exit 1
fi
EOF

# Make hook executable
chmod +x "$PRE_COMMIT_HOOK"

echo "✅ Git hooks setup complete!"
echo "   Pre-commit hook installed at: $PRE_COMMIT_HOOK"
