'use strict';

/*global presetsFolders */
/*eslint no-undef: "error"*/

const fs = require('fs');
const os = require('os');

// folder to store the downloaded preset files in
// TODO: migrate to non-global

const presetsFolders = os.tmpdir();

var HttpClient = function() {
    this.get = function(aUrl, aCallback) {
        var anHttpRequest = new XMLHttpRequest();
        anHttpRequest.onreadystatechange = function() {
            if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200)
                aCallback(anHttpRequest.responseText);
        }

        anHttpRequest.open('GET', aUrl, true);
        anHttpRequest.send( null );
    }
}

console.log('Presets file location: ' + presetsFolders);

// TODO: move all of this to a class instead of being global
var client = new HttpClient();

// TODO: why seperate files?
var nonHelioUrlv020 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.2.0/presets-nonHELIO.json";
var helioUrlv020 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.2.0/presets-HELIO.json";

var nonHelioUrlv030 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.3.0/presets-nonHELIO.json";
var helioUrlv030 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.3.0/presets-HELIO.json";

var nonHelioUrlv040 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.4.0/presets-nonHELIO.json";
var helioUrlv040 = "https://raw.githubusercontent.com/emuflight/emuflight-presets/master/presets-0.4.0/presets-HELIO.json";

// TODO: migrate to a function to get rid of code duplication

client.get(nonHelioUrlv020, function(response) {
  fs.writeFile(presetsFolders + "/presets-nonHELIO-v0.2.0.json", response, (err) => {
    if (err) {
      // FIXME: add error handling
      console.error(err);
      return;
    }
    //file written successfully
  })
});

client.get(helioUrlv020, function(response) {
    fs.writeFile(presetsFolders + "/presets-HELIO-v0.2.0.json", response, (err) => {
        if (err) {
        console.error(err);
        return;
        }
        //file written successfully
    })
});

client.get(nonHelioUrlv030, function(response) {
    fs.writeFile(presetsFolders + "/presets-nonHELIO-v0.3.0.json", response, (err) => {
      if (err) {
        // FIXME: add error handling
        console.error(err);
        return;
      }
      //file written successfully
    })
  });

  client.get(helioUrlv030, function(response) {
      fs.writeFile(presetsFolders + "/presets-HELIO-v0.3.0.json", response, (err) => {
          if (err) {
          console.error(err);
          return;
          }
          //file written successfully
      })
  });

client.get(nonHelioUrlv040, function(response) {
    fs.writeFile(presetsFolders + "/presets-nonHELIO-v0.4.0.json", response, (err) => {
      if (err) {
        // FIXME: add error handling
        console.error(err);
        return;
      }
      //file written successfully
    })
  });

  client.get(helioUrlv040, function(response) {
      fs.writeFile(presetsFolders + "/presets-HELIO-v0.4.0.json", response, (err) => {
          if (err) {
          console.error(err);
          return;
          }
          //file written successfully
      })
  });


$(document).ready(function () {
    $.getJSON('version.json', function(data) {
        CONFIGURATOR.version = data.version;
        CONFIGURATOR.gitChangesetId = data.gitChangesetId;
        console.log("doc ready CONFIGURATOR.version "+CONFIGURATOR.version);
        CONFIGURATOR.max_msp = data.max_msp;
        console.log("doc ready CONFIGURATOR.max_msp "+CONFIGURATOR.max_msp);

        // Version in the ChromeApp's manifest takes precedence.
        if(chrome.runtime && chrome.runtime.getManifest) {
            var manifest = chrome.runtime.getManifest();
            CONFIGURATOR.version = manifest.version;
            console.log("chrome runtime CONFIGURATOR.version "+CONFIGURATOR.version);
            CONFIGURATOR.max_msp = manifest.max_msp;
            console.log("chrome runtime CONFIGURATOR.max_msp "+CONFIGURATOR.max_msp);
            // manifest.json for ChromeApp can't have a version
            // with a prerelease tag eg 10.0.0-RC4
            // Work around is to specify the prerelease version in version_name
            if (manifest.version_name) {
                CONFIGURATOR.version = manifest.version_name;
            }
        }
        i18n.init(function() {
            startProcess();
            initializeSerialBackend();
        });
    });
});

function getBuildType() {
    return GUI.Mode;
}

