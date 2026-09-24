---
name: Electron Forge JS Best Practices
description: Best-practices guide for Electron Forge, JavaScript, jQuery, and Yarn in EmuConfigurator
applyTo: 'src/**/*.{js,html,css}, *.{json,yml,md}, .github/**/*.md'
---

# Electron/Forge JavaScript Project Best Practices

> **Scope note:** The `applyTo` pattern `*.{json,yml,md}` intentionally covers root-level config files only
> (`package.json`, `forge.config.js`, `*.yml`, root `README.md`). It does not match `locales/**/*.json`
> or other deeply nested files; those are governed by `LOCALE-MAINTENANCE.instructions.md`.

## 1. **General Principles**
- Use **semver** for all API and protocol versioning; always check `CONFIG.apiVersion` for feature gating.
- Prefer **feature detection** (e.g., `commCapabilities` flags) over static board or hardware lists.
- Remove legacy code and static data tables when modern protocol/firmware provides authoritative info.
- Use **standard, linear commits**; avoid `git commit --amend` or history rewrites unless explicitly required.
- Keep all debugging logs transparent; never suppress errors or unknowns—log for root-cause analysis.

## 2. **Electron/Forge & Node Integration**
- Use Electron Forge for packaging, building, and cross-platform support.
- Keep all Electron main-process code in `main.js` and preload scripts in `src/js/support/`.
- Use `require`/`import` only in Node/Electron context; never in browser-only scripts.
- Use `process.env.NODE_ENV` for environment-specific logic (dev vs. prod).

### Process Lifecycle & Signal Handling
- Register `process.on('SIGINT')` and `process.on('SIGTERM')` handlers **at the very top of main.js**, before any other logic.
- These handlers ensure graceful shutdown and prevent zombie processes that hold stale lock files (critical in dev mode with yarn dev watch).
- Single-instance lock retry logic: in dev mode, disable strict single-instance enforcement or retry a few times, as Electron Forge's watch process can cause race conditions.
- Always log process exit codes: `process.on('exit', code => ...)` for debugging dev/prod lifecycle issues.
- **Timer scoping:** Declare per-window timers (e.g., debounce, zoom-restore) inside `createWindow`, not at module scope. Module-scope timers outlive the window they service and create cross-window lifetime bugs. Clear all per-window timers in the `closed` handler.

### IPC Handlers & Preload Patterns
- Define all `ipcMain.handle()` handlers in `main.js` grouped by feature (file dialogs, file I/O, system calls).
- Use async/await in IPC handlers; always handle errors and don't suppress them.
- For binary file operations, use `Buffer.from()` and `Uint8Array` conversions to avoid data corruption.
- Document IPC channel names in comments; prefix with feature name (e.g., `dialog:*`, `file:*`).
- In preload scripts, wrap IPC calls with error handling; provide clear fallback behavior if IPC fails.
- Never exclude `src/support` or preload scripts from the build; they are essential for security, polyfills, and IPC. Always verify `dist/support/preload.js` exists after build.

## 3. **JavaScript & jQuery**
- Use **strict mode** (`'use strict';`) in all JS files.
- Prefer **vanilla JS** for new code; use jQuery only for legacy UI or where DOM manipulation is complex.
- Always namespace global variables and functions to avoid collisions.
- Use `let`/`const` for all new variable declarations; avoid `var` except for legacy compatibility.
- Modularize code: keep each logical unit (tab, feature, protocol) in its own file.
- Use **event delegation** for dynamic DOM elements.
- Avoid inline JS in HTML; keep logic in external scripts.
- **NaN vs. falsy coercion:** Never use `Number(x) || fallback` for numeric defaults — `0` is falsy and will be incorrectly replaced. Use `Number.isNaN(Number(x)) ? fallback : Number(x)` instead.
- **Null guards at call-site:** Guard optional object references (e.g., `BrowserWindow.getFocusedWindow()`) with `if (obj)` before passing them to functions, even when the callee has an internal guard. Consistency prevents silent no-ops that are hard to trace.
- **Single entry point for shared state:** All mutations to a shared variable must route through one orchestrating function (e.g., `applyZoom`). Avoid thin helpers that update state directly — they create bypass paths that cause desynchronisation and are easy to call out-of-band.
- **Avoid redundant single-callsite helpers:** If a helper function only exists to assign one variable and has a single call site inside the orchestrator, inline it. Separate helpers that can be called independently introduce bypass risk with no benefit.
- **`for...of` must declare the loop variable:** Always write `for (const item of array)` — bare `for (item of array)` without `const`/`let` creates an implicit global in sloppy mode and throws `ReferenceError` in strict mode (`'use strict'`). This is a silent runtime-only failure; linters may not catch it if the variable was declared elsewhere in scope.

