# Changelog

All notable changes to this project should be documented in this file

## [Unreleased]

### Changed

- Subscribe to Nuheat schedule notifications alongside thermostat and group notifications
- Remove an unused Homebridge UI utility dependency from the published package
- Improve Homebridge Config UI labels, defaults, grouping, and sensitive-field handling
- Add a custom Homebridge admin UI aligned with the shared Roborock design system
- Document the upcoming PKCE public-client direction for Nuheat OAuth credentials
- Enforce a 30-second minimum polling interval at runtime to reduce accidental API load

### Fixed

- Correct refresh-token rotation debug logging so it compares against the previous token
- Keep notification de-duplication bookkeeping consistent across mixed notification batches

## [1.2.12] - 2026-04-21

### Fixed

- Treat Nuheat thermostats as heat-only in HomeKit so the target mode no longer advertises a misleading off option
- Translate any incoming HomeKit off request into the minimum Nuheat setpoint instead of bouncing back after refresh
- Apply the Nuheat account temperature scale to the thermostat display-units characteristic so HomeKit shows the correct hardware display unit
- Coalesce and briefly de-duplicate repeated SignalR thermostat and group notifications to reduce redundant full refreshes and log noise

## [1.2.11] - 2026-04-21

### Fixed

- Relax the optional `devices` and `groups` array item schema so Homebridge Config UI no longer shows validation errors for blank rows
- Ignore blank `devices` rows at runtime so they do not interfere with thermostat auto-discovery

## [1.2.10] - 2026-04-21

### Added

- Add non-sensitive OAuth debug logging for configured client ID, requested scopes, consent handling, and refresh-token rotation during local API credential validation

### Changed

- Request the full issued Nuheat OAuth scope set: `openapi openid profile offline_access`

## [1.2.9] - 2026-04-15

### Fixed

- Remove the published `homebridge` peer dependency so verification installs no longer pull in `homebridge` and `hap-nodejs`

## [1.2.8] - 2026-04-15

### Fixed

- Correct `config.schema.json` to use object-level `required` arrays so Homebridge verification accepts the schema

## [1.2.7] - 2026-04-15

### Added

- TypeScript build and typecheck scaffolding for incremental migration
- TypeScript tests for the Swagger-normalization helpers, schedule switch, and thermostat behavior
- GitHub Actions workflows for CI validation and automated npm publishing

### Changed

- Move the platform entrypoint, API client, accessory classes, logger, settings, models, and test helpers to TypeScript source under `src/`
- Keep the published CommonJS runtime layout stable by compiling TypeScript back into `index.js`, `lib/`, and `test/`
- Switch package repository metadata to the canonical GitHub URL for npm trusted publishing and provenance

## [1.2.6] - 2026-04-11

### Added

- Add an `enableNotifications` config option so SignalR can be disabled during troubleshooting

### Changed

- Skip group setup and refresh calls unless away-mode groups are actually configured
- Improve Nuheat API error logging with request method, endpoint, status code, and response snippets

## [1.2.5] - 2026-04-11

### Changed

- Refactor platform accessory setup paths to reduce repeated lookups and simplify accessory updates
- Consolidate shared Homebridge test stubs into reusable helpers
- Restrict the test script to `*.test.js` files for cleaner local and CI output

### Fixed

- Improve SignalR notification tracing readability
- Correct setpoint debug log spacing in thermostat updates

## [1.2.4] - 2026-04-11

### Added

- Swagger-aligned internal model helpers for account, thermostat, schedule, group, and energy responses
- Optional per-thermostat schedule switches that can resume schedule mode from HomeKit
- Account, schedule, and energy log API helpers for future UI and automation features

### Changed

- Delay platform startup until Homebridge finishes restoring cached accessories
- Allow overriding Nuheat OAuth client settings through config or environment variables
- Improve SignalR reconnection handling and token refresh behavior
- Add regression tests and modernize package metadata for current Homebridge releases
- Publish the maintained fork under the npm package identity `homebridge-nuheat2`
- Simplify thermostat operating-mode handling to match the documented Nuheat Swagger model
- Refresh thermostats when Nuheat sends schedule notifications

### Fixed

- Correct manual-mode thermostat mapping so HomeKit no longer snaps back to off
- Fix thermostat online-state handling so status updates no longer rely on an assignment bug
- Pin transitive websocket and cookie dependencies away from known vulnerable versions

## [1.2.3] - 2024-11-04

### Fixed

- Bug when using away mode switches
- Variable handling in some debug logging

## [1.2.2] - 2023-06-13

### Fixed

- variable typo

## [1.2.1] - 2023-06-01

### Fixed

- hold length bug

## [1.2.0] - 2023-05-26

### Changed

- client secret for api auth

### Fixed

- async updates from the api to reduce cookie creation

## [1.1.4] - 2023-05-12

### Changed

- error handling when unable to get access token, as to not crash homebridge

## [1.1.3] - 2023-04-17

### Fixed

- typo in away mode

## [1.1.2] - 2022-12-24

### Fixed

- some unhandled api auth error

### Changed

- some debug logging code

## [1.1.1] - 2022-11-17

### Fixed

- changed the 'homebridge-nuheat' name to be lower case so HOOBS handles properly

## [1.1.0] - 2022-11-15

### Added

- Added `homebridge-ui` support with auto detection
- Added Away Mode switches for groups

### Changed

- Changed the underlying API to use nuheats new api system
