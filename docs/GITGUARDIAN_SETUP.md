# GitGuardian (ggshield) Setup Guide

To ensure our security standards and prevent secret leaks, we use **GitGuardian (ggshield)** for automated secret detection. This guide explains how to set it up locally and in CI.

## 1. Local Setup (Developer Machine)

### Installation
The most reliable way to install the GitGuardian CLI (`ggshield`) is via `pip`:

```bash
pip install ggshield
```

Verify the installation:
```bash
ggshield --version
```

### Authentication (IMPORTANT)
Instead of relying on environment variables in `~/.bashrc`, use the official authentication command. This is the most robust way to manage your API key locally.

```bash
ggshield auth login
```
This will open a browser window to authenticate with your GitGuardian account.

### Automated Hook Setup
The project is configured to automatically set up Git hooks when you run `npm install`:

```bash
npm install
```
This runs `bash scripts/setup-hooks.sh`, which installs a pre-commit hook in `.git/hooks/pre-commit`.

### Manual Hook Trigger
If you need to run the secret scan manually on your staged changes:

```bash
ggshield secret scan pre-commit
```

## 2. CI/CD Setup (GitHub Actions)

The pipeline is configured in `.github/workflows/secret-detection.yml`. It triggers on every `push` and `pull_request` to the `main` and `develop` branches.

### Adding the API Key to GitHub
To enable the CI scan, you must add your GitGuardian API key to the repository's secrets:

1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.
3. Name: `GITGUARDIAN_API_KEY`
4. Value: (Your GitGuardian API Key)

## 3. Handling Leaks and False Positives

### If a leak is detected:
1. **Revoke the secret** immediately (e.g., rotate your API key, change the password).
2. **Remove the secret** from the code.
3. **Squash/Clean history** if the secret was committed and pushed.

### If it is a False Positive:
You can ignore specific paths or secrets in the `.gitguardian.yaml` file:

```yaml
secret:
  ignored_hashes:
    - (hash_of_the_false_positive)
```

For more details, visit the [GitGuardian Documentation](https://docs.gitguardian.com/ggshield-cli/getting-started).
