#!/bin/bash
# Setup Git hooks for secret detection

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "🔐 Setting up Git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash
# Pre-commit hook to detect secrets

set -e

echo "🔐 Running secret detection with ggshield..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No files staged. Skipping secret scan."
  exit 0
fi

# Run ggshield on staged files
ggshield secret scan pre-commit 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Secret detection passed!"
  exit 0
else
  echo "❌ Secret detection failed! Commit blocked."
  exit 1
fi
EOF

# Make hook executable
chmod +x "$PRE_COMMIT_HOOK"

echo "✅ Git hooks setup complete!"
echo "   Pre-commit hook installed at: $PRE_COMMIT_HOOK"
