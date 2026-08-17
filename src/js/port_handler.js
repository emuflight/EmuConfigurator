'use strict';

const TIMEOUT_CHECK = 500; // With 250 it seems that it produces a memory leak and slowdown in some versions, reason unknown

var usbDevices = { filters: [
    {'vendorId': 1155, 'productId': 57105},
    {'vendorId': 10473, 'productId': 393},
    {'vendorId': 12619, 'productId': 262} // APM32 DFU Bootloader
] };

// Linux Bluetooth RFCOMM device paths -- excluded from auto-connect/auto-select
// candidates so a Bluetooth service registering mid-reboot (the confirmed repro
// in emuflight/EmuConfigurator#638, e.g. /dev/rfcomm0) never gets picked over
// the FC. Linux-specific: does not cover macOS/Windows Bluetooth SPP device
// naming, which isn't distinguishable from a real FC port by path alone.
var NON_FC_PORT_PATTERN = /^\/dev\/rfcomm\d+$/i;

var PortHandler = new function () {
    this.initial_ports = false;
    this.port_detected_callbacks = [];
    this.port_removed_callbacks = [];
    this.dfu_available = false;
    this.usb_api_checked = false;
    this.usb_api_available = false;
    this.storage_api_checked = false;
    this.storage_api_available = false;
    this.demo_port_added = false;
};

PortHandler.initialize = function () {
    // start listening, check after TIMEOUT_CHECK ms
    this.check();
};

