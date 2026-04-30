# Contributing

Thanks for helping improve `homebridge-nuheat2`. This project keeps the published Homebridge plugin layout stable while gradually modernizing the source in TypeScript.

## Development

The source of truth for the platform, API client, accessories, internal models, and tests lives under `src/`. The TypeScript build compiles back into the CommonJS layout used by Homebridge: `index.js`, `lib/`, and `test/`.

Common commands:

```bash
npm run build
npm run typecheck
npm test
```

## Release Automation

GitHub Actions handles CI and npm publishing:

- `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, and `npm test` on pushes and pull requests across Node 20, 22, and 24.
- `.github/workflows/publish.yml` runs on pushes to `master` when `package.json` changes, re-runs checks on Node 24, publishes to npm only when the version is not already on the registry, and creates or updates the matching GitHub Release.

Release notes are expected in `docs/release-notes/<version>.md`. The publish workflow fails if that file is missing for the version in `package.json`.

## npm Trusted Publishing

Use npm trusted publishing rather than a long-lived automation token.

1. Open the `homebridge-nuheat2` package settings on npm.
2. Add a trusted publisher for GitHub Actions.
3. Configure:
   - Organization or user: `applemanj`
   - Repository: `homebridge-nuheat2`
   - Workflow filename: `publish.yml`
4. Keep the workflow on GitHub-hosted runners.

After that, bump the version in `package.json`, push to `master`, and GitHub Actions will publish the new version automatically once checks pass.

