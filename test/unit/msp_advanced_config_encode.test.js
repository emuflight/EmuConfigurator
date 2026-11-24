'use strict';
// MSP_SET_ADVANCED_CONFIG sends digitalIdlePercent as a u16 in hundredths.
// The tab input has step 0.01, so the encoder must round, not truncate.
const test = require('node:test');
const assert = require('node:assert');
const { createContext, run } = require('./harness');

function encode(percent) {
    const ctx = createContext(
        ['libraries/semver.js', 'src/js/injected_methods.js', 'src/js/msp/MSPCodes.js', 'src/js/msp/MSPHelper.js'],
        {
            MSP: {},
            CONFIG: { apiVersion: '1.54.0' },
            PID_ADVANCED_CONFIG: {
                gyro_sync_denom: 1, pid_process_denom: 1, use_unsyncedPwm: 0, fast_pwm_protocol: 0,
                motor_pwm_rate: 480, digitalIdlePercent: percent, gyroUse32kHz: 0, motorPoleCount: 14,
            },
        });
    run(ctx, 'var h = new MspHelper(); var out = h.crunch(MSPCodes.MSP_SET_ADVANCED_CONFIG);');
    const out = run(ctx, 'Array.from(out)');
    // bytes 0..3 are u8 fields, 4..5 motor_pwm_rate, 6..7 digitalIdlePercent
    return out[6] | (out[7] << 8);
}

test('digitalIdlePercent 0.29 encodes as 29 (float product is 28.999...)', () => {
    assert.strictEqual(encode(0.29), 29);
});

test('digitalIdlePercent 0.57 and 20.00 encode as 57 and 2000', () => {
    assert.strictEqual(encode(0.57), 57);
    assert.strictEqual(encode(20), 2000);
});

test('digitalIdlePercent 0 encodes as 0', () => {
    assert.strictEqual(encode(0), 0);
});