//Process to execute to real start the app
function startProcess() {
    var debugMode = typeof process === "object" && process.versions['nw-flavor'] === 'sdk';

    if (GUI.isNWJS()) {
        console.log("GUI.isNWJS");
        let nwWindow = GUI.nwGui.Window.get();
        nwWindow.on('close', closeHandler);
        nwWindow.on('new-win-policy', function(frame, url, policy) {
            // do not open the window
            policy.ignore();
            // and open it in external browser
            GUI.nwGui.Shell.openExternal(url);
        });
    } else if (GUI.isChromeApp()) {
        console.log("GUI.isChromeApp");
        chrome.app.window.onClosed.addListener(closeHandler); //does not seem to work with NW2
        // This event does not actually get fired:
        chrome.runtime.onSuspend.addListener(closeHandler);
    }

    function closeHandler() {
        console.log("closing...");
        this.hide();
        MSP.send_message(MSPCodes.MSP_SET_REBOOT, false, false);
        this.close(true);
    }

    // translate to user-selected language
    i18n.localizePage();

    // alternative - window.navigator.appVersion.match(/Chrome\/([0-9.]*)/)[1];
    GUI.log(i18n.getMessage('infoVersions',{operatingSystem: GUI.operating_system,
                                            chromeVersion: window.navigator.appVersion.replace(/.*Chrome\/([0-9.]*).*/, "$1"),
                                            configuratorVersion: CONFIGURATOR.version }));

    $('#logo .version').text(CONFIGURATOR.version);
    updateStatusBarVersion();
    updateTopBarVersion();

    // notification messages for various operating systems
    switch (GUI.operating_system) {
        case 'Windows':
            break;
        case 'MacOS':
            // var main_chromium_version = window.navigator.appVersion.replace(/.*Chrome\/([0-9.]*).*/,"$1").split('.')[0];
            break;
        case 'ChromeOS':
            break;
        case 'Linux':
            break;
        case 'UNIX':
            break;
    }

    if (!GUI.isOther() && GUI.operating_system !== 'ChromeOS') {
        checkForConfiguratorUpdates();
    }

    // log webgl capability
    // it would seem the webgl "enabling" through advanced settings will be ignored in the future
    // and webgl will be supported if gpu supports it by default (canary 40.0.2175.0), keep an eye on this one
    var canvas = document.createElement('canvas');

    // log library versions in console to make version tracking easier
    console.log('Libraries: jQuery - ' + $.fn.jquery + ', d3 - ' + d3.version + ', three.js - ' + THREE.REVISION);

    // Tabs
    $("#tabs ul.mode-connected li").click(function() {
        // store the first class of the current tab (omit things like ".active")
        ConfigStorage.set({lastTab: $(this).attr("class").split(' ')[0]});
    });

    var ui_tabs = $('#tabs > ul');
    $('a', ui_tabs).click(function () {
        if ($(this).parent().hasClass('active') == false && !GUI.tab_switch_in_progress) { // only initialize when the tab isn't already active
            var self = this,
                tabClass = $(self).parent().prop('class');

            var tabRequiresConnection = $(self).parent().hasClass('mode-connected');

            var tab = tabClass.substring(4);
            var tabName = $(self).text();

            if (tabRequiresConnection && !CONFIGURATOR.connectionValid) {
                GUI.log(i18n.getMessage('tabSwitchConnectionRequired'));
                return;
            }

            if (GUI.connect_lock) { // tab switching disabled while operation is in progress
                GUI.log(i18n.getMessage('tabSwitchWaitForOperation'));
                return;
            }

            if (GUI.allowedTabs.indexOf(tab) < 0 && tabName == "Firmware Flasher") {
                if (GUI.connected_to || GUI.connecting_to) {
                    $('a.connect').click();
                } else {
                    self.disconnect();
                }
                $('div.open_firmware_flasher a.flash').click();
            } else if (GUI.allowedTabs.indexOf(tab) < 0) {
                GUI.log(i18n.getMessage('tabSwitchUpgradeRequired', [tabName]));
                return;
            }

            GUI.tab_switch_in_progress = true;

            GUI.tab_switch_cleanup(function () {
                // disable active firmware flasher if it was active
                if ($('div#flashbutton a.flash_state').hasClass('active') && $('div#flashbutton a.flash').hasClass('active')) {
                    $('div#flashbutton a.flash_state').removeClass('active');
                    $('div#flashbutton a.flash').removeClass('active');
                }
                // disable previously active tab highlight
                $('li', ui_tabs).removeClass('active');

                // Highlight selected tab
                $(self).parent().addClass('active');

                // detach listeners and remove element data
                var content = $('#content');
                content.empty();

                // display loading screen
                $('#cache .data-loading').clone().appendTo(content);

                function content_ready() {
                    GUI.tab_switch_in_progress = false;
                }

                switch (tab) {

                    case 'mixercalc':
                        TABS.staticTab.initialize('mixercalc', content_ready);
                        break;

                    case 'landing':
                        TABS.landing.initialize(content_ready);
                        break;
                    case 'changelog':
                        TABS.staticTab.initialize('changelog', content_ready);
                        break;
                    case 'privacy_policy':
                        TABS.staticTab.initialize('privacy_policy', content_ready);
                        break;
                    case 'firmware_flasher':
                        TABS.firmware_flasher.initialize(content_ready);
                        break;
                    case 'help':
                        TABS.help.initialize(content_ready);
                        break;
                    case 'auxiliary':
                        TABS.auxiliary.initialize(content_ready);
                        break;
                    case 'adjustments':
                        TABS.adjustments.initialize(content_ready);
                        break;
                    case 'ports':
                        TABS.ports.initialize(content_ready);
                        break;
                    case 'led_strip':
                        TABS.led_strip.initialize(content_ready);
                        break;
                    case 'failsafe':
                        TABS.failsafe.initialize(content_ready);
                        break;
                    case 'transponder':
                        TABS.transponder.initialize(content_ready);
                        break;
                    case 'osd':
                        TABS.osd.initialize(content_ready);
                        break;
                    case 'power':
                        TABS.power.initialize(content_ready);
                        break;
                    case 'setup':
                        TABS.setup.initialize(content_ready);
                        break;
                    case 'setup_osd':
                        TABS.setup_osd.initialize(content_ready);
                        break;

                    case 'configuration':
                        TABS.configuration.initialize(content_ready);
                        break;
                    case 'pid_tuning':
                        TABS.pid_tuning.initialize(content_ready);
                        break;
                    case 'receiver':
                        TABS.receiver.initialize(content_ready);
                        break;
                    case 'servos':
                        TABS.servos.initialize(content_ready);
                        break;
                    case 'gps':
                        TABS.gps.initialize(content_ready);
                        break;
                    case 'motors':
                        TABS.motors.initialize(content_ready);
                        break;
                    case 'sensors':
                        TABS.sensors.initialize(content_ready);
                        break;
                    case 'logging':
                        TABS.logging.initialize(content_ready);
                        break;
                    case 'onboard_logging':
                        TABS.onboard_logging.initialize(content_ready);
                        break;
                    case 'vtx':
                        TABS.vtx.initialize(content_ready);
                        break;
                    case 'cli':
                        TABS.cli.initialize(content_ready, GUI.nwGui);
                        break;

                    default:
                        console.log('Tab not found:' + tab);
                }
            });
        }
    });

    $('#tabs ul.mode-disconnected li a:first').click();

    // options
    $('a#options').click(function () {
        var el = $(this);

        if (!el.hasClass('active')) {
            el.addClass('active');
            el.after('<div id="options-window"></div>');

            $('div#options-window').load('./tabs/options.html', function () {
                // translate to user-selected language
                i18n.localizePage();

                ConfigStorage.get('permanentExpertMode', function (result) {
                    if (result.permanentExpertMode) {
                        $('div.permanentExpertMode input').prop('checked', true);
                    }

                    $('div.permanentExpertMode input').change(function () {
                        var checked = $(this).is(':checked');

                        ConfigStorage.set({'permanentExpertMode': checked});

                        $('input[name="expertModeCheckbox"]').prop('checked', checked).change();
                    }).change();
                });

                ConfigStorage.get('rememberLastTab', function (result) {
                    $('div.rememberLastTab input')
                        .prop('checked', !!result.rememberLastTab)
                        .change(function() { ConfigStorage.set({rememberLastTab: $(this).is(':checked')}) })
                        .change();
                });

                if (GUI.operating_system !== 'ChromeOS') {
                    ConfigStorage.get('checkForConfiguratorUnstableVersions', function (result) {
                        if (result.checkForConfiguratorUnstableVersions) {
                            $('div.checkForConfiguratorUnstableVersions input').prop('checked', true);
                        }

                        $('div.checkForConfiguratorUnstableVersions input').change(function () {
                            var checked = $(this).is(':checked');

                            ConfigStorage.set({'checkForConfiguratorUnstableVersions': checked});

                            checkForConfiguratorUpdates();
                        });
                    });
                } else {
                    $('div.checkForConfiguratorUnstableVersions').hide();
                }

                $('div.cliAutoComplete input')
                    .prop('checked', CliAutoComplete.configEnabled)
                    .change(function () {
                        var checked = $(this).is(':checked');

                        ConfigStorage.set({'cliAutoComplete': checked});
                        CliAutoComplete.setEnabled(checked);
                    }).change();

                $('div.darkTheme input')
                    .prop('checked', DarkTheme.configEnabled)
                    .change(function () {
                        var checked = $(this).is(':checked');

                        ConfigStorage.set({'darkTheme': checked});
                        DarkTheme.setConfig(checked);
                    }).change();

                function close_and_cleanup(e) {
                    if (e.type == 'click' && !$.contains($('div#options-window')[0], e.target) || e.type == 'keyup' && e.keyCode == 27) {
                        $(document).unbind('click keyup', close_and_cleanup);

                        $('div#options-window').slideUp(250, function () {
                            el.removeClass('active');
                            $(this).empty().remove();
                        });
                    }
                }

                $(document).bind('click keyup', close_and_cleanup);

                $(this).slideDown(250);
            });
        }
    });

    // listen to all input change events and adjust the value within limits if necessary
    $("#content").on('focus', 'input[type="number"]', function () {
        var element = $(this),
            val = element.val();

        if (!isNaN(val)) {
            element.data('previousValue', parseFloat(val));
        }
    });

    $("#content").on('keydown', 'input[type="number"]', function (e) {
        // whitelist all that we need for numeric control
        var whitelist = [
            96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, // numpad and standard number keypad
            109, 189, // minus on numpad and in standard keyboard
            8, 46, 9, // backspace, delete, tab
            190, 110, // decimal point
            37, 38, 39, 40, 13 // arrows and enter
        ];

        if (whitelist.indexOf(e.keyCode) == -1) {
            e.preventDefault();
        }
    });

    $("#content").on('change', 'input[type="number"]', function () {
        var element = $(this),
            min = parseFloat(element.prop('min')),
            max = parseFloat(element.prop('max')),
            step = parseFloat(element.prop('step')),
            val = parseFloat(element.val()),
            decimal_places;

        // only adjust minimal end if bound is set
        if (element.prop('min')) {
            if (val < min) {
                element.val(min);
                val = min;
            }
        }

        // only adjust maximal end if bound is set
        if (element.prop('max')) {
            if (val > max) {
                element.val(max);
                val = max;
            }
        }

        // if entered value is illegal use previous value instead
        if (isNaN(val)) {
            element.val(element.data('previousValue'));
            val = element.data('previousValue');
        }

        // if step is not set or step is int and value is float use previous value instead
        if (isNaN(step) || step % 1 === 0) {
            if (val % 1 !== 0) {
                element.val(element.data('previousValue'));
                val = element.data('previousValue');
            }
        }

        // if step is set and is float and value is int, convert to float, keep decimal places in float according to step *experimental*
        if (!isNaN(step) && step % 1 !== 0) {
            decimal_places = String(step).split('.')[1].length;

            if (val % 1 === 0) {
                element.val(val.toFixed(decimal_places));
            } else if (String(val).split('.')[1].length != decimal_places) {
                element.val(val.toFixed(decimal_places));
            }
        }
    });

    $("#showlog").on('click', function () {
        var state = $(this).data('state');
        if (state) {
            $("#log").animate({height: 27}, 200, function () {
                var command_log = $('div#log');
                command_log.scrollTop($('div.wrapper', command_log).height());
            });
            $("#log").removeClass('active');
            $("#content").removeClass('logopen');
            $(".tab_container").removeClass('logopen');
            $("#scrollicon").removeClass('active');
            ConfigStorage.set({'logopen': false});

            state = false;
        } else {
            $("#log").animate({height: 111}, 200);
            $("#log").addClass('active');
            $("#content").addClass('logopen');
            $(".tab_container").addClass('logopen');
            $("#scrollicon").addClass('active');
            ConfigStorage.set({'logopen': true});

            state = true;
        }
        $(this).text(state ? i18n.getMessage('logActionHide') : i18n.getMessage('logActionShow'));
        $(this).data('state', state);
    });

    ConfigStorage.get('logopen', function (result) {
        if (result.logopen) {
            $("#showlog").trigger('click');
        }
    });

    ConfigStorage.get('permanentExpertMode', function (result) {
        if (result.permanentExpertMode) {
            $('input[name="expertModeCheckbox"]').prop('checked', true);
        }

        $('input[name="expertModeCheckbox"]').change(function () {
            var checked = $(this).is(':checked');

            if (FEATURE_CONFIG && FEATURE_CONFIG.features !== 0) {
                updateTabList(FEATURE_CONFIG.features);
            }
        }).change();
    });

    ConfigStorage.get('cliAutoComplete', function (result) {
        CliAutoComplete.setEnabled(typeof result.cliAutoComplete == 'undefined' || result.cliAutoComplete); // On by default
    });

    ConfigStorage.get('darkTheme', function (result) {
        DarkTheme.setConfig(typeof result.darkTheme == 'undefined' || result.darkTheme);
    });

    $('.connect_b a.connect').removeClass('disabled');
    $('.firmware_b a.flash').removeClass('disabled');
};

