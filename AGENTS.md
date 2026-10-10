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

There is no test runner. `test/karma.conf.js` lists packages that are not installed, `package.json` has no `test` script, and CI has no test step. Do not report that tests pass. State that no test harness exists.

This section overrides the Karma and "run all tests" lines in `ELECTRON-FORGE-JS-BEST-PRACTICES.instructions.md` until a runnable harness exists.

## Dependencies and native modules

- Do not modify `node_modules/`. It is generated and git-ignored.
- Fix native-module problems with official `rebuildConfig` options in `forge.config.js`, dependency versions in `package.json`, or an upstream fix. Do not add postinstall hacks or custom build scripts.
- `yarn install` then `yarn dev` must work on a fresh checkout. `git clean -dxf` deletes untracked and ignored files, including local work. Run it only in a throwaway clone.

## Firmware API version limits

The MSP API version is `major.minor.patch`.

- **major.minor**: protocol generation. A new minor can change message layouts.
- **patch**: additive, backward-compatible MSP features. Firmware increments it once per feature and resets it to 0 on a minor bump. The configurator reads it from the 4th byte of `MSP_API_VERSION`. Firmware that omits the byte reports patch 0.

Limits:

- `max_msp` in `package.json` is the highest firmware API the UI supports.
  - `scripts/build.js` writes it to `version.json`. `src/js/main.js` loads it into `CONFIGURATOR.max_msp`.
  - `apiVersionWithinMaxMsp()` in `src/js/serial_backend.js` compares only `major.minor`. A patch above `max_msp` still connects and loads the full UI.
  - Firmware whose `major.minor` is above `max_msp` shows a warning and opens only the CLI tab.
- Raise `max_msp` to the new `major.minor` when firmware bumps the minor. Also set its patch to the highest gated patch, so it records the newest API the code supports.
- `CONFIGURATOR.apiVersionAccepted` in `src/js/data_storage.js` is the lowest firmware API accepted for full configuration UI access. Firmware below it shows a warning and opens only the CLI tab.

Gating features:

- Gate new MSP messages and fields on the full version: `semver.gte(CONFIG.apiVersion, "<major.minor.patch>")` in `src/js/msp/MSPHelper.js` or the tab file. Use the patch level for additive features.
- Do not send a new message to older firmware.
- Keep a gate version in one named constant when several places use it.
- A patch gate assumes firmware lands patch features in order. When that is not guaranteed, also check the reply and fall back when it is missing.
- A gate written for patch N of one minor does not apply to the next minor. Re-set it when the minor bumps.

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
