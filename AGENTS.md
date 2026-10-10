# AGENTS.md

Guidance for contributors and AI coding tools working in this repository.

EmuFlight Configurator: an Electron/Forge desktop app written in JavaScript with jQuery 3.

## Commands

The repository uses yarn only (yarn 1.22, Node 24 or newer; see `.nvmrc`). Do not use npm or npx.

| Command | Purpose |
|---|---|
| `yarn install` | Install dependencies |
| `yarn lint` | ESLint. Errors fail CI. |
| `yarn dev` | Run the app in development mode |
| `yarn make:debug` | Build debug packages with the DevTools menu |
| `yarn build` | Generate `dist/` only |
| `yarn setup:hooks` | Install the pre-commit lint hook |

There is no `yarn start` script.

CI (`.github/workflows/build.yml`) runs `yarn install --frozen-lockfile`, `yarn lint` and `yarn verify:cross-env`. It then runs `node scripts/build.js` and `yarn run electron-forge make`, with `--arch` for Windows jobs.

## Tests

Run `yarn test`. It uses the Node built-in runner on `test/unit/*.test.js`. `test/unit/harness.js` loads the browser-global scripts into a `vm` context. Tab rendering and click handlers run in `jsdom` (`test/unit/auxiliary_dom.test.js`); run scripts with `vm.Script` in the jsdom context, not `eval`.

The suite covers MSP decode and encode, API version gates, the `max_msp` ceiling, and the Auxiliary tab. It does not cover serial I/O or firmware behavior; test those on a real FC and say so. Derive expected bytes from the MSP spec or firmware source, add at least one test that tries to break the logic, and do not edit a test to make it pass.

`test/karma.conf.js` and `test/tabs/cli.js` are not run by `yarn test`.

This section overrides the Karma and "run all tests" lines in `ELECTRON-FORGE-JS-BEST-PRACTICES.instructions.md`.

## Dependencies and native modules

- Do not modify `node_modules/`. It is generated and git-ignored.
- Fix native-module problems with official `rebuildConfig` options in `forge.config.js`, dependency versions in `package.json`, or an upstream fix. Do not add postinstall hacks or custom build scripts.
- `yarn install` then `yarn dev` must work on a fresh checkout. `git clean -dxf` deletes untracked and ignored files, including local work. Run it only in a throwaway clone.

## Firmware API version limits

The MSP API version is `major.minor.patch`.

- **major.minor**: protocol generation. A new minor can change message layouts.
- **patch**: additive, backward-compatible MSP features. This is an intentional EmuFlight convention. The firmware protocol header (`src/main/interface/msp_protocol.h` in the EmuFlight repository) specifies: increment once per backward-compatible MSP feature, reset to 0 on a minor bump. The configurator reads the patch from the 4th byte of `MSP_API_VERSION` and treats an omitted byte as 0.

Limits:

- `max_msp` in `package.json` is the upper `major.minor` limit of firmware the UI supports. Its patch is documentation metadata that records the newest gated patch; the connection check does not enforce it.
  - `scripts/build.js` writes it to `version.json`. `src/js/main.js` loads it into `CONFIGURATOR.max_msp`.
  - `apiVersionWithinMaxMsp()` in `src/js/serial_backend.js` compares only `major.minor`. A patch above `max_msp` does not trigger the CLI-only fallback. Full UI access still needs the minimum API check, the `EMUF` identifier and a successful handshake.
  - Firmware whose `major.minor` is above `max_msp` shows a warning and opens only the CLI tab.
- Raise `max_msp` when the configurator implements and verifies support for a new `major.minor`, not merely because firmware bumped it. Set its patch to the highest gated patch.
- `CONFIGURATOR.apiVersionAccepted` in `src/js/data_storage.js` is the lowest firmware API accepted for full configuration UI access. Firmware below it shows a warning and opens only the CLI tab.

Gating features:

- Gate new MSP messages and fields on the full version: `semver.gte(CONFIG.apiVersion, "<major.minor.patch>")` in `src/js/msp/MSPHelper.js` or the tab file. Use the patch level for additive features.
- Do not send a new message to older firmware.
- Keep a gate version in one named constant when several places use it.
- A patch gate assumes that, within one `major.minor`, higher patches keep the feature. When that is not guaranteed, also check for an unsupported response and the payload length. Do not let an optional request block the connection when the FC sends no response.
- Revalidate patch-gated features when supporting a new minor. A lower-bound semver gate stays true for later minors even though their patch resets to 0 (`semver.gte("1.56.0", "1.55.3")` is true). Keep the gate if the feature stays compatible. Otherwise add a version range or a capability check. Do not change an existing threshold to the new minor: that disables a feature on older firmware that already has it.

## Architecture

- Renderer state uses browser globals, not module imports: `TABS`, `GUI`, `CONFIGURATOR`, `CONFIG`, `FC`, `MSP`, `MSPCodes`.
- `FC.resetState()` runs on every connect and resets the firmware state variables in `src/js/fc.js`.
- Tabs: logic in `src/js/tabs/<name>.js`, markup in `src/tabs/<name>.html`.
- MSP: `src/js/msp.js` (transport), `src/js/msp/MSPCodes.js` (codes), `src/js/msp/MSPHelper.js` (encode and decode).
- Translations: `locales/<language>/messages.json`. Third-party scripts: `libraries/`.

## Instruction files

Follow these files. They are not repeated here.

| File | Applies to |
|---|---|
| `.github/instructions/ELECTRON-FORGE-JS-BEST-PRACTICES.instructions.md` | `src/**/*.{js,html,css}`, root `*.{json,yml,md}`, `.github/**/*.md`: Electron, Forge, JavaScript, jQuery, yarn |
| `.github/instructions/LOCALE-MAINTENANCE.instructions.md` | `locales/**/*.json`: keys are never translated, only values |
| `.github/instructions/TRANSLATION-TERMINOLOGY.instructions.md` | `locales/**/*.json`: terms kept in English across locales |
