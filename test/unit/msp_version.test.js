'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, createContext, run } = require('./harness');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (entry.name.endsWith('.js')) {
            out.push(full);
        }
    }
    return out;
}

// Every MSP API version the source compares CONFIG.apiVersion against, plus named gate constants.
function collectApiVersions() {
    const found = [];
    const compare = /semver\.(?:gte|gt|lte|lt|eq)\(\s*(?:FC\.)?CONFIG\.apiVersion\s*,\s*["'](\d+\.\d+\.\d+)["']/g;
    const named = /[A-Z_]*API_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/g;
    for (const file of walk(path.join(ROOT, 'src', 'js'), [])) {
        const text = fs.readFileSync(file, 'utf8');
        for (const re of [compare, named]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                found.push({ file: path.relative(ROOT, file), version: m[1] });
            }
        }
    }
    return found;
}

test('package.json max_msp is a valid semver', () => {
    assert.match(pkg.max_msp, /^\d+\.\d+\.\d+$/);
});

test('max_msp is at least every MSP API version the source gates on', () => {
    const ctx = createContext(['libraries/semver.js'], {});
    run(ctx, `var max = ${JSON.stringify(pkg.max_msp)};`);
    const gates = collectApiVersions();
    assert.ok(gates.length > 0, 'no apiVersion gates found; the collector regex is stale');
    for (const gate of gates) {
        const ok = run(ctx, `semver.gte(max, ${JSON.stringify(gate.version)})`);
        assert.ok(ok, `${gate.file} gates on API ${gate.version} but max_msp is ${pkg.max_msp}; raise max_msp`);
    }
});

test('apiVersionWithinMaxMsp compares major.minor and ignores the patch', () => {
    const ctx = createContext(['libraries/semver.js', 'src/js/serial_backend.js'], {});
    run(ctx, `
        var CONFIGURATOR = { max_msp: ${JSON.stringify(pkg.max_msp)} };
        var CONFIG = {};
        function within(v) { CONFIG.apiVersion = v; return apiVersionWithinMaxMsp(); }
    `);
    const [major, minor] = pkg.max_msp.split('.').map(Number);
    assert.equal(run(ctx, `within('${major}.${minor}.0')`), true);
    assert.equal(run(ctx, `within('${major}.${minor}.99')`), true, 'patch bumps must be tolerated');
    assert.equal(run(ctx, `within('${major}.${minor + 1}.0')`), false, 'next minor must be refused');
    assert.equal(run(ctx, `within('${major + 1}.0.0')`), false);
    assert.equal(run(ctx, `within('garbage')`), false);
    assert.equal(run(ctx, `within('1.40.0')`), true);
});
