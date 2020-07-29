
'use strict';

var TABS = {}; // filled by individual tab js file

var GUI_control = function () {
    this.auto_connect = false;
    this.connecting_to = false;
    this.connected_to = false;
    this.connect_lock = false;
    this.active_tab;
    this.tab_switch_in_progress = false;
    this.operating_system;
    this.interval_array = [];
    this.timeout_array = [];

    this.defaultAllowedTabsWhenDisconnected = [
        'landing',
        'changelog',
        'firmware_flasher',
        'privacy_policy',
        'help'
    ];
    this.defaultAllowedFCTabsWhenConnected = [
        'setup',
        'failsafe',
        'transponder',
        'osd',
        'power',
        'adjustments',
        'auxiliary',
        'cli',
        'configuration',
        'gps',
        'led_strip',
        'logging',
        'onboard_logging',
        'modes',
        'motors',
        'pid_tuning',
        'ports',
        'receiver',
        'sensors',
        'servos',
    ];
    this.defaultAllowedOSDTabsWhenConnected = [
        'setup_osd',
        'osd',
        'power',
        'sensors',
        'transponder',
    ];
    this.allowedTabs = this.defaultAllowedTabsWhenDisconnected;

    // check which operating system is user running
    if (navigator.appVersion.indexOf("Win") != -1)          this.operating_system = "Windows";
    else if (navigator.appVersion.indexOf("Mac") != -1)     this.operating_system = "MacOS";
    else if (navigator.appVersion.indexOf("CrOS") != -1)    this.operating_system = "ChromeOS";
    else if (navigator.appVersion.indexOf("Linux") != -1)   this.operating_system = "Linux";
    else if (navigator.appVersion.indexOf("X11") != -1)     this.operating_system = "UNIX";
    else this.operating_system = "Unknown";

    // Check the method of execution
    this.nwGui = null;
    try {
      this.nwGui = new nw.gui();
      this.Mode = GUI_Modes.NWJS;
    } catch (ex) {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        this.Mode = GUI_Modes.ChromeApp;
      } else {
        this.Mode = GUI_Modes.Other;
      }
    }
    console.log("GUI_Mode = ",this.Mode);
};

const GUI_Modes = {
  NWJS: "NW.js",
  ChromeApp: "Chrome",
  Other: "Other"
}

// Timer managing methods

// name = string
// code = function reference (code to be executed)
// interval = time interval in miliseconds
// first = true/false if code should be ran initially before next timer interval hits
GUI_control.prototype.interval_add = function (name, code, interval, first) {
    var data = {'name': name, 'timer': null, 'code': code, 'interval': interval, 'fired': 0, 'paused': false};

    if (first == true) {
        code(); // execute code

        data.fired++; // increment counter
    }

    data.timer = setInterval(function() {
        code(); // execute code

        data.fired++; // increment counter
    }, interval);

    this.interval_array.push(data); // push to primary interval array

    return data;
};

// name = string
GUI_control.prototype.interval_remove = function (name) {
    for (var i = 0; i < this.interval_array.length; i++) {
        if (this.interval_array[i].name == name) {
            clearInterval(this.interval_array[i].timer); // stop timer

            this.interval_array.splice(i, 1); // remove element/object from array

            return true;
        }
    }

    return false;
};

// name = string
GUI_control.prototype.interval_pause = function (name) {
    for (var i = 0; i < this.interval_array.length; i++) {
        if (this.interval_array[i].name == name) {
            clearInterval(this.interval_array[i].timer);
            this.interval_array[i].paused = true;

            return true;
        }
    }

    return false;
};

// name = string
GUI_control.prototype.interval_resume = function (name) {
    for (var i = 0; i < this.interval_array.length; i++) {
        if (this.interval_array[i].name == name && this.interval_array[i].paused) {
            var obj = this.interval_array[i];

            obj.timer = setInterval(function() {
                obj.code(); // execute code

                obj.fired++; // increment counter
            }, obj.interval);

            obj.paused = false;

            return true;
        }
    }

    return false;
};

// input = array of timers thats meant to be kept, or nothing
// return = returns timers killed in last call
GUI_control.prototype.interval_kill_all = function (keep_array) {
    var self = this;
    var timers_killed = 0;

    for (var i = (this.interval_array.length - 1); i >= 0; i--) { // reverse iteration
        var keep = false;
        if (keep_array) { // only run through the array if it exists
            keep_array.forEach(function (name) {
                if (self.interval_array[i].name == name) {
                    keep = true;
                }
            });
        }

        if (!keep) {
            clearInterval(this.interval_array[i].timer); // stop timer

            this.interval_array.splice(i, 1); // remove element/object from array

            timers_killed++;
        }
    }

    return timers_killed;
};

// name = string
// code = function reference (code to be executed)
// timeout = timeout in miliseconds
GUI_control.prototype.timeout_add = function (name, code, timeout) {
    var self = this;
    var data = {'name': name, 'timer': null, 'timeout': timeout};

    // start timer with "cleaning" callback
    data.timer = setTimeout(function() {
        code(); // execute code

        // remove object from array
        var index = self.timeout_array.indexOf(data);
        if (index > -1) self.timeout_array.splice(index, 1);
    }, timeout);

    this.timeout_array.push(data); // push to primary timeout array

    return data;
};

