# Manual npm Publish Guide for @vertex-agents/sentinel-sdk

This guide outlines the steps to publish the Sentinel SDK to the public npm registry. Since the automated environment is sandboxed, this must be performed by an authorized maintainer.

## Prerequisites
- Authorized npm account with access to the `@vertex-agents` scope.
- `npm login` performed on the local machine.

## Steps to Publish

1. **Navigate to the package directory:**
   ```bash
   cd packages/sentinel-sdk
   ```

2. **Clean build:**
   ```bash
   npm run build
   ```

3. **Verify bundle contents (Dry Run):**
   ```bash
   npm publish --dry-run
   ```
   Check the output to ensure all necessary files (`dist/`, `package.json`, `README.md`) are included and no sensitive files are leaked.

4. **Publish to public registry:**
   ```bash
   npm publish --access public
   ```

5. **Verify live version:**
   ```bash
   npm info @vertex-agents/sentinel-sdk
   ```

## Post-Publish
Update the main `docs/ROADMAP.md` and `docs/CHANGELOG.md` with the confirmed version number.