function checkForConfiguratorUpdates() {

    var releaseChecker = new ReleaseChecker('configurator', 'https://api.github.com/repos/Emuflight/EmuConfigurator/releases');

    releaseChecker.loadReleaseData(notifyOutdatedVersion);
}

function notifyOutdatedVersion(releaseData) {
    ConfigStorage.get('checkForConfiguratorUnstableVersions', function (result) {
        var showUnstableReleases = false;
        if (result.checkForConfiguratorUnstableVersions) {
            showUnstableReleases = true;
        }
         var versions = releaseData.filter(function (version) {
             var semVerVersion = semver.parse(version.tag_name);
             if (semVerVersion && (showUnstableReleases || semVerVersion.prerelease.length === 0)) {
                 return version;
             }
         }).sort(function (v1, v2) {
            try {
                return semver.compare(v2.tag_name, v1.tag_name);
            } catch (e) {
                return false;
            }
        });

        if (versions.length > 0 && semver.lt(CONFIGURATOR.version, versions[0].tag_name)) {
            GUI.log(i18n.getMessage('configuratorUpdateNotice', [versions[0].tag_name, versions[0].html_url]));

            var dialog = $('.dialogConfiguratorUpdate')[0];

            $('.dialogConfiguratorUpdate-content').html(i18n.getMessage('configuratorUpdateNotice', [versions[0].tag_name, versions[0].html_url]));

            $('.dialogConfiguratorUpdate-closebtn').click(function() {
                dialog.close();
            });

            $('.dialogConfiguratorUpdate-websitebtn').click(function() {
                dialog.close();

                window.open(versions[0].html_url, '_blank');
            });

            dialog.showModal();
        }
    });
}

