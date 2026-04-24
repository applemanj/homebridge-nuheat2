# homebridge-nuheat2

[![npm version](https://img.shields.io/npm/v/homebridge-nuheat2.svg)](https://www.npmjs.com/package/homebridge-nuheat2)
[![npm downloads](https://img.shields.io/npm/dm/homebridge-nuheat2.svg)](https://www.npmjs.com/package/homebridge-nuheat2)

Homebridge platform plugin for Nuheat Signature floor-heating thermostats.

This fork focuses on modernizing the plugin for current Homebridge releases, improving runtime stability, and preparing for Homebridge 2.0 while keeping the existing `NuHeat` platform configuration intact.

This project builds on the original [`senorshaun/homebridge-nuheat`](https://github.com/senorshaun/homebridge-nuheat) plugin and retains attribution for Shaun's original work.

## Highlights

- Automatically discovers thermostats on the authenticated Nuheat account
- Optionally creates HomeKit switches for Nuheat group away mode
- Supports permanent, scheduled, and timed holds
- Uses Nuheat's OAuth-based API instead of legacy site scraping
- Includes compatibility improvements for Homebridge 1.8+ and 2.0 betas
- Can optionally expose a schedule switch for each thermostat
- Allows advanced OAuth overrides for long-term API stability

## Compatibility

- Homebridge: `^1.8.0 || ^2.0.0-beta.0`
- Node.js: `^18.20.4 || ^20.18.0 || ^22 || ^24`

For current Homebridge 2.0 betas, use Node 22 or 24.

## Installation

Install Homebridge first:

```bash
npm install -g homebridge
```

Then install the plugin:

```bash
npm install -g homebridge-nuheat2
```

The published package name for this maintained fork is `homebridge-nuheat2`. The Homebridge platform name in config remains `NuHeat`.

## Configuration

Most users should configure the plugin through the custom Homebridge admin UI. It is organized into Account, Accessories, Behavior, Advanced OAuth, and Diagnostics panels and writes the same config keys shown below.

Sensitive values are handled deliberately: saved passwords and legacy client secrets are not redisplayed in the UI. Leave those fields blank to keep the saved value, enter a new value to replace it, or use the Clear Overrides button in Advanced OAuth to remove OAuth overrides.

The Diagnostics panel summarizes the saved configuration and exposure strategy before restart. It does not make live Nuheat API calls.

The equivalent JSON looks like this:

```json
{
  "platform": "NuHeat",
  "name": "NuHeat",
  "email": "email@address.com",
  "password": "password123",
  "devices": [
    { "serialNumber": "1111111", "disabled": false },
    { "serialNumber": "2222222", "disabled": false }
  ],
  "autoPopulateAwayModeSwitches": true,
  "groups": [{ "groupName": "Main Floor", "disabled": false }],
  "exposeScheduleSwitches": false,
  "enableNotifications": true,
  "holdLength": 1440,
  "refresh": 60
}
```

### Options

- `platform`: Must be `NuHeat`
- `name`: Display name used in Homebridge logs
- `email`: MyNuheat account email address
- `Email`: Legacy alias still accepted for backward compatibility, but `email` is the preferred documented field
- `password`: MyNuheat account password
- `devices`: Optional list of thermostats to expose. If omitted or empty, every thermostat on the account will be discovered automatically. Blank rows in the UI are ignored
- `serialNumber`: Thermostat serial number from MyNuheat
- `disabled`: Available on `devices` and `groups` rows. Keeps the row saved while preventing that thermostat or group from being exposed
- `autoPopulateAwayModeSwitches`: Automatically expose away-mode switches for all groups on the account
- `exposeScheduleSwitches`: Optionally expose a switch per thermostat that reflects whether the thermostat is following its schedule and can be turned on to resume the schedule
- `groups`: Optional allow-list of groups to expose as away-mode switches. This only affects group/away-mode accessories. Blank rows in the UI are ignored
- `groupName`: Group name as shown in MyNuheat
- `holdLength`: Hold duration in minutes, default `1440`. Values are clamped from `0` to `1440`
- `refresh`: Poll interval in seconds, default `60`. Values lower than `30` are raised to `30` to reduce API traffic
- `enableNotifications`: Enables Nuheat SignalR notifications for faster updates. Defaults to `true`; set to `false` only while troubleshooting
- `debug`: Enables verbose Nuheat API, notification, and accessory logging. Defaults to `false`
- `clientId`: Optional advanced override for the Nuheat OAuth client ID. Current releases require this to be paired with `clientSecret`; PKCE public-client support is planned but is not active yet
- `clientSecret`: Optional legacy OAuth client secret override for confidential-client credentials. Required with a custom `clientId` until PKCE support ships. Do not publish or share this value
- `redirectUri`: Optional advanced override for the Nuheat OAuth redirect URI, default `http://localhost`

### Hold Length Behavior

- `0`: hold until the next scheduled event
- `1-1439`: timed hold for the configured number of minutes
- `1440`: permanent hold

### Device Discovery

If `devices` is omitted or empty, the plugin will automatically expose every thermostat on the authenticated account.

If `groups` is omitted and `autoPopulateAwayModeSwitches` is enabled, the plugin will automatically expose away-mode switches for all groups on the account.

If `exposeScheduleSwitches` is enabled, the plugin will also create one switch per thermostat that turns on when the thermostat is following its Nuheat schedule and can be used to resume that schedule from HomeKit.

## Nuheat API Access

Nuheat's public OpenAPI documentation indicates that third-party developers should request their own API credentials:

- [Nuheat OpenAPI docs](https://api.mynuheat.com/)
- [Nuheat API access request page](https://www.nuheat.com/openapi)

This fork still supports the legacy built-in OAuth client settings as a fallback. Nuheat is expected to issue a PKCE-based public client for this integration so the plugin can eventually ship with a public `clientId` without distributing a client secret. Until that migration is complete, keep any issued `clientSecret` out of GitHub, npm, screenshots, and shared logs.

## What's New In This Fork

- Fixed the manual-mode thermostat issue where HomeKit could immediately snap back to `Off`
- Hardened online-state parsing and general accessory refresh behavior
- Delayed platform startup until Homebridge finishes restoring cached accessories
- Improved SignalR reconnect handling
- Added regression tests for the key thermostat behavior fixes
- Updated package metadata and dependency overrides for a cleaner modern release
- Published under the maintainer-owned package identity `homebridge-nuheat2`
- Added Swagger-aligned account, schedule, and energy API helpers for future enhancements

## Development

The TypeScript migration is now underway for the core runtime. The source of truth for the platform, API client, accessories, internal models, and tests lives under `src/`, and `npm run build` compiles that back into the existing CommonJS layout used by Homebridge (`index.js`, `lib/`, and `test/`).

This keeps the published plugin layout stable while we migrate incrementally instead of doing a risky one-shot rewrite.

Common development commands:

```bash
npm run build
npm run typecheck
```

Run the test suite with:

```bash
npm test
```

## Release Automation

GitHub Actions now handles two jobs for this repository:

- `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, and `npm test` on pushes and pull requests across Node 20, 22, and 24
- `.github/workflows/publish.yml` runs on pushes to `master` when `package.json` changes, re-runs the checks on Node 24, publishes to npm only when the `package.json` version is not already on the registry, and creates or updates the matching GitHub Release

The publish workflow also maps prerelease versions to npm dist-tags automatically. For example, `1.2.7-beta.1` publishes with the `beta` tag, while stable versions publish to `latest`.

Release notes are expected in `docs/release-notes/<version>.md`. The publish workflow will fail if that file is missing for the version in `package.json`, which makes the GitHub Release step part of the normal release checklist instead of a manual follow-up.

### Recommended npm Setup

Use npm trusted publishing rather than a long-lived automation token.

1. Open the `homebridge-nuheat2` package settings on npm.
2. Add a trusted publisher for GitHub Actions.
3. Configure:
   - Organization or user: `applemanj`
   - Repository: `homebridge-nuheat2`
   - Workflow filename: `publish.yml`
4. Keep the workflow on GitHub-hosted runners.

After that, bump the version in `package.json`, push to `master`, and GitHub Actions will publish the new version automatically once the checks pass.

## Future Work

- Validate the plugin against the official Nuheat API credentials requested for this integration.
- Move the normal OAuth path to Nuheat's PKCE-based public client once the new client details are issued.
- Verify group and away-mode behavior against current live API responses.
- Evaluate whether SignalR notifications can reduce polling further in real-world deployments.
