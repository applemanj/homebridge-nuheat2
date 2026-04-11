# Changelog

All notable changes to this project should be documented in this file

## [Unreleased]

## [1.2.4-beta.1] - 2026-04-11

### Added

- Swagger-aligned internal model helpers for account, thermostat, schedule, group, and energy responses
- Optional per-thermostat schedule switches that can resume schedule mode from HomeKit
- Account, schedule, and energy log API helpers for future UI and automation features

### Changed

- Simplify thermostat operating-mode handling to match the documented Nuheat Swagger model
- Refresh thermostats when Nuheat sends schedule notifications

## [1.2.4-beta.0] - 2026-04-11

### Changed

- Delay platform startup until Homebridge finishes restoring cached accessories
- Allow overriding Nuheat OAuth client settings through config or environment variables
- Improve SignalR reconnection handling and token refresh behavior
- Add basic regression tests and modernize package metadata for Homebridge 1.8+ and 2.0 betas
- Publish the maintained fork under the new npm package identity `homebridge-nuheat2`

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
