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

Most users should configure the plugin through Homebridge Config UI X, but the equivalent JSON looks like this:

```json
{
  "platform": "NuHeat",
  "name": "NuHeat",
  "email": "email@address.com",
  "password": "password123",
  "devices": [{ "serialNumber": "1111111" }, { "serialNumber": "2222222" }],
  "autoPopulateAwayModeSwitches": true,
  "exposeScheduleSwitches": false,
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
- `devices`: Optional list of thermostats to expose. If omitted or empty, every thermostat on the account will be discovered automatically
- `serialNumber`: Thermostat serial number from MyNuheat
- `autoPopulateAwayModeSwitches`: Automatically expose away-mode switches for all groups on the account
- `exposeScheduleSwitches`: Optionally expose a switch per thermostat that reflects whether the thermostat is following its schedule and can be turned on to resume the schedule
- `groups`: Optional allow-list of groups to expose as away-mode switches. This only affects group/away-mode accessories
- `groupName`: Group name as shown in MyNuheat
- `holdLength`: Hold duration in minutes
- `refresh`: Poll interval in seconds, default `60`
- `debug`: Enables verbose logging
- `clientId`: Optional advanced override for the Nuheat OAuth client ID. This is recommended once you have official Nuheat API credentials
- `clientSecret`: Optional advanced override for the Nuheat OAuth client secret
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

This fork still supports the legacy built-in OAuth client settings as a fallback, but using your own `clientId` and `clientSecret` is the recommended long-term path once Nuheat issues them for your integration.

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

Run the test suite with:

```bash
npm test
```

## Future Work

- Validate the plugin against the official Nuheat API credentials requested for this integration.
- Verify group and away-mode behavior against current live API responses.
- Evaluate whether SignalR notifications can reduce polling further in real-world deployments.
