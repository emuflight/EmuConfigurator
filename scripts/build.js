#!/usr/bin/env node
'use strict';

/**
 * Build script: replaces Gulp for the dist/ assembly step.
 * Copies src → dist, locales, libraries, resources, and writes version.json.
 * No compilation/transpilation — all renderer code is plain JS.
 *
 * Replicates what the old gulp tasks did:
 *   dist_src      : src/**  → dist/
 *   dist_locale   : locales → dist/_locales/
 *   dist_libraries: libraries → dist/js/libraries/
 *   dist_resources: resources (no osd PNGs) → dist/resources/
 *   writeChangesetId: writes dist/version.json
 *
 * Intentionally omits dist_yarn (yarn install --production in dist/) because
 * node module resolution walks up to root node_modules/ which has all deps.
 */

const fs   = require('fs');
const path = require('path');
const fse  = require('fs-extra');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg  = require(path.join(ROOT, 'package.json'));

// Files/dirs excluded from src → dist copy (mirrors gulp distSources negations)
// NOTE: support/ MUST NOT be excluded - preload.js is required for Electron!
const SRC_EXCLUDE_FILES = [
  'css/dropdown-lists/LICENSE',
  'css/font-awesome/css/font-awesome.css',
];
const SRC_EXCLUDE_DIRS = [
  // 'support', // CRITICAL: preload.js must be available for Electron
];

function srcFilter(src) {
  const rel = path.relative(path.join(ROOT, 'src'), src);
  if (SRC_EXCLUDE_FILES.some(f => rel === f || rel === f.replace(/\//g, path.sep))) return false;
  if (SRC_EXCLUDE_DIRS.some(d => rel.startsWith(d + path.sep) || rel === d)) return false;
  return true;
}

function osdFilter(src) {
  // Exclude resources/osd/**/*.png
  const rel = path.relative(ROOT, src);
  const isOsd = rel.startsWith('resources' + path.sep + 'osd') ||
                rel.startsWith('resources/osd');
  return !(isOsd && src.endsWith('.png'));
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unsupported';
  }
}

function build() {
  console.log('[build] Cleaning dist/...');
  fse.removeSync(DIST);
  fse.ensureDirSync(DIST);

  // src/**/* → dist/  (base: src, so src/foo.js → dist/foo.js)
  console.log('[build] Copying src → dist/');
  fse.copySync(path.join(ROOT, 'src'), DIST, { filter: srcFilter });

  // locales/**/* → dist/_locales/  (base: locales, so locales/en → dist/_locales/en)
  console.log('[build] Copying locales → dist/_locales/');
  fse.copySync(path.join(ROOT, 'locales'), path.join(DIST, '_locales'));

  // libraries/**/* → dist/js/libraries/  (base: ., so libraries/foo → dist/js/libraries/foo)
  console.log('[build] Copying libraries → dist/js/libraries/');
  fse.copySync(path.join(ROOT, 'libraries'), path.join(DIST, 'js', 'libraries'));

  // resources/**/* → dist/resources/  (base: ., excluding osd PNGs)
  console.log('[build] Copying resources → dist/resources/');
  fse.copySync(path.join(ROOT, 'resources'), path.join(DIST, 'resources'), { filter: osdFilter });

  // Copy jBox CSS from node_modules to dist/css/ so main.html can find it
  console.log('[build] Copying jBox CSS → dist/css/');
  const jboxSrc = path.join(ROOT, 'node_modules', 'jbox', 'dist', 'jBox.min.css');
  const jboxDst = path.join(DIST, 'css', 'jBox.min.css');
  if (fs.existsSync(jboxSrc)) {
    try {
      fse.ensureDirSync(path.dirname(jboxDst));
      fse.copyFileSync(jboxSrc, jboxDst);
    } catch (e) {
      console.error('[build] ERROR: Failed to copy jBox.min.css:', e.message);
      process.exit(1);
    }
  } else {
    console.error('[build] ERROR: jBox.min.css not found at', jboxSrc);
    process.exit(1);
  }

  // Copy jquery and jquery-ui to dist/js/libraries/ so receiver_msp.html
  // can reference them via ../js/libraries/ instead of ../node_modules/.
  // node_modules is not included in the dist/ tree.
  console.log('[build] Copying jquery → dist/js/libraries/');
  const libDir = path.join(DIST, 'js', 'libraries');
  fse.ensureDirSync(libDir);
  const jquerySrc = path.join(ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
  if (fs.existsSync(jquerySrc)) {
    try {
      fse.copyFileSync(jquerySrc, path.join(libDir, 'jquery.min.js'));
    } catch (e) {
      console.error('[build] ERROR: Failed to copy jquery.min.js:', e.message);
      process.exit(1);
    }
  } else {
    console.error('[build] ERROR: jquery.min.js not found at', jquerySrc);
    process.exit(1);
  }
  const jqueryUiSrc = path.join(ROOT, 'node_modules', 'jquery-ui-npm', 'jquery-ui.min.js');
  if (fs.existsSync(jqueryUiSrc)) {
    try {
      fse.copyFileSync(jqueryUiSrc, path.join(libDir, 'jquery-ui.min.js'));
    } catch (e) {
      console.error('[build] ERROR: Failed to copy jquery-ui.min.js:', e.message);
      process.exit(1);
    }
  } else {
    console.error('[build] ERROR: jquery-ui.min.js not found at', jqueryUiSrc);
    process.exit(1);
  }

  // Write version.json
  const gitHash = getGitHash();
  const versionJson = JSON.stringify(
    { gitChangesetId: gitHash, version: pkg.version, max_msp: pkg.max_msp },
    null, 2
  );
  fs.writeFileSync(path.join(DIST, 'version.json'), versionJson);
  console.log(`[build] Done. v${pkg.version}  git:${gitHash}`);
}

if (require.main === module) {
  build();
}

module.exports = build;
