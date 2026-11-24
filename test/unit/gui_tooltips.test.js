'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, run } = require('./harness');

// Loads the real gui.js. jBox needs a browser DOM, which this harness lacks, so jBox and jQuery are fakes
// that record calls. They model the documented jBox behavior: a popup lives in <body> until destroy().
function load(statusIcons) {
    const ctx = createContext(['src/js/gui.js'], {
        console: { log() {}, warn() {}, error() {}, debug() {} },
        MSP: { callbacks_cleanup() {} },
        CONFIGURATOR: { connectionValid: false },
        navigator: { appVersion: 'Linux' },
        window: {},
    });
    run(ctx, `
        var STATUS = ${statusIcons || 0};
        var body = { popups: 0 };
        var made = [];
        function makeTip() {
            var tip = { open: false, pendingTimer: false, destroyed: false, popupInBody: false };
            tip.show = function () { tip.pendingTimer = true; };       // hover: delayOpen timer starts
            tip.fireTimer = function () {                               // delayOpen timer fires
                if (!tip.pendingTimer) { return; }
                tip.pendingTimer = false; tip.open = true;
                if (!tip.popupInBody) { tip.popupInBody = true; body.popups++; }
            };
            tip.close = function (o) { tip.pendingTimer = false; tip.open = false; tip.closeArgs = o; };
            tip.destroy = function () {
                tip.destroyed = true;
                if (tip.popupInBody) { tip.popupInBody = false; body.popups--; }
            };
            made.push(tip);
            return tip;
        }
        function $(sel) {
            if (typeof sel === 'function') { return $; }
            return {
                not: function () { return $('#status'); },
                each: function (fn) {
                    var n = sel === '#status' ? $.statusCount : (sel === '#content .cf_tip' ? $.count : 0);
                    for (var i = 0; i < n; i++) { fn.call({}); }
                },
                jBox: function () { return makeTip(); },
            };
        }
        $.count = 3;
        $.statusCount = STATUS;
        GUI.switchery = function () {};
        GUI.fitContentHeight = function () {};
        GUI.interval_kill_all = function () {};
    `);
    return ctx;
}

test('tab_switch_cleanup removes a popup that is open', () => {
    const ctx = load();
    run(ctx, 'GUI.content_ready();');
    assert.equal(run(ctx, 'GUI.tooltips.length'), 3);
    run(ctx, 'made[1].show(); made[1].fireTimer();');
    assert.equal(run(ctx, 'body.popups'), 1);
    run(ctx, 'GUI.active_tab = null; GUI.tab_switch_cleanup(function () {});');
    assert.equal(run(ctx, 'body.popups'), 0);
    assert.equal(run(ctx, 'made.every(function (t) { return t.destroyed; })'), true);
    assert.equal(run(ctx, 'GUI.tooltips.length'), 0);
});

test('a tooltip still waiting for its open delay never opens after cleanup', () => {
    const ctx = load();
    run(ctx, 'GUI.content_ready();');
    run(ctx, 'made[0].show();');
    run(ctx, 'GUI.tab_switch_cleanup(function () {});');
    run(ctx, 'made[0].fireTimer();');
    assert.equal(run(ctx, 'body.popups'), 0);
    assert.equal(run(ctx, 'made[0].closeArgs.ignoreDelay'), true);
});

test('content_ready twice does not leak instances of the first load', () => {
    const ctx = load();
    run(ctx, 'GUI.content_ready(); made[2].show(); made[2].fireTimer();');
    run(ctx, 'GUI.content_ready();');
    assert.equal(run(ctx, 'body.popups'), 0);
    assert.equal(run(ctx, 'made.length'), 6);
    assert.equal(run(ctx, 'GUI.tooltips.length'), 3);
    assert.equal(run(ctx, 'made.slice(0, 3).every(function (t) { return t.destroyed; })'), true);
});

test('status bar icons outside #content get one instance and survive tab cleanup', () => {
    const ctx = load(2);
    run(ctx, 'GUI.content_ready(); GUI.tab_switch_cleanup(function () {}); GUI.content_ready(); GUI.content_ready();');
    // 3 tab tooltips per load x 3 loads + 2 status icons once
    assert.equal(run(ctx, 'made.length'), 11);
    assert.equal(run(ctx, 'made.filter(function (t) { return !t.destroyed; }).length'), 5);
});

test('cleanup with no tooltips and repeated cleanup do not throw', () => {
    const ctx = load();
    run(ctx, 'GUI.tab_switch_cleanup(function () {}); GUI.tab_switch_cleanup(function () {});');
    assert.equal(run(ctx, 'GUI.tooltips.length'), 0);
});
