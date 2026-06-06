# NPM Publish Guide: `@vertex-agents/sentinel-sdk`

This guide explains how to publish the Sentinel SDK to the public npm registry. Since automated agents operating in sandbox environments lack the necessary credentials, this process must be executed manually by an authorized maintainer.

## Prerequisites

1.  **npm Account**: You must have an active account on [npmjs.com](https://npmjs.com).
2.  **Organization Access**: Your npm account must be a member of the `@vertex-agents` organization with publish rights.
3.  **Clean Working Directory**: Ensure all tests pass and the working tree is clean.

## Publishing Steps

### 1. Authenticate

Log in to npm via the CLI. You will be prompted for your username, password, and OTP (if 2FA is enabled).

```bash
npm login
```

Verify you are logged in as the correct user:

```bash
npm whoami
```

### 2. Build and Verify

Navigate to the SDK package directory, clean previous builds, and compile the TypeScript source.

```bash
cd packages/sentinel-sdk
npm run build
```

Run a dry-run publish to verify the package contents. This will not actually publish the package but will show you exactly what files will be included.

```bash
npm publish --dry-run
```

Review the output to ensure:
*   Only necessary files are included (`dist/`, `package.json`, `README.md`, etc.).
*   No sensitive files (`.env`, private keys) are accidentally included.

### 3. Publish

Once you have verified the dry-run output, publish the package with public access (since it is a scoped package, it defaults to private unless specified).

```bash
npm publish --access public
```

### 4. Verify Publication

Verify the package is live on the registry by running:

```bash
npm info @vertex-agents/sentinel-sdk version
```

Or visit `https://www.npmjs.com/package/@vertex-agents/sentinel-sdk` in your browser.

## Post-Publish Checklist

*   Update the `docs/ROADMAP.md` to mark the SDK release as complete.
*   Tag the release in git (e.g., `git tag -a @vertex-agents/sentinel-sdk@1.0.0 -m "Initial SDK release"`).
*   Push the tags to GitHub: `git push --tags`.