// name = string
GUI_control.prototype.timeout_remove = function (name) {
    for (var i = 0; i < this.timeout_array.length; i++) {
        if (this.timeout_array[i].name == name) {
            clearTimeout(this.timeout_array[i].timer); // stop timer

            this.timeout_array.splice(i, 1); // remove element/object from array

            return true;
        }
    }

    return false;
};

// no input paremeters
// return = returns timers killed in last call
GUI_control.prototype.timeout_kill_all = function () {
    var timers_killed = 0;

    for (var i = 0; i < this.timeout_array.length; i++) {
        clearTimeout(this.timeout_array[i].timer); // stop timer

        timers_killed++;
    }

    this.timeout_array = []; // drop objects

    return timers_killed;
};

// message = string
GUI_control.prototype.log = function (message) {
    var command_log = $('div#log');
    var d = new Date();
    var year = d.getFullYear();
    var month = ((d.getMonth() < 9) ? '0' + (d.getMonth() + 1) : (d.getMonth() + 1));
    var date =  ((d.getDate() < 10) ? '0' + d.getDate() : d.getDate());
    var time = ((d.getHours() < 10) ? '0' + d.getHours(): d.getHours())
         + ':' + ((d.getMinutes() < 10) ? '0' + d.getMinutes(): d.getMinutes())
         + ':' + ((d.getSeconds() < 10) ? '0' + d.getSeconds(): d.getSeconds());

    var formattedDate = "{0}-{1}-{2} {3}".format(
                                year,
                                month,
                                date,
                                ' @ ' + time
                            );
    $('div.wrapper', command_log).append('<p>' + formattedDate + ' -- ' + message + '</p>');
    command_log.scrollTop($('div.wrapper', command_log).height());
};

// Method is called every time a valid tab change event is received
// callback = code to run when cleanup is finished
// default switch doesn't require callback to be set
GUI_control.prototype.tab_switch_cleanup = function (callback) {
    MSP.callbacks_cleanup(); // we don't care about any old data that might or might not arrive
    GUI.interval_kill_all(); // all intervals (mostly data pulling) needs to be removed on tab switch

    if (this.active_tab && TABS[this.active_tab]) {
        TABS[this.active_tab].cleanup(callback);
    } else {
        callback();
    }
};

GUI_control.prototype.switchery = function() {
    $('.togglesmall').each(function(index, elem) {
        if(DarkTheme.configEnabled) {
            var switchery = new Switchery(elem, {
              size: 'small',
              color: '#2297eb',
              secondaryColor: '#858585'
            });
        } else {
            var switchery = new Switchery(elem, {
              size: 'small',
              color: '#2297eb',
              secondaryColor: '#c4c4c4'
            });
        }
        $(elem).on("change", function (evt) {
            switchery.setPosition();
        });
        $(elem).removeClass('togglesmall');
    });

    $('.toggle').each(function(index, elem) {
        if(DarkTheme.configEnabled) {
            var switchery = new Switchery(elem, {
              color: '#2297eb',
              secondaryColor: '#858585'
            });
        } else {
            var switchery = new Switchery(elem, {
                color: '#2297eb',
                secondaryColor: '#c4c4c4'
            });
        }
        $(elem).on("change", function (evt) {
            switchery.setPosition();
        });
        $(elem).removeClass('toggle');
    });

    $('.togglemedium').each(function(index, elem) {
        if(DarkTheme.configEnabled) {
            var switchery = new Switchery(elem, {
                className: 'switcherymid',
                color: '#2297eb',
                secondaryColor: '#858585'
             });
        } else {
            var switchery = new Switchery(elem, {
                className: 'switcherymid',
                color: '#2297eb',
                secondaryColor: '#c4c4c4'
             });
        }
         $(elem).on("change", function (evt) {
             switchery.setPosition();
         });
         $(elem).removeClass('togglemedium');
    });
};

GUI_control.prototype.content_ready = function (callback) {

    this.switchery();

    if (CONFIGURATOR.connectionValid) {
        // Build link to in-use CF version documentation
        var documentationButton = $('div#content #button-documentation');
        documentationButton.html("Wiki");
        documentationButton.attr("href","https://github.com/emuflight/EmuFlight/wiki");
    }

    // loading tooltip
    jQuery(document).ready(function($) {
        $('cf_tip').each(function() { // Grab all ".cf_tip" elements, and for each...
        log(this); // ...print out "this", which now refers to each ".cf_tip" DOM element
    });

    $('.cf_tip').each(function() {
        $(this).jBox('Tooltip', {
            delayOpen: 100,
            delayClose: 100,
            position: {
                x: 'right',
                y: 'center'
            },
            outside: 'x'
            });
        });
    });


    if (callback) callback();
}

GUI_control.prototype.selectDefaultTabWhenConnected = function() {
    ConfigStorage.get(['rememberLastTab', 'lastTab'], function (result) {
        if (!(result.rememberLastTab
                && !!result.lastTab
                && result.lastTab.substring(4) != "cli")) {
            $('#tabs ul.mode-connected .tab_setup a').click();
            return;
        }
        $("#tabs ul.mode-connected ." + result.lastTab + " a").click();
    });
};

GUI_control.prototype.isChromeApp = function () {
  return this.Mode == GUI_Modes.ChromeApp;
}
GUI_control.prototype.isNWJS = function () {
  return this.Mode == GUI_Modes.NWJS;
}
GUI_control.prototype.isOther = function () {
  return this.Mode == GUI_Modes.Other;
}


// initialize object into GUI variable
var GUI = new GUI_control();