function update_packet_error(caller) {
    $('span.packet-error').html(caller.packet_error);
}

function microtime() {
    var now = new Date().getTime() / 1000;

    return now;
}

function millitime() {
    var now = new Date().getTime();

    return now;
}

var DEGREE_TO_RADIAN_RATIO = Math.PI / 180;

function degToRad(degrees) {
    return degrees * DEGREE_TO_RADIAN_RATIO;
}

function bytesToSize(bytes) {
    if (bytes < 1024) {
        bytes = bytes + ' Bytes';
    } else if (bytes < 1048576) {
        bytes = (bytes / 1024).toFixed(3) + ' KB';
    } else if (bytes < 1073741824) {
        bytes = (bytes / 1048576).toFixed(3) + ' MB';
    } else {
        bytes = (bytes / 1073741824).toFixed(3) + ' GB';
    }

    return bytes;
}

function isExpertModeEnabled() {
    return $('input[name="expertModeCheckbox"]').is(':checked');
}

function updateTabList(features) {
    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_failsafe').show();
        $('#tabs ul.mode-connected li.tab_adjustments').show();
        $('#tabs ul.mode-connected li.tab_servos').show();
        $('#tabs ul.mode-connected li.tab_sensors').show();
        $('#tabs ul.mode-connected li.tab_logging').show();
    } else {
        $('#tabs ul.mode-connected li.tab_failsafe').hide();
        $('#tabs ul.mode-connected li.tab_adjustments').hide();
        $('#tabs ul.mode-connected li.tab_servos').hide();
        $('#tabs ul.mode-connected li.tab_sensors').hide();
        $('#tabs ul.mode-connected li.tab_logging').hide();
    }

    if (features.isEnabled('GPS') && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_gps').show();
    } else {
        $('#tabs ul.mode-connected li.tab_gps').hide();
    }

    if (features.isEnabled('LED_STRIP')) {
        $('#tabs ul.mode-connected li.tab_led_strip').show();
    } else {
        $('#tabs ul.mode-connected li.tab_led_strip').hide();
    }

    if (features.isEnabled('TRANSPONDER')) {
        $('#tabs ul.mode-connected li.tab_transponder').show();
    } else {
        $('#tabs ul.mode-connected li.tab_transponder').hide();
    }

    if (features.isEnabled('OSD')) {
        $('#tabs ul.mode-connected li.tab_osd').show();
    } else {
        $('#tabs ul.mode-connected li.tab_osd').hide();
    }

    if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
        $('#tabs ul.mode-connected li.tab_power').show();
    } else {
        $('#tabs ul.mode-connected li.tab_power').hide();
    }

    if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
        $('#tabs ul.mode-connected li.tab_vtx').show();
    } else {
        $('#tabs ul.mode-connected li.tab_vtx').hide();
    }

    //experimental: show/hide with expert-mode
    if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
        if (!isExpertModeEnabled()) {
            $('.LPFPit').hide();
            $('.LPFYaw').hide();
            $('#pid-tuning .gyroLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningGyroLowpassFrequency"));
            $('#pid-tuning .gyroLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningGyroLowpass2Frequency"));
            $('#pid-tuning .dtermLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningDTermLowpassFrequency"));
            $('#pid-tuning .dtermLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningDTermLowpass2Frequency"));
        } else {
            $('.LPFPit').show();
            $('.LPFYaw').show();
            $('#pid-tuning .gyroLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("gyroLowpassFrequencyRoll"));
            $('#pid-tuning .gyroLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("gyroLowpass2FrequencyRoll"));
            $('#pid-tuning .dtermLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("dtermLowpassFrequencyRoll"));
            $('#pid-tuning .dtermLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("dtermLowpass2FrequencyRoll"));
        }
    }

    //experimental: show/hide with expert-mode
    if (!isExpertModeEnabled()) {
        $('.IMUFQroll').show();
        $('.IMUFQpitch').hide();
        $('.IMUFQyaw').hide();
        $('#pid-tuning .IMUFQroll').text(i18n.getMessage("pidTuningImufQ"));
    } else {
        $('.IMUFQroll').show();
        $('.IMUFQpitch').show();
        $('.IMUFQyaw').show();
        $('#pid-tuning .IMUFQroll').text(i18n.getMessage("pidTuningImufRollQ"));
    }

    //experimental: show/hide with expert-mode
    if (CONFIG.boardIdentifier == "HESP" || CONFIG.boardIdentifier == "SX10" || CONFIG.boardIdentifier == "FLUX") {
        if (!isExpertModeEnabled()) {
        $('.IMUFLPFroll').show();
        $('.IMUFLPFpitch').hide();
        $('.IMUFLPFyaw').hide();
        $('#pid-tuning .IMUFLPFroll').text(i18n.getMessage("pidTuningImuflpf"));
        console.log("Helio IMUF LPF basic mode");
        } else {
        $('.IMUFLPFroll').show();
        $('.IMUFLPFpitch').show();
        $('.IMUFLPFyaw').show();
        $('#pid-tuning .IMUFLPFroll').text(i18n.getMessage("pidTuningImuflpfRoll"));
        console.log("Helio IMUF LPF expert mode");
        }
    } else {
        $('.IMUFLPF').hide();
        $('.IMUFLPFroll').hide();
        $('.IMUFLPFpitch').hide();
        $('.IMUFLPFyaw').hide();
        console.log("non-Helio hide IMUF LPF");
    }

    //experimental: show/hide with expert-mode
    if (isExpertModeEnabled()) {
        $('.isexpertmode').show(); //show everything but turn off things per MSP below
        if (!have_sensor(CONFIG.activeSensors, 'acc')) {
            $('#pid_accel').hide();
        }
    } else {
        $('.isexpertmode').hide();
    }

    //experimental: expert-mode undo show for old firmware that does not support.
    if (semver.lt(CONFIG.apiVersion, "1.43.0")) {
        $('.spa').hide();
        $('.spa_roll').hide();
        $('.spa_pitch').hide();
        $('.spa_yaw').hide();
    }

    //MSP 15.51 adjust semver.gte
    if ( semver.lt(CONFIG.apiVersion, "1.44.0") || semver.lt(CONFIG.flightControllerVersion, "0.2.35") || semver.gte(CONFIG.apiVersion, "1.51.0")  ) {
        $('.smartDTermWitchBox').hide();
    }

    //MSP 1.51
    //expermode show/hide
    if (isExpertModeEnabled()) {
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //debug
            console.log("expert-toggle: MSP 1.51 -- show stuff");
            $('.emuGravity').show();
            $('.GyroABGFilter').show();
            $('.DTermABGFilter').show();
        } else { //not MSP 1.51
            //debug
            console.log("expert-toggle: not MSP 1.51 -- hide stuff");
            $('.tab_container .subtab-feel').hide();
            $('.subtab-feel').hide();
            $('.feel').hide(); //hacky but works
            $('.emuGravity').hide();
            $('.GyroABGFilter').hide();
            $('.DTermABGFilter').hide();
            $('.MotorMixer').hide();
            $('.ThrustLinear').hide();
            $('.ThrottleLinear').hide();
            $('.AxisLock').hide();
        }
    }
    //end MSP 1.51
} //end updateTabList

function zeroPad(value, width) {
    value = "" + value;

    while (value.length < width) {
        value = "0" + value;
    }

    return value;
}

function generateFilename(prefix, suffix) {
    var date = new Date();
    var filename = prefix;

    if (CONFIG) {
        if (CONFIG.flightControllerIdentifier) {
            filename = CONFIG.flightControllerIdentifier + '_' + filename;
        }
        if(CONFIG.name && CONFIG.name.trim() !== '') {
            filename = filename + '_' + CONFIG.name.trim().replace(' ', '_');
        }
    }

    filename = filename + '_' + date.getFullYear()
        + zeroPad(date.getMonth() + 1, 2)
        + zeroPad(date.getDate(), 2)
        + '_' + zeroPad(date.getHours(), 2)
        + zeroPad(date.getMinutes(), 2)
        + zeroPad(date.getSeconds(), 2);

    return filename + '.' + suffix;
}

function getTargetVersion(hardwareId) {
    var versionText = '';

    if (hardwareId) {
       versionText += i18n.getMessage('versionLabelTarget') + ': ' + hardwareId;
    }

    return versionText;
}

function getFirmwareVersion(firmwareVersion, firmwareId) {
    var versionText = '';

    if (firmwareVersion) {
        versionText += i18n.getMessage('versionLabelFirmware') + ': ' + firmwareId + ' ' + firmwareVersion;
    }

    return versionText;
}

function getConfiguratorVersion() {
    return i18n.getMessage('versionLabelConfigurator') + ': ' + CONFIGURATOR.version;
}

function updateTopBarVersion(firmwareVersion, firmwareId, hardwareId) {
    var versionText = getConfiguratorVersion() + '<br />';

    versionText = versionText + getFirmwareVersion(firmwareVersion, firmwareId) + '<br />';

    versionText = versionText + getTargetVersion(hardwareId);

    $('#logo .logo_text').html(versionText);
}

function updateStatusBarVersion(firmwareVersion, firmwareId, hardwareId) {
    var versionText = '';

    versionText = versionText + getFirmwareVersion(firmwareVersion, firmwareId);

    if (versionText !== '') {
        versionText = versionText + ', ';
    }

    let targetVersion = getTargetVersion(hardwareId);
    versionText = versionText + targetVersion;

    if (targetVersion !== '') {
        versionText = versionText + ', ';
    }

    versionText = versionText + getConfiguratorVersion() + ' (' + CONFIGURATOR.gitChangesetId + ')';

    $('#status-bar .version').text(versionText);
}

function showErrorDialog(message) {
   var dialog = $('.dialogError')[0];

    $('.dialogError-content').html(message);

    $('.dialogError-closebtn').click(function() {
        dialog.close();
    });

    dialog.showModal();
}
