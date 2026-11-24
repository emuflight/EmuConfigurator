'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, run } = require('./harness');

// Runs the real STM32DFU_protocol.connect against a stubbed chrome.usb result.
function connectWith(devices, deviceKey) {
    const ctx = createContext(['src/js/protocols/stm32usbdfu.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
        chrome: { runtime: {}, usb: { getDevices(_f, cb) { cb(devices); } } },
        GUI: { log() {} },
        i18n: { getMessage(k) { return k; } },
        TABS: { firmware_flasher: {
            FLASH_MESSAGE_TYPES: { NEUTRAL: 0, INVALID: 1 },
            flashingMessage() { return this; },
            flashProgress() { return this; },
        } },
    });
    ctx.devices = devices;
    ctx.deviceKey = deviceKey;
    return run(ctx, `(function () {
        var opened = null, finished = 0;
        var p = { openDevice: function (d) { opened = d.device; }, checkChromeError: function () { return false; },
                  selectDevice: STM32DFU_protocol.prototype.selectDevice };
        STM32DFU_protocol.prototype.connect.call(p, {}, [], {}, function () { finished++; }, deviceKey);
        return { opened: opened, finished: finished };
    })()`);
}

const A = { device: 'bus1', serialNumber: 'AAA' };
const B = { device: 'bus2', serialNumber: 'BBB' };

test('single DFU device is opened without a key', () => {
    assert.deepEqual({ ...connectWith([A]) }, { opened: 'bus1', finished: 0 });
});

test('two DFU devices and no key: refuse, open nothing', () => {
    assert.deepEqual({ ...connectWith([A, B]) }, { opened: null, finished: 1 });
});

test('two DFU devices and a key: open exactly the chosen one, not the first', () => {
    assert.equal(connectWith([A, B], 'bus2').opened, 'bus2');
});

test('chosen device gone while others are present: open nothing', () => {
    assert.deepEqual({ ...connectWith([A, B], 'bus9') }, { opened: null, finished: 1 });
    assert.deepEqual({ ...connectWith([A], 'bus9') }, { opened: null, finished: 1 });
});

test('no DFU device: open nothing', () => {
    assert.deepEqual({ ...connectWith([]) }, { opened: null, finished: 1 });
});
