'use strict';
// DOM-level tests for the Auxiliary tab: rendering and the save click handler run in jsdom.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM } = require('jsdom');
const { ROOT } = require('./harness');

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const HTML = read('src/tabs/auxiliary.html');
const SCRIPTS = [
    require.resolve('jquery/dist/jquery.js'),
    path.join(ROOT, 'libraries/jquery.nouislider.all.min.js'),
    path.join(ROOT, 'libraries/semver.js'),
    path.join(ROOT, 'src/js/injected_methods.js'),
    path.join(ROOT, 'src/js/msp/MSPCodes.js'),
    path.join(ROOT, 'src/js/msp/MSPHelper.js'),
    path.join(ROOT, 'src/js/tabs/auxiliary.js'),
];

// Mode names and permanent IDs: ARM=0, ANGLE=1, HORIZON=2, BEEPER=13.
const MODES = { names: ['ARM', 'ANGLE', 'HORIZON', 'BEEPER'], ids: [0, 1, 2, 13] };

// Starts the tab in a fresh jsdom window and walks its init chain with a stubbed MSP.
function openTab({ apiVersion, modeRanges, extra }) {
    const dom = new JSDOM('<!doctype html><html><body><div id="content"></div></body></html>', {
        runScripts: 'outside-only',
    });
    const w = dom.window;
    // run as scripts, not eval: the files start with 'use strict' and must still define globals
    const context = dom.getInternalVMContext();
    const runScript = (code, filename) => new vm.Script(code, { filename }).runInContext(context);
    runScript(`
        var CONFIG = { apiVersion: '${apiVersion}', mode: 0, armingDisableCount: 0, armingDisableFlags: 0 };
        var RC = { active_channels: 8, channels: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500] };
        var RSSI_CONFIG = { channel: 0 };
        var AUX_CONFIG = ${JSON.stringify(MODES.names)};
        var AUX_CONFIG_IDS = ${JSON.stringify(MODES.ids)};
        var MODE_RANGES = ${JSON.stringify(modeRanges)};
        var MODE_RANGES_EXTRA = [];
        var EXTRA_REPLY = ${JSON.stringify(extra)};
        var sentMessages = [];
        var i18n = { getMessage: function (k) { return k; }, localizePage: function () {} };
        var GUI = { interval_add: function () {}, content_ready: function (cb) { if (cb) { cb(); } }, log: function () {} };
        var TABS = {};
        var ConfigStorage = { get: function (key, cb) { cb({}); }, set: function () {} };
        var MSP = {
            send_message: function (code, data, cbSent, cbMsp) {
                sentMessages.push({ code: code, data: data });
                if (code === MSPCodes.MSP_MODE_RANGES_EXTRA) { MODE_RANGES_EXTRA = EXTRA_REPLY.slice(); }
                if (cbMsp) { cbMsp({}); }
            },
            beginProtectedSave: function () { return 1; },
            endProtectedSave: function () {}
        };
        var bit_check = function (n, b) { return (n >> b) & 1; };
        var adjustBoxNameIfPeripheralWithModeID = function (id, name) { return name; };
    `, 'setup.js');
    for (const file of SCRIPTS) {
        runScript(fs.readFileSync(file, 'utf8'), file);
    }
    runScript('var mspHelper = new MspHelper();', 'helper.js');
    // the real tab loads its HTML through jQuery .load(); serve the file synchronously instead
    w.$.fn.load = function (url, cb) {
        this.html(HTML);
        cb.call(this[0]);
        return this;
    };
    w.eval('TABS.auxiliary.initialize(function () {});');
    return w;
}

const sent = (w, codeName) => JSON.parse(w.eval(
    `JSON.stringify(sentMessages.filter(function (m) { return m.code === MSPCodes.${codeName}; })` +
    `.map(function (m) { return m.data; }))`));

const RANGES = [
    { id: 0, auxChannelIndex: 0, range: { start: 1700, end: 2100 } },   // ARM on AUX1
    { id: 1, auxChannelIndex: 1, range: { start: 1300, end: 1700 } },   // ANGLE on AUX2
    { id: 13, auxChannelIndex: 0, range: { start: 900, end: 900 } },    // BEEPER linked (sentinel range)
    { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },     // unused slot
];
const EXTRA_LINKED = [
    { id: 0, modeLogic: 0, linkedTo: 0 },
    { id: 1, modeLogic: 0, linkedTo: 0 },
    { id: 13, modeLogic: 1, linkedTo: 1 },                              // BEEPER AND-linked to ANGLE
    { id: 0, modeLogic: 0, linkedTo: 0 },
];

