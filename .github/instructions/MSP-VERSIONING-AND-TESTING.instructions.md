---
name: MSP Versioning and Unit Tests
description: Rules for MSP API version gates, the max_msp ceiling, and the node:test unit suite in EmuConfigurator
applyTo: 'src/js/**/*.js, package.json, test/unit/**/*.js'
---

# MSP versioning and unit tests

## `max_msp` is required

- `package.json` `max_msp` is the highest MSP API version this configurator supports.
- `scripts/build.js` writes it to `version.json`. `src/js/main.js` loads it into `CONFIGURATOR.max_msp`.
- `apiVersionWithinMaxMsp()` in `src/js/serial_backend.js` compares major.minor only. A patch bump never triggers the CLI-only fallback.
- Above `max_msp`, the configurator shows a warning and opens the CLI tab only.
- Raise `max_msp` in the same change that adds a gate on a newer API version.
- Raise it to the new minor when firmware bumps the API minor, or the GUI is lost on that firmware.

## API version gates

- Gate new MSP messages and fields on `semver.gte(CONFIG.apiVersion, "<major.minor.patch>")`.
- Keep the version in one named constant when more than one place uses it (example: `TABS.auxiliary.LINKED_MODES_API_VERSION`).
- Do not send a new MSP message to firmware below the gate version.
- Check the reply as well when firmware builds could report the version without the message.
- A firmware patch bump and the configurator gate constant move together. If another MSP change merges first, re-set both.
- Firmware sends the patch byte in `MSP_API_VERSION`. `MSPHelper.js` parses it.

## Unit tests

- Run `yarn test`. It uses the Node built-in test runner. It needs no extra packages.
- Tests live in `test/unit/*.test.js`. `test/unit/harness.js` loads the browser-global scripts into a `vm` context.
- Stub `MSP`, `CONFIG`, `TABS` and `GUI` as needed.
- Tab rendering and click handlers run in `jsdom` (`test/unit/auxiliary_dom.test.js`). Run scripts with `vm.Script` in the jsdom context, not `eval`: the files start with `'use strict'`.
- Derive expected bytes and values from the MSP spec or the firmware source, not from the code under test.
- Add at least one test that tries to break the logic: wrong version, malformed or empty reply, length mismatch.
- `test/unit/msp_version.test.js` fails when `max_msp` is below any API version used in a gate. Do not edit it to pass.
- The harness cannot cover real serial I/O, firmware behavior or timing. Test those on a real FC and state that in the PR.
- `test/karma.conf.js` and `test/tabs/cli.js` are not run by `yarn test`.
