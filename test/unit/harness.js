'use strict';
// Loads the configurator's browser-global scripts into an isolated vm context so
// pure MSP and version logic can be tested without Electron, jQuery or a DOM.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function createContext(files, globals) {
    const sandbox = Object.assign({ console: { log() {}, warn() {}, error() {} } }, globals || {});
    const context = vm.createContext(sandbox);
    for (const file of files) {
        const full = path.join(ROOT, file);
        vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: full });
    }
    return context;
}

function run(context, code) {
    return vm.runInContext(code, context);
}

module.exports = { ROOT, createContext, run };
