'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, run } = require('./harness');

const FILES = [
    'libraries/semver.js',
    'src/js/injected_methods.js',
    'src/js/msp/MSPCodes.js',
    'src/js/msp/MSPHelper.js',
];

// MSP stub: records every message, answers each one synchronously.
function makeContext() {
    const ctx = createContext(FILES, { MSP: {} });
    run(ctx, `
        var CONFIG = { apiVersion: '1.55.1' };
        var MODE_RANGES = [];
        var MODE_RANGES_EXTRA = [];
        var sent = [];
        var MSP = {
            send_message: function (code, data, cbSent, cbMsp) {
                sent.push({ code: code, data: data });
                if (typeof MSP.onSend === 'function') { MSP.onSend(code); }
                if (cbMsp) { cbMsp({}); }
            }
        };
        var mspHelper = new MspHelper();
    `);
    return ctx;
}

function decode(ctx, code, bytes) {
    ctx.__bytes = bytes;
    run(ctx, `
        var __view = new DataView(new Uint8Array(__bytes).buffer);
        mspHelper.process_data({ dataView: __view, code: MSPCodes.${code}, crcError: false,
                                 unsupported: false, callbacks: [] });
    `);
}

test('MSP_MODE_RANGES_EXTRA decodes count, id, modeLogic, linkedTo', () => {
    const ctx = makeContext();
    // spec: u8 count, then per entry permanentId, modeLogic, linkedTo
    decode(ctx, 'MSP_MODE_RANGES_EXTRA', [2, 0, 0, 0, 13, 1, 5]);
    const extra = JSON.parse(run(ctx, 'JSON.stringify(MODE_RANGES_EXTRA)'));
    assert.deepEqual(extra, [
        { id: 0, modeLogic: 0, linkedTo: 0 },
        { id: 13, modeLogic: 1, linkedTo: 5 },
    ]);
});

test('MSP_MODE_RANGES_EXTRA with count 0 leaves an empty array', () => {
    const ctx = makeContext();
    decode(ctx, 'MSP_MODE_RANGES_EXTRA', [0]);
    assert.equal(run(ctx, 'MODE_RANGES_EXTRA.length'), 0);
});

test('sendModeRanges appends modeLogic and linkedTo when extra data exists', () => {
    const ctx = makeContext();
    run(ctx, `
        MODE_RANGES = [
            { id: 1, auxChannelIndex: 2, range: { start: 1300, end: 1700 } },
            { id: 13, auxChannelIndex: 0, range: { start: 900, end: 900 } }
        ];
        MODE_RANGES_EXTRA = [
            { id: 1, modeLogic: 0, linkedTo: 0 },
            { id: 13, modeLogic: 1, linkedTo: 5 }
        ];
        mspHelper.sendModeRanges(function () {});
    `);
    const sent = JSON.parse(run(ctx, 'JSON.stringify(sent)'));
    assert.equal(sent.length, 2);
    // index, id, aux, (start-900)/25, (end-900)/25, modeLogic, linkedTo
    assert.deepEqual(sent[0].data, [0, 1, 2, 16, 32, 0, 0]);
    assert.deepEqual(sent[1].data, [1, 13, 0, 0, 0, 1, 5]);
});

test('sendModeRanges sends the legacy 5-byte form without extra data', () => {
    const ctx = makeContext();
    run(ctx, `
        MODE_RANGES = [{ id: 1, auxChannelIndex: 2, range: { start: 1300, end: 1700 } }];
        MODE_RANGES_EXTRA = [];
        mspHelper.sendModeRanges(function () {});
    `);
    const sent = JSON.parse(run(ctx, 'JSON.stringify(sent)'));
    assert.deepEqual(sent[0].data, [0, 1, 2, 16, 32]);
});

test('sendModeRanges with no ranges completes without sending', () => {
    const ctx = makeContext();
    run(ctx, 'var done = false; MODE_RANGES = []; mspHelper.sendModeRanges(function () { done = true; });');
    assert.equal(run(ctx, 'done'), true);
    assert.equal(run(ctx, 'sent.length'), 0);
});

// Walk the tab init chain with stubs and report which messages were requested.
function walkAuxiliaryInit(apiVersion, extraReply) {
    const ctx = createContext(FILES.concat(['src/js/tabs/auxiliary.js']), {
        TABS: {},
        GUI: {},
        MSP: {},
    });
    run(ctx, `
        var CONFIG = { apiVersion: '${apiVersion}' };
        var MODE_RANGES = [
            { id: 0, auxChannelIndex: 0, range: { start: 1700, end: 2100 } },
            { id: 1, auxChannelIndex: 1, range: { start: 900, end: 900 } }
        ];
        var MODE_RANGES_EXTRA = [];
        var codes = [];
        var loaded = false;
        var $ = function () { return { load: function () { loaded = true; } }; };
        var MSP = {
            send_message: function (code, data, cbSent, cbMsp) {
                codes.push(code);
                if (code === MSPCodes.MSP_MODE_RANGES_EXTRA) {
                    MODE_RANGES_EXTRA = ${JSON.stringify(extraReply)};
                }
                if (cbMsp) { cbMsp({}); }
            }
        };
        TABS.auxiliary.initialize(function () {});
    `);
    return {
        codes: JSON.parse(run(ctx, 'JSON.stringify(codes)')),
        extra: JSON.parse(run(ctx, 'JSON.stringify(MODE_RANGES_EXTRA)')),
        loaded: run(ctx, 'loaded'),
        mspExtra: run(ctx, 'MSPCodes.MSP_MODE_RANGES_EXTRA'),
        gate: run(ctx, 'TABS.auxiliary.LINKED_MODES_API_VERSION'),
    };
}

const EXTRA_OK = [
    { id: 0, modeLogic: 0, linkedTo: 0 },
    { id: 1, modeLogic: 0, linkedTo: 0 },
];

test('auxiliary init does not request MSP_MODE_RANGES_EXTRA below the gate version', () => {
    const r = walkAuxiliaryInit('1.55.0', EXTRA_OK);
    assert.equal(r.codes.includes(r.mspExtra), false);
    assert.equal(r.loaded, true);
    assert.deepEqual(r.extra, []);
});

test('auxiliary init requests MSP_MODE_RANGES_EXTRA at the gate version and keeps a valid reply', () => {
    const r = walkAuxiliaryInit(walkAuxiliaryInit('1.55.1', []).gate, EXTRA_OK);
    assert.equal(r.codes.includes(r.mspExtra), true);
    assert.equal(r.loaded, true);
    assert.deepEqual(r.extra, EXTRA_OK);
});

test('auxiliary init discards a reply whose length does not match MODE_RANGES', () => {
    const r = walkAuxiliaryInit('1.55.1', [{ id: 0, modeLogic: 0, linkedTo: 0 }]);
    assert.equal(r.codes.includes(r.mspExtra), true);
    assert.deepEqual(r.extra, []);
});

test('auxiliary init treats an empty reply as unsupported', () => {
    const r = walkAuxiliaryInit('1.55.1', []);
    assert.deepEqual(r.extra, []);
    assert.equal(r.loaded, true);
});

test('auxiliary init requests it for a newer minor version', () => {
    const r = walkAuxiliaryInit('1.56.0', EXTRA_OK);
    assert.equal(r.codes.includes(r.mspExtra), true);
});