PortHandler.check = function () {
    var self = this;

    serial.getDevices(function(current_ports) {
        // port got removed or initial_ports wasn't initialized yet
        if (self.array_difference(self.initial_ports, current_ports).length > 0 || !self.initial_ports) {
            var removed_ports = self.array_difference(self.initial_ports, current_ports);

            if (self.initial_ports != false) {
                if (removed_ports.length > 1) {
                    console.log('PortHandler - Removed: ' + removed_ports);
                } else {
                    console.log('PortHandler - Removed: ' + removed_ports[0]);
                }
            }

            // disconnect "UI" if necessary
            // Keep in mind that this routine can not fire during atmega32u4 reboot procedure !!!
            if (GUI.connected_to) {
                for (var i = 0; i < removed_ports.length; i++) {
                    if (removed_ports[i] == GUI.connected_to) {
                        $('div#port-picker a.connect').click();
                    }
                }
            }

            self.update_port_select(current_ports);

            // trigger callbacks (only after initialization)
            if (self.initial_ports) {
                for (var i = (self.port_removed_callbacks.length - 1); i >= 0; i--) {
                    var obj = self.port_removed_callbacks[i];

                    // remove timeout
                    clearTimeout(obj.timer);

                    // trigger callback
                    obj.code(removed_ports);

                    // remove object from array
                    var index = self.port_removed_callbacks.indexOf(obj);
                    if (index > -1) self.port_removed_callbacks.splice(index, 1);
                }
            }

            // auto-select last used port (only during initialization)
            if (!self.initial_ports) {
                // Guard for chrome.storage API (not available in Electron)
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    self.storage_api_available = true;
                    self.storage_api_checked = true;
                    chrome.storage.local.get('last_used_port', function (result) {
                        // if last_used_port was set, we try to select it
                        if (result.last_used_port) {
                            current_ports.forEach(function(port) {
                                if (port == result.last_used_port) {
                                    console.log('Selecting last used port: ' + result.last_used_port);

                                    $('div#port-picker #port').val(result.last_used_port);
                                }
                            });
                        } else {
                            console.log('Last used port wasn\'t saved "yet", auto-select disabled.');
                        }
                    });
                } else {
                    // Log warning only once when storage API is first detected as unavailable
                    if (!self.storage_api_checked) {
                        console.warn('chrome.storage.local API not available. Last port selection will be unavailable.');
                        self.storage_api_checked = true;
                        self.storage_api_available = false;
                    }
                }
            }

            if (!self.initial_ports) {
                // initialize
                self.initial_ports = current_ports;
            } else {
                for (var i = 0; i < removed_ports.length; i++) {
                    self.initial_ports.splice(self.initial_ports.indexOf(removed_ports[i]), 1);
                }
            }
        }

        // new port detected
        var new_ports = self.array_difference(current_ports, self.initial_ports);

        if (new_ports.length) {
            if (new_ports.length > 1) {
                console.log('PortHandler - Found: ' + new_ports);
            } else {
                console.log('PortHandler - Found: ' + new_ports[0]);
            }

            // update_port_select() rebuilds the <option> list from scratch, which
            // drops the current selection unless something re-sets it below --
            // capture it first so a non-candidate/ambiguous poll can restore it
            // instead of silently falling back to the browser's first-option default.
            var previously_selected_port = $('div#port-picker #port').val();

            self.update_port_select(current_ports);

            var fc_candidates = self.resolve_fc_candidates(new_ports);
            var unambiguous_candidate = (fc_candidates.length === 1);

            // select / highlight new port, if connected -> select connected port
            if (!GUI.connected_to) {
                if (unambiguous_candidate) {
                    $('div#port-picker #port').val(fc_candidates[0]);
                } else {
                    // No FC-shaped candidate, or more than one -- leave the user's
                    // prior selection alone instead of guessing which device is the FC.
                    $('div#port-picker #port').val(previously_selected_port);
                }
            } else {
                $('div#port-picker #port').val(GUI.connected_to);
            }

            // start connect procedure (if statement is valid)
            if (unambiguous_candidate && GUI.auto_connect && !GUI.connecting_to && !GUI.connected_to) {
                // we need firmware flasher protection over here
                if (GUI.active_tab != 'firmware_flasher') {
                    var detected_candidate = fc_candidates[0];
                    GUI.timeout_add('auto-connect_timeout', function () {
                        // Re-validate state: 1s may have passed and conditions can change.
                        // Also require the port picker to still show the exact candidate
                        // this timeout was scheduled for -- otherwise the user changed the
                        // selection (e.g. to manual entry) or a later poll cycle updated it,
                        // and this stale timeout must not connect to a different port.
                        var connectBtn = $('div#port-picker a.connect');
                        var selectedPort = $('div#port-picker #port').val();
                        var stateValid = GUI.auto_connect
                            && !GUI.connected_to
                            && !GUI.connecting_to
                            && GUI.active_tab != 'firmware_flasher'
                            && connectBtn.length > 0
                            && selectedPort === detected_candidate;
                        if (stateValid) {
                            connectBtn.click();
                        }
                    }, 1000); // delay allows slow-boot boards (e.g. F7 MCUs) to reach MSP-ready before connect attempt
                }
            }

            // trigger callbacks only once the new-port set resolves to exactly one
            // FC-shaped candidate; leave them registered otherwise so a later poll
            // (once the ambiguity clears) can still resolve them (see port_detected's
            // ignore_timeout usage in firmware_flasher.js's flash_on_connect).
            if (unambiguous_candidate) {
                for (var i = (self.port_detected_callbacks.length - 1); i >= 0; i--) {
                    var obj = self.port_detected_callbacks[i];

                    // remove timeout
                    clearTimeout(obj.timer);

                    // trigger callback
                    obj.code(fc_candidates);

                    // remove object from array
                    var index = self.port_detected_callbacks.indexOf(obj);
                    if (index > -1) self.port_detected_callbacks.splice(index, 1);
                }
            }

            self.absorb_resolved_ports(new_ports, fc_candidates, unambiguous_candidate, current_ports);
        }

        self.check_usb_devices();

        GUI.updateManualPortVisibility();

        //moved from main.js
        // Enable connect button only when real serial ports are present, or when
        // the user has manually selected the manual-entry option. While connected
        // or connecting, leave the button state to the connect/disconnect flow.
        if (!GUI.connected_to && !GUI.connecting_to) {
            // Manual option is always present in the dropdown, so check that the
            // user has actually typed a port path before treating it as connectable.
            var isManualSelected = $('div#port-picker #port option:selected').data('isManual');
            var manualPortEntered = isManualSelected && $('#port-override').val().trim().length > 0;
            if (current_ports.length > 0 || manualPortEntered) {
                $('.connect_b a.connect').removeClass('disabled');
            } else {
                $('.connect_b a.connect').addClass('disabled');
            }
        }
        $('.firmware_b a.flash').removeClass('disabled');

        setTimeout(function () {
            self.check();
        }, TIMEOUT_CHECK);
    });
};

// Folds resolved new ports into initial_ports so they stop being re-flagged as
// "new". An unambiguous candidate (already handled above) or pure noise (no FC
// candidates at all) is fully adopted. An ambiguous FC-candidate set is only
// partially adopted -- the candidates themselves are kept OUT of initial_ports
// so array_difference() re-surfaces them on the next poll and the ambiguity is
// re-evaluated instead of being silently adopted and never resolved.
PortHandler.absorb_resolved_ports = function (new_ports, fc_candidates, unambiguous_candidate, current_ports) {
    if (unambiguous_candidate || fc_candidates.length === 0) {
        this.initial_ports = current_ports;
        return;
    }

    for (var i = 0; i < new_ports.length; i++) {
        if (fc_candidates.indexOf(new_ports[i]) === -1) {
            this.initial_ports.push(new_ports[i]);
        }
    }
};

