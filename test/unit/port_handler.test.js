'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, run } = require('./harness');

function candidates(newPorts, portInfo) {
    const ctx = createContext(['src/js/port_handler.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
        $: function () { return { length: 0 }; },
    });
    ctx.newPorts = newPorts;
    ctx.portInfo = portInfo;
    return run(ctx, `(function () {
        PortHandler.port_info = portInfo;
        return PortHandler.resolve_fc_candidates(newPorts).slice();
    })()`);
}

const STM = { vendorId: '0483', productId: '5740' };
const PHONE = { vendorId: '04e8', productId: '6860' };

test('known FC VID:PID wins over another serial device in the same poll', () => {
    const out = candidates(['/dev/ttyACM0', '/dev/ttyACM1'], { '/dev/ttyACM0': PHONE, '/dev/ttyACM1': STM });
    assert.deepEqual(out, ['/dev/ttyACM1']);
});

test('VID:PID match ignores hex case', () => {
    const out = candidates(['/dev/ttyUSB0', '/dev/ttyUSB1'],
        { '/dev/ttyUSB0': { vendorId: '10C4', productId: 'EA60' }, '/dev/ttyUSB1': PHONE });
    assert.deepEqual(out, ['/dev/ttyUSB0']);
});

test('unlisted VID:PID is not excluded when no known FC port is present', () => {
    const out = candidates(['/dev/ttyACM0'], { '/dev/ttyACM0': PHONE });
    assert.deepEqual(out, ['/dev/ttyACM0']);
});

test('two unlisted ports stay ambiguous', () => {
    const out = candidates(['/dev/ttyACM0', '/dev/ttyACM1'], { '/dev/ttyACM0': PHONE, '/dev/ttyACM1': {} });
    assert.equal(out.length, 2);
});

test('ports with no identity data behave as before', () => {
    assert.deepEqual(candidates(['COM3'], {}), ['COM3']);
});

test('Bluetooth RFCOMM stays excluded even with an FC VID:PID', () => {
    const out = candidates(['/dev/rfcomm0'], { '/dev/rfcomm0': STM });
    assert.deepEqual(out, []);
});