test('render: logic dropdown offers both OR and AND', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    const options = JSON.parse(w.eval(
        `JSON.stringify($('#tab-auxiliary-templates .link .logic option').map(function () { return this.value; }).get())`));
    assert.deepEqual(options, ['0', '1']);
});

test('render: a linked entry shows as a link with its target and AND logic', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    // BEEPER is mode index 3
    assert.equal(w.eval(`$('#mode-3 .link').length`), 1);
    assert.equal(w.eval(`$('#mode-3 .link .linkedTo').val()`), '1');
    assert.equal(w.eval(`$('#mode-3 .link .logic').val()`), '1');
    assert.equal(w.eval(`$('#mode-3 .range').length`), 0, 'sentinel range must not render as a range');
    assert.equal(w.eval(`$('#mode-1 .range').length`), 1);
});

test('render: link targets are sorted by name with the empty option first', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    const texts = JSON.parse(w.eval(
        `JSON.stringify($('#tab-auxiliary-templates .link .linkedTo option').map(function () { return this.text; }).get())`));
    assert.deepEqual(texts, ['', 'ANGLE', 'BEEPER', 'HORIZON']);
});

test('render: Add Link is visible for non-ARM modes and hidden for ARM when supported', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    assert.equal(w.eval(`$('#mode-0 a.addLink').css('display')`), 'none');
    assert.notEqual(w.eval(`$('#mode-1 a.addLink').css('display')`), 'none');
});

test('render: Add Link is hidden for every mode on firmware below 1.55.1', () => {
    const w = openTab({ apiVersion: '1.55.0', modeRanges: RANGES, extra: [] });
    for (let i = 0; i < MODES.names.length; i++) {
        assert.equal(w.eval(`$('#mode-${i} a.addLink').css('display')`), 'none', `mode ${i}`);
    }
});

test('save: link fields are sent with every MSP_SET_MODE_RANGE when supported', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    w.eval(`$('a.save').click();`);
    const messages = sent(w, 'MSP_SET_MODE_RANGE');
    assert.equal(messages.length, RANGES.length);
    for (const data of messages) {
        assert.equal(data.length, 7, 'index, id, aux, start, end, logic, linkedTo');
    }
    // slot order follows the DOM: ARM range, ANGLE range, BEEPER link, then default padding
    assert.deepEqual(messages[0], [0, 0, 0, 32, 48, 0, 0]);
    assert.deepEqual(messages[1], [1, 1, 1, 16, 32, 0, 0]);
    assert.deepEqual(messages[2], [2, 13, 0, 0, 0, 1, 1]);
    assert.deepEqual(messages[3], [3, 0, 0, 0, 0, 0, 0]);
    assert.equal(sent(w, 'MSP_EEPROM_WRITE').length, 1);
});

test('save: a link added through the UI is sent with the chosen target and logic', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    // add a link to HORIZON (mode index 2, id 2) targeting ANGLE (id 1) with AND logic
    w.eval(`
        $('#mode-2 a.addLink').click();
        $('#mode-2 .link .linkedTo').val('1');
        $('#mode-2 .link .logic').val('1');
        $('a.save').click();
    `);
    const messages = sent(w, 'MSP_SET_MODE_RANGE');
    const link = messages.find((m) => m[1] === 2);
    assert.ok(link, 'HORIZON entry missing');
    assert.deepEqual(link.slice(2), [0, 0, 0, 1, 1]);
});

test('save: a link with no target selected is dropped', () => {
    const w = openTab({ apiVersion: '1.55.1', modeRanges: RANGES, extra: EXTRA_LINKED });
    w.eval(`
        $('#mode-2 a.addLink').click();   // target stays blank
        $('a.save').click();
    `);
    const messages = sent(w, 'MSP_SET_MODE_RANGE');
    assert.equal(messages.filter((m) => m[1] === 2).length, 0);
    assert.equal(messages.length, RANGES.length, 'slot count is preserved with padding');
});

test('save: firmware below 1.55.1 receives the legacy 5-byte form', () => {
    const w = openTab({ apiVersion: '1.55.0', modeRanges: RANGES, extra: [] });
    w.eval(`$('a.save').click();`);
    const messages = sent(w, 'MSP_SET_MODE_RANGE');
    assert.equal(messages.length, RANGES.length);
    for (const data of messages) {
        assert.equal(data.length, 5);
    }
});
