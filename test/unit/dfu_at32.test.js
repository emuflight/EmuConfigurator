'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, run } = require('./harness');

// Runs the real getChipInfo against descriptor strings a DFU bootloader reports.
function chipInfoFor(descriptors) {
    const ctx = createContext(['src/js/protocols/stm32usbdfu.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
    });
    ctx.descriptors = descriptors;
    return run(ctx, `(function () {
        var out;
        STM32DFU_protocol.prototype.getChipInfo.call(
            { getInterfaceDescriptors: function (i, cb) { cb(descriptors, 0); } },
            0,
            function (info) { out = info; });
        return JSON.parse(JSON.stringify(out));
    })()`);
}

function usbFilters() {
    const ctx = createContext(['src/js/port_handler.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
        $: function () { return { length: 0 }; },
    });
    return run(ctx, 'JSON.parse(JSON.stringify(usbDevices.filters))');
}

// Strings read with `dfu-util -l` from an AT32F435M board in DFU mode.
const AT32_FLASH = '@Internal Flash /0x08000000/1008*004Kg';
const AT32_OPTION = '@Option byte /0x1FFFC000/01*4096 g';

test('AT32 internal flash: 1008 sectors of 4 KB from 0x08000000', () => {
    const info = chipInfoFor([AT32_FLASH, AT32_OPTION]);
    const flash = info.internal_flash;
    assert.equal(flash.start_address, 0x08000000);
    assert.equal(flash.sectors.length, 1);
    assert.equal(flash.sectors[0].num_pages, 1008);
    assert.equal(flash.sectors[0].page_size, 4 * 1024);
    // 1008 * 4096 = 0x3F0000, so the region ends at 0x083F0000
    assert.equal(flash.start_address + flash.total_size, 0x083F0000);
});

test('AT32 "Option byte" region is stored under option_bytes, the key the flasher reads', () => {
    const info = chipInfoFor([AT32_FLASH, AT32_OPTION]);
    assert.ok(info.option_bytes, 'option_bytes missing');
    assert.equal(info.option_bytes.start_address, 0x1FFFC000);
    assert.equal(info.option_bytes.total_size, 4096);
    assert.equal(info.option_byte, undefined);
});

test('STM32 "Option Bytes" region keeps the option_bytes key', () => {
    const info = chipInfoFor(['@Internal Flash  /0x08000000/04*016Kg,01*064Kg,07*128Kg', '@Option Bytes  /0x1FFFC000/01*016 e']);
    assert.ok(info.option_bytes);
    assert.equal(info.option_bytes.start_address, 0x1FFFC000);
    assert.equal(info.internal_flash.total_size, (4 * 16 + 64 + 7 * 128) * 1024);
});

test('two-bank option byte string (G4 style) still maps to option_bytes', () => {
    const info = chipInfoFor(['@Option Bytes   /0x1FFF7800/01*048 e/0x1FFFF800/01*048 e']);
    assert.equal(info.option_bytes.start_address, 0x1FFF7800);
    assert.equal(info.option_bytes.total_size, 48);
});

test('USB filters list the AT32 DFU id and not the AT32 virtual com port id', () => {
    const filters = usbFilters();
    // AT32 DFU is 2e3c:df11
    assert.ok(filters.some(f => f.vendorId === 0x2e3c && f.productId === 0xdf11), 'AT32 DFU filter missing');
    // 2e3c:5740 is the normal-mode serial port; it must never count as a DFU device
    assert.ok(!filters.some(f => f.vendorId === 0x2e3c && f.productId === 0x5740), 'VCP id must not be a DFU filter');
    // the three earlier DFU filters stay
    for (const [v, p] of [[1155, 57105], [10473, 393], [12619, 262]]) {
        assert.ok(filters.some(f => f.vendorId === v && f.productId === p), `filter ${v}:${p} lost`);
    }
});

// Runs upload_procedure(1) up to the option byte UPLOAD and returns the requested length.
function optionByteUploadLength(optionBytesTotal, transferSize) {
    const ctx = createContext(['src/js/protocols/stm32usbdfu.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
        GUI: { log() {} },
        i18n: { getMessage() { return ''; } },
    });
    ctx.optionBytesTotal = optionBytesTotal;
    ctx.transferSize = transferSize;
    return run(ctx, `(function () {
        var dfu = new STM32DFU_protocol();
        var requested = null;
        dfu.chipInfo = { option_bytes: { start_address: 0x1FFFC000, total_size: optionBytesTotal } };
        dfu.transferSize = transferSize;
        dfu.clearStatus = function (cb) { cb(); };
        dfu.loadAddress = function (addr, cb) {
            var resp = [0, 0, 0, 0, dfu.state.dfuDNLOAD_IDLE, 0];
            cb(resp);
        };
        dfu.controlTransfer = function (dir, req, value, iface, length) {
            if (req === dfu.request.UPLOAD) { requested = length; }
        };
        dfu.upload_procedure(1);
        return requested;
    })()`);
}

test('option byte read never asks for more than one DFU transfer (AT32: 4096-byte region, 2048-byte transfer)', () => {
    // transfer size 2048 is the wTransferSize the AT32 bootloader reports
    assert.equal(optionByteUploadLength(4096, 2048), 2048);
});

test('option byte read keeps the full region when it fits one transfer (STM32)', () => {
    assert.equal(optionByteUploadLength(16, 2048), 16);
    assert.equal(optionByteUploadLength(2048, 2048), 2048);
});