// Excludes known non-FC device paths (see NON_FC_PORT_PATTERN) from a
// newly-appeared port list, so a Bluetooth RFCOMM device never gets
// auto-selected in place of the FC re-enumerating after a reboot.
PortHandler.resolve_fc_candidates = function (new_ports) {
    var fc_candidates = new_ports.filter(function (port) {
        return !NON_FC_PORT_PATTERN.test(port);
    });

    if (fc_candidates.length > 1) {
        console.log('PortHandler - ambiguous new ports, skipping auto-select: ' + fc_candidates);
    }

    return fc_candidates;
};

PortHandler.check_usb_devices = function (callback) {
    var self = this;
    // Guard for chrome.usb API (not available in Electron)
    if (typeof chrome !== 'undefined' && chrome.usb && chrome.usb.getDevices) {
        this.usb_api_available = true;
        this.usb_api_checked = true;
        chrome.usb.getDevices(usbDevices, function (result) {
            if (result.length) {
                if (!$("div#port-picker #port [value='DFU']").length) {
                    $('div#port-picker #port').append($('<option/>', {value: "DFU", text: "DFU", data: {isDFU: true}}));
                    $('div#port-picker #port').val('DFU');
                }
                self.dfu_available = true;
            } else {
                if ($("div#port-picker #port [value='DFU']").length) {
                    $("div#port-picker #port [value='DFU']").remove();
                }
                self.dfu_available = false;
            }

            if(callback) callback(self.dfu_available);
        });
    } else {
        // Log warning only once when USB API is first detected as unavailable
        if (!this.usb_api_checked) {
            console.warn('chrome.usb API not available. DFU mode will be unavailable.');
            this.usb_api_checked = true;
            this.usb_api_available = false;
        }
        this.dfu_available = false;
        if(callback) callback(this.dfu_available);
    }
};

PortHandler.update_port_select = function (ports) {
    $('div#port-picker #port').html(''); // drop previous one

    for (var i = 0; i < ports.length; i++) {
        $('div#port-picker #port').append($("<option/>", {value: ports[i], text: ports[i], data: {isManual: false}}));
    }

    $('div#port-picker #port').append($("<option/>", {value: 'manual', i18n: 'portsSelectManual', data: {isManual: true}}));
    i18n.localizePage();

};

PortHandler.port_detected = function(name, code, timeout, ignore_timeout) {
    var self = this;
    var obj = {'name': name, 'code': code, 'timeout': (timeout) ? timeout : 10000};

    if (!ignore_timeout) {
        obj.timer = setTimeout(function() {
            console.log('PortHandler - timeout - ' + obj.name);

            // trigger callback
            code(false);

            // remove object from array
            var index = self.port_detected_callbacks.indexOf(obj);
            if (index > -1) self.port_detected_callbacks.splice(index, 1);
        }, (timeout) ? timeout : 10000);
    } else {
        obj.timer = false;
        obj.timeout = false;
    }

    this.port_detected_callbacks.push(obj);

    return obj;
};

PortHandler.port_removed = function (name, code, timeout, ignore_timeout) {
    var self = this;
    var obj = {'name': name, 'code': code, 'timeout': (timeout) ? timeout : 10000};

    if (!ignore_timeout) {
        obj.timer = setTimeout(function () {
            console.log('PortHandler - timeout - ' + obj.name);

            // trigger callback
            code(false);

            // remove object from array
            var index = self.port_removed_callbacks.indexOf(obj);
            if (index > -1) self.port_removed_callbacks.splice(index, 1);
        }, (timeout) ? timeout : 10000);
    } else {
        obj.timer = false;
        obj.timeout = false;
    }

    this.port_removed_callbacks.push(obj);

    return obj;
};

// accepting single level array with "value" as key
PortHandler.array_difference = function (firstArray, secondArray) {
    var cloneArray = [];

    // create hardcopy
    for (var i = 0; i < firstArray.length; i++) {
        cloneArray.push(firstArray[i]);
    }

    for (var i = 0; i < secondArray.length; i++) {
        if (cloneArray.indexOf(secondArray[i]) != -1) {
            cloneArray.splice(cloneArray.indexOf(secondArray[i]), 1);
        }
    }

    return cloneArray;
};

PortHandler.flush_callbacks = function () {
    var killed = 0;

    for (var i = this.port_detected_callbacks.length - 1; i >= 0; i--) {
        if (this.port_detected_callbacks[i].timer) clearTimeout(this.port_detected_callbacks[i].timer);
        this.port_detected_callbacks.splice(i, 1);

        killed++;
    }

    for (var i = this.port_removed_callbacks.length - 1; i >= 0; i--) {
        if (this.port_removed_callbacks[i].timer) clearTimeout(this.port_removed_callbacks[i].timer);
        this.port_removed_callbacks.splice(i, 1);

        killed++;
    }

    return killed;
};
