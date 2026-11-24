'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// main.js needs Electron, so the descriptor helpers are cut out of its source
// text (from the cache declaration up to the IPC handler) and run in a vm.
function loadHelpers() {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');
    const keyFn = src.match(/function usbKeyFromDevice[\s\S]*?\n}\n/)[0];
    const start = src.indexOf('const _usbDescriptorCache');
    const end = src.indexOf("ipcMain.handle('usb-list-dfu'");
    assert.ok(start > 0 && end > start, 'helpers found in main.js');
    const ctx = vm.createContext({});
    vm.runInContext(keyFn + src.slice(start, end) +
        '\nthis.usbDescriptorStrings = usbDescriptorStrings; this.cache = _usbDescriptorCache;', ctx);
    return ctx;
}

// A usb@3.x device: each string getter reads the OS cache or opens the device
// and throws when that fails.
function fakeDevice(handle, props) {
    const d = { handle: handle, reads: 0 };
    ['serialNumber', 'manufacturerName', 'productName'].forEach((name) => {
        Object.defineProperty(d, name, {
            get() {
                d.reads++;
                const v = props[name];
                if (v instanceof Error) { throw v; }
                return v;
            },
        });
    });
    return d;
}

test('real descriptor strings are returned', () => {
    const ctx = loadHelpers();
    const s = ctx.usbDescriptorStrings(fakeDevice('a', {
        serialNumber: '3677348C3033', manufacturerName: 'STMicroelectronics', productName: 'STM32  BOOTLOADER',
    }));
    assert.equal(s.serialNumber, '3677348C3033');
    assert.equal(s.manufacturer, 'STMicroelectronics');
    assert.equal(s.product, 'STM32  BOOTLOADER');
});

test('a getter that throws (permission denied) maps to an empty string, not an exception', () => {
    const ctx = loadHelpers();
    const denied = new Error('open error: permission denied (errno 13)');
    const s = ctx.usbDescriptorStrings(fakeDevice('b', {
        serialNumber: denied, manufacturerName: 'ACME', productName: denied,
    }));
    assert.equal(s.serialNumber, '');
    assert.equal(s.manufacturer, 'ACME');
    assert.equal(s.product, '');
});

test('null or undefined descriptor (no string index) maps to an empty string', () => {
    const ctx = loadHelpers();
    const s = ctx.usbDescriptorStrings(fakeDevice('c', {
        serialNumber: null, manufacturerName: undefined, productName: 5,
    }));
    assert.deepEqual({ ...s }, { serialNumber: '', manufacturer: '', product: '' });
});

test('strings are read once per device key; failures are cached too', () => {
    const ctx = loadHelpers();
    const d = fakeDevice('d', { serialNumber: new Error('x'), manufacturerName: 'M', productName: 'P' });
    ctx.usbDescriptorStrings(d);
    const readsAfterFirst = d.reads;
    ctx.usbDescriptorStrings(d);
    assert.equal(readsAfterFirst, 3);
    assert.equal(d.reads, 3);
});
