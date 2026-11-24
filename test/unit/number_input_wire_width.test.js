'use strict';
// Each number input range in the tab HTML must fit the MSP field it is sent in.
// Widths come from the encoders in src/js/msp/MSPHelper.js (push8, push16 and
// the 16-bit current meter fields). A value outside the wire width wraps
// silently on save, so min/max must not exceed it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

const U8 = [0, 255];
const U16 = [0, 65535];
const I16 = [-32768, 32767];

// name -> [wireMin, wireMax, scale applied before the push]
const WIRE = {
    receiver: {
        stick_min: [...U16, 1], stick_center: [...U16, 1], stick_max: [...U16, 1],
        deadband: [...U8, 1], yaw_deadband: [...U8, 1], '3ddeadbandthrottle': [...U16, 1],
        'rcSmoothingInputHz-number': [...U8, 1], 'rcSmoothingDerivativeCutoff-number': [...U8, 1],
        'rcInterpolationInterval-number': [...U8, 1],
    },
    power: {
        mincellvoltage: [...U8, 10], maxcellvoltage: [...U8, 10], warningcellvoltage: [...U8, 10],
        capacity: [...U16, 1], vbatscale: [...U8, 1], vbatresdivval: [...U8, 1], vbatresdivmultiplier: [...U8, 1],
        amperagescale: [...I16, 1], amperageoffset: [...I16, 1],
        // calibration helpers: read-out values typed by the user, never sent as-is
        vbatcalibration: null, amperagecalibration: null,
    },
    failsafe: {
        rx_min_usec: [...U16, 1], rx_max_usec: [...U16, 1], failsafe_delay: [...U8, 1],
        failsafe_throttle_low_delay: [...U16, 1], failsafe_throttle: [...U16, 1], failsafe_off_delay: [...U8, 1],
        gps_rescue_angle: [...U16, 1], gps_rescue_initial_altitude: [...U16, 1], gps_rescue_descent_distance: [...U16, 1],
        gps_rescue_ground_speed: [...U16, 100], gps_rescue_throttle_min: [...U16, 1],
        gps_rescue_throttle_max: [...U16, 1], gps_rescue_throttle_hover: [...U16, 1], gps_rescue_min_sats: [...U8, 1],
    },
    configuration: {
        fpvCamAngleDegrees: [...U8, 1], unsyncedpwmfreq: [...U16, 1], autodisarmdelay: [...U8, 1],
        digitalIdlePercent: [...U16, 100], minthrottle: [...U16, 1], maxthrottle: [...U16, 1], mincommand: [...U16, 1],
        motorPoleCount: [...U8, 1], board_align_roll: [...I16, 1], board_align_pitch: [...I16, 1], board_align_yaw: [...I16, 1],
        roll: [...I16, 1], pitch: [...I16, 1], configurationSmallAngle: [...U8, 1],
        '3ddeadbandlow': [...U16, 1], '3ddeadbandhigh': [...U16, 1], '3dneutral': [...U16, 1],
        mag_declination: [...I16, 100],
    },
};

function numberInputs(tab) {
    const html = fs.readFileSync(path.join(ROOT, 'src', 'tabs', tab + '.html'), 'utf8');
    const result = [];
    for (const m of html.matchAll(/<input\b[^>]*type="number"[^>]*>/g)) {
        const attr = (n) => { const a = new RegExp('\\b' + n + '="([^"]*)"').exec(m[0]); return a ? a[1] : null; };
        result.push({ name: attr('name') || attr('id'), min: attr('min'), max: attr('max') });
    }
    return result;
}

for (const tab of Object.keys(WIRE)) {
    test(tab + ': every number input has a wire width and a range inside it', () => {
        const inputs = numberInputs(tab);
        assert.ok(inputs.length > 0);
        for (const input of inputs) {
            assert.ok(input.name in WIRE[tab], tab + ': no wire width listed for ' + input.name);
            const wire = WIRE[tab][input.name];
            if (wire === null) { continue; }
            assert.notStrictEqual(input.min, null, input.name + ' has no min');
            assert.notStrictEqual(input.max, null, input.name + ' has no max');
            const [lo, hi, scale] = wire;
            assert.ok(parseFloat(input.min) * scale >= lo, input.name + ' min below wire minimum');
            assert.ok(parseFloat(input.max) * scale <= hi, input.name + ' max above wire maximum');
        }
    });
}

test('osd: position limits cover the video grid and fit the 5-bit row and 6-bit column fields', () => {
    const html = fs.readFileSync(path.join(ROOT, 'src', 'tabs', 'osd.html'), 'utf8');
    const grid = { PAL: [30, 16], NTSC: [30, 13], HD: [50, 18] }; // columns, rows
    for (const type of Object.keys(grid)) {
        const m = new RegExp('data-limit="position-' + type + '"[^>]*>').exec(html);
        assert.ok(m, 'missing position limit for ' + type);
        const max = parseInt(/max="(\d+)"/.exec(m[0])[1], 10);
        const min = parseInt(/min="(-?\d+)"/.exec(m[0])[1], 10);
        const [cols, rows] = grid[type];
        assert.strictEqual(min, 0);
        assert.strictEqual(max, cols * rows - 1);
        assert.ok(Math.floor(max / cols) <= 0x1F, type + ' row exceeds 5 bits');
        assert.ok(max % cols <= 0x3F, type + ' column exceeds 6 bits');
    }
});