## 4. **3rd Party Dependencies & Yarn**
- Use **yarn** for all dependency management; never mix with npm.
- Use **Yarn 1.x (Classic)** only — Yarn 2+/Berry is incompatible with this project's configuration.
- Commit `yarn.lock` to version control; it ensures reproducible installs across all environments.
- Pin dependency versions in `package.json` for reproducible builds.
- Regularly audit dependencies for security and compatibility.
- Prefer CDN or local copies for browser-side libraries (e.g., jQuery, D3, Three.js).
- Remove unused libraries from `libraries/` and `package.json`.
- **Node.js:** Use the latest stable LTS version per the [Node.js release schedule](https://nodejs.org/en/about/previous-releases). Update CI workflows when a new LTS is released.

## 5. **Electron Security**
- **Current State (Legacy Exception):** `main.js` currently uses `nodeIntegration: true` and `contextIsolation: false` for historical compatibility with legacy `require()` calls in renderer HTML scripts. Do not replicate this for new windows or features.
- **Migration Target:** Move all Node/Electron logic to preload scripts, then restore `nodeIntegration: false` and `contextIsolation: true`.
- Never enable `nodeIntegration` for new `BrowserWindow` instances or new renderer contexts.
- Use `contextIsolation: true` for any new `BrowserWindow` configs.
- Validate all IPC messages and sanitize user input.
- Never expose sensitive Node APIs to the renderer.
- Release notes render as markdown through `marked` by design (firmware flasher, IMU-F flasher). Sources are official and dev releases only.
- Keep `marked` current: apply its security updates and check `yarn audit`. Do not replace the rendering to address a review finding.

## 6. **Testing & Linting**
- Use ESLint with a strict, project-specific config; fix all warnings and errors before commit.
- **Remove dead code:** Never hide unused variables with prefixes (e.g., `_unused`). Delete them or fix the code path.
  - **Exception — API-contract positional params:** When a third-party library (e.g., textcomplete, jQuery callbacks) requires a fixed function signature for positional argument binding, unused trailing params that cannot be removed must be prefixed with `_` (e.g., `_match`, `_value`). This is the ESLint-standard convention paired with `"argsIgnorePattern": "^_"` in `.eslintrc.json`. This is the only acceptable use of the `_` prefix; it does not apply to variables.
- Use `karma` for browser-based unit tests; keep tests in `test/`.
- Prefer test-driven bugfixes: add a test for every bug found.
- Run all tests and lints before every commit.
- When changing i18n or asset paths, always test with Electron's `file://` protocol, not just in a web browser.

## 7. **Documentation & Instructions**
- Keep all project instructions in `.github/instructions/` with clear `applyTo:` patterns.
- Document all public functions and modules with concise JSDoc comments.
- Keep README.md up to date with build, run, and contribution instructions.
- Use markdown best practices: short sections, clear headings, and code blocks for examples.

## 8. **UI/UX**
- Use CSS classes for all styling; never use inline styles.
- Prefer CSS variables for theme/color management.
- Keep dialogs and modals compact: use `max-height`, `overflow-y: auto`, and consistent padding.
- Use ARIA attributes (`role`, `aria-label`, `aria-describedby`) for accessibility.
- Use i18n for all user-facing strings; never hardcode UI text.
- **Flex label+icon containers:** For column-header rows that contain a text label and a tooltip helpicon in a flex container, use `flex-flow: row nowrap` (not `row wrap`) and add `flex-shrink: 0` on the icon element. Without these, the icon wraps to a new line when the window is narrow.

## 9. **Version Control & Branching**
- Use feature branches for all new work; keep master/main clean.
- Rebase or merge regularly to avoid long-lived divergence.
- Never force-push to shared branches unless coordinated.
- Always document the reason for force-pushes in commit messages or PRs.

## 10. **Legacy & Compatibility**
- Maintain backward compatibility with older firmware where feasible, but prefer modern protocol features.
- Remove legacy code only after confirming no active users depend on it.
- Clearly mark deprecated features and provide migration paths.

## 11. **Implementation Notes & Known Exceptions**

### Chrome API Polyfills (preload.js)
- When shimming Chrome APIs (e.g., `chrome.fileSystem`, `chrome.storage`), build complete, stateful entry/writer objects that match the Chrome API contract.
- For file write operations, track `writer.position`, `writer.length`, and `writer.readyState` to properly implement the FileWriter state machine.
- Use `blob.arrayBuffer()` for binary blob manipulation; pass byte arrays to IPC handlers, not raw blobs.
- For file system operations, always create parent directories with `mkdir(..., { recursive: true })` before writing.
- Document which Chrome APIs are shimmed and why (e.g., "Betaflight uses chrome.fileSystem for firmware flashing, which Electron doesn't provide natively").

### ESLint Configuration
- Declare browser-script globals in the `globals` section of `.eslintrc.json` as `readonly` so ESLint knows those identifiers are defined externally (this is separate from `no-unused-vars` pattern matching).
- Use `varsIgnorePattern` in the `no-unused-vars` rule to suppress warnings for CONSTANT_CASE or special variables (e.g., `isDev`, `checked`).
- Use `argsIgnorePattern: "^_"` to allow underscore-prefixed unused parameters in API-contract functions (e.g., jQuery callbacks).
- Never suppress ESLint warnings with inline comments unless the warning is a false positive; instead, fix the code or update the configuration.

### File Operations & Binary Data
- When writing binary data (e.g., firmware, logs, recordings), always use separate IPC handlers from text handlers to avoid encoding issues.
- For large file writes (e.g., firmware downloads), truncate the file first, then write in chunks; do not append to avoid duplication bugs.
- File truncation must zero out the file before writing: `ipcMain.handle('dialog:truncate-file', ...)` should use `fs.truncateSync()` or similar.
- Always track file position and length in write operations; bugs often occur when position doesn't match written bytes.
- For BBL (blackbox logs) and other streaming downloads, ensure only the final chunk is written, not duplicate or partial chunks.

---
This file is the authoritative best-practices guide for this Electron Forge, JavaScript, jQuery, and Yarn-based project. All contributors should follow these rules for maintainability, security, and long-term success.
