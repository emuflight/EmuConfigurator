'use strict';
TABS.vtx = {
    supported: false,
    //vtxTableSavePending: false,
    //vtxTableFactoryBandsSupported: false,
    MAX_POWERLEVEL_VALUES: 8,
    MAX_BAND_VALUES: 5,
    MAX_BAND_CHANNELS_VALUES: 8,
    //VTXTABLE_BAND_LIST: [],
    //VTXTABLE_POWERLEVEL_LIST: [],
    //analyticsChanges: {},
    updating: true,
    //env: new djv(),
    //get _DEVICE_STATUS_UPDATE_INTERVAL_NAME() {
    //    return "vtx_device_status_request";
    //},
    //    activeSubtab: 'vtx'
};

//TABS.vtx.isVtxDeviceStatusNotReady = function()
//{
//    const isReady = (null !== VTX_DEVICE_STATUS) && (VTX_DEVICE_STATUS.deviceIsReady);
//    console.log('TABS.vtx.isVtxDeviceStatusNotReady()');
//    return !isReady;
//};

//TABS.vtx.updateVtxDeviceStatus = function()
//{
//    console.log('enter TABS.vtx.updateVtxDeviceStatus()');
//    //MSP.send_message(MSPCodes.MSP2_GET_VTX_DEVICE_STATUS, false, false, vtxDeviceStatusReceived);
//

//    function vtxDeviceStatusReceived()
//    {
//        $("#vtx_type_description").text(TABS.vtx.getVtxTypeString());
//    };
//    console.log('exit TABS.vtx.updateVtxDeviceStatus()');
//};

TABS.vtx.getVtxTypeString = function() {
    console.log('enter TABS.vtx.getVtxTypeString()');
    let result = i18n.getMessage(`vtxType_${VTX_CONFIG.vtx_type}`);
    const isSmartAudio = VtxDeviceTypes.VTXDEV_SMARTAUDIO === VTX_CONFIG.vtx_type;
    //const isVtxDeviceStatusReceived = null !== VTX_DEVICE_STATUS;
    if (isSmartAudio) { // && isVtxDeviceStatusReceived) {
        //result += ` ${VTX_DEVICE_STATUS.smartAudioVersion}`;
        //result += `VTX_CONFIG.vtx_type`;
    }
    console.log('exit TABS.vtx.getVtxTypeString()');
    return result;
};

TABS.vtx.initialize = function(callback) {
    console.log('enter TABS.vtx.initialize()');
    var self = this;
    if (GUI.active_tab != 'vtx') {
        GUI.active_tab = 'vtx';
    }
    this.supported = semver.gte(CONFIG.apiVersion, "1.40.0"); //since 0.1.0
    if (!this.supported) {
        console.log('!this.supported');
        load_html();
    } else {
        console.log('read_vtx_config(load_html)');
        read_vtx_config(load_html);
    }

    function load_html() {
        $('#content').load("./tabs/vtx.html", process_html);
    };

    function process_html() {
        console.log('enter process_html()');
        initDisplay();
        // translate to user-selected language
        i18n.localizePage();
        self.updating = false;
        GUI.content_ready(callback);
        console.log('exit process_html()');
    };

    // Read all the MSP data needed by the tab
    function read_vtx_config(callback_after_msp) {
        console.log('read_vtx_config()');
        vtx_config();

        function vtx_config() {
            console.log('enter vtx_config() [MSP.send_message]');
            //MSP.send_message(MSPCodes.MSP_VTX_CONFIG, false, false, vtxConfigReceived);
            MSP.send_message(MSPCodes.MSP_VTX_CONFIG, false, false, load_html);
            console.log('exit vtx_config()');
        };

        //        function vtxConfigReceived() {
        //            console.log('enter read_vtx_config().vtxConfigReceived()');
        //            if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
        //                GUI.interval_add('vtx_pull',//self._DEVICE_STATUS_UPDATE_INTERVAL_NAME,
        //                    TABS.vtx.updateVtxDeviceStatus,
        //                    1000, false,
        //                    TABS.vtx.isVtxDeviceStatusNotReady,
        //                );
        //            }
        //            console.log('exit read_vtx_config().vtxConfigReceived()');
        //            //vtxtable_bands();
        //        }
    };

    // Prepares all the UI elements, the MSP command has been executed before
    function initDisplay() {
        console.log('enter initDisplay()');
        if (!TABS.vtx.supported) {
            $(".tab-vtx").removeClass("supported");
            console.log('!TABS.vtx.supported');
            return;
        }
        $(".tab-vtx").addClass("supported");
        // Load all the dynamic elements
        populateBandSelect();
        populatePowerSelect();
        populateChannelSelect();  //EmuF moved this here

        $(".uppercase").keyup(function() {
            this.value = this.value.toUpperCase().trim();
        });
        // Supported?
        const vtxSupported = VTX_CONFIG.vtx_type !== VtxDeviceTypes.VTXDEV_UNSUPPORTED && VTX_CONFIG.vtx_type !== VtxDeviceTypes.VTXDEV_UNKNOWN;
        $(".vtx_supported").toggle(vtxSupported);
        $(".vtx_not_supported").toggle(!vtxSupported);
        // Insert actual values in the fields
        // Values of the selected mode
        $("#vtx_frequency").val(VTX_CONFIG.vtx_frequency);

        $("#vtx_band").val(VTX_CONFIG.vtx_band);
        //$("#vtx_band").change(populateChannelSelect).change();  // resets channel list / lets disable & move

        $("#vtx_channel").val(VTX_CONFIG.vtx_channel);

        $("#vtx_power").val(VTX_CONFIG.vtx_power);
        $("#vtx_pit_mode").prop('checked', VTX_CONFIG.vtx_pit_mode);
        $("#vtx_pit_mode_frequency").val(VTX_CONFIG.vtx_pit_mode_frequency);
        //$("#vtx_low_power_disarm").val(VTX_CONFIG.vtx_low_power_disarm);  //not EMUF MSP
        // Values of the current values
        //const yesMessage =  i18n.getMessage("yes");
        //const noMessage =  i18n.getMessage("no");
        //$("#vtx_device_ready_description").text(VTX_CONFIG.vtx_device_ready ? yesMessage : noMessage);
        $("#vtx_type_description").text(self.getVtxTypeString()); //keep this one if nothing else

        $('input[id="vtx_frequency_channel"]').change(frequencyOrBandChannel);
        frequencyOrBandChannel($('input[id="vtx_frequency_channel"]'));

        //REFRESH BUTTON
        $('a.refresh').click(function() {   //this one clicked
            console.log('a.refresh clicked');
            self.refresh(function() {
                GUI.log(i18n.getMessage('VTX tab refreshed'));
            });
            console.log('exit refresh clicked');
        });


        // SAVE BUTTOn
        console.log('setup save clickable');
        $('a.save').click(function() {
            console.log('save clicked');
            if (!self.updating) {
                console.log('call save_vtx()');
                save_vtx();
            }
        });

        console.log('exit initDisplay()');
    }; //initDisplay

    //////////// cut vtx tables

    // Actions and other
    function frequencyOrBandChannel() {
        console.log('enter frequencyOrBandChannel()');
        const frequencyEnabled = $(this).prop('checked');
        if (frequencyEnabled) {
            $(".field.vtx_channel").slideUp(100, function() {

                $(".field.vtx_band").slideUp(100, function() {
                    $(".field.vtx_frequency").slideDown(100);
                });
            });
        } else {
            $(".field.vtx_frequency").slideUp(100, function() {

                $(".field.vtx_band").slideDown(100, function() {
                    $(".field.vtx_channel").slideDown(100);
                });
            });
        }
        console.log('exit frequencyOrBandChannel()');
    };

    $("#vtx_frequency_channel").prop('checked', VTX_CONFIG.vtx_band === 0 && VTX_CONFIG.vtx_frequency > 0).change(frequencyOrBandChannel);
    if ($("#vtx_frequency_channel").prop('checked')) {
        $(".field.vtx_channel").hide();
        $(".field.vtx_band").hide();
        $(".field.vtx_frequency").show();
    } else {
        $(".field.vtx_channel").show();
        $(".field.vtx_band").show();
        $(".field.vtx_frequency").hide();
    }

    //////////// cut vtx tables

    function populateBandSelect() {
        console.log('enter populateBandSelect()');
        const selectBand = $(".field #vtx_band");
        selectBand.append(new Option(i18n.getMessage('vtxBand_0'), 0));
        for (let i = 1; i <= TABS.vtx.MAX_BAND_VALUES; i++) {
            selectBand.append(new Option(i18n.getMessage('vtxBand_X', {
                bandName: i
            }), i));
        }
        console.log('exit populateBandSelect()');
    };

    function populateChannelSelect() {
        console.log('enter populateChannelSelect()');
        const selectChannel = $(".field #vtx_channel");
        // const selectedBand = $("#vtx_band").val(); //makes no sense for non-vtxTables
        selectChannel.empty();
        //selectChannel.append(new Option(i18n.getMessage('vtxChannel_0'), 0));  //in EmuF, 0 is not possible
        for (let i = 1; i <= TABS.vtx.MAX_BAND_CHANNELS_VALUES; i++) {
            selectChannel.append(new Option(i18n.getMessage('vtxChannel_X', {
                channelName: i
            }), i));
        }
        console.log('exit populateChannelSelect()');
    };

    function populatePowerSelect() {
        console.log('enter populatePowerSelect()');
        const selectPower = $(".field #vtx_power");
        const powerMaxMinValues = getPowerValues(VTX_CONFIG.vtx_type);
        for (let i = powerMaxMinValues.min; i <= powerMaxMinValues.max; i++) {
            if (i === 0) {
                selectPower.append(new Option(i18n.getMessage('vtxPower_0'), 0));
            } else {
                selectPower.append(new Option(i18n.getMessage('vtxPower_X', {
                    powerLevel: i
                }), i));
            }
        }
        console.log('exit populatePowerSelect()');
    };

    // Returns the power values min and max depending on the VTX Type
    function getPowerValues(vtxType) {
        console.log('enter getPowerValues()');
        let powerMinMax = {};
        switch (vtxType) {
            case VtxDeviceTypes.VTXDEV_UNSUPPORTED:
                powerMinMax = {};
                break;
            case VtxDeviceTypes.VTXDEV_RTC6705:
                powerMinMax = {
                    min: 0,
                    max: 3
                };
                break;
            case VtxDeviceTypes.VTXDEV_SMARTAUDIO:
                powerMinMax = {
                    min: 0,
                    max: 4
                };
                break;
            case VtxDeviceTypes.VTXDEV_TRAMP:
                powerMinMax = {
                    min: 0,
                    max: 5
                };
                break;
            case VtxDeviceTypes.VTXDEV_UNKNOWN:
            default:
                powerMinMax = {
                    min: 0,
                    max: 7
                };
        }
        console.log('exit getPowerValues()');
        return powerMinMax;
    };



    // Save all the values from the tab to MSP
    function save_vtx() {
        console.log('enter save_vtx()');
        self.updating = true;
        dump_html_to_msp();
        // Start MSP saving
        save_vtx_config();

        function save_vtx_config() {
            console.log('enter save_vtx_config()');
            //MSP.send_message(MSPCodes.MSP_SET_VTX_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_VTX_CONFIG), false, save_vtx_powerlevels);
            MSP.send_message(MSPCodes.MSP_SET_VTX_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_VTX_CONFIG), false, save_completed);
            save_to_eeprom();
            console.log('exit save_vtx_config()');
        };

//      function save_vtx_powerlevels() {
//          console.log('enter save_vtx_powerlevels()');
//          // Simulation of static variable
//          if (typeof save_vtx_powerlevels.counter === 'undefined') {
//              save_vtx_powerlevels.counter = 0;
//          } else {
//              save_vtx_powerlevels.counter++;
//          }
//          save_vtx_bands();
//          console.log('exit save_vtx_powerlevels()');
//      };

//      function save_vtx_bands() {
//          console.log('enter save_vtx_bands()');
//          // Simulation of static variable
//          if (typeof save_vtx_bands.counter === 'undefined') {
//              save_vtx_bands.counter = 0;
//          } else {
//              save_vtx_bands.counter++;
//          }
//          save_vtx_bands.counter = undefined;
//          save_to_eeprom();
//          console.log('exit save_vtx_bands()');
//      };

       function save_to_eeprom() {
           console.log('enter save_to_eeprom()');
           MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, save_completed);
           console.log('exit save_to_eeprom()');
       };

        function save_completed() {
            console.log('enter save_completed()');
            GUI.log(i18n.getMessage('configurationEepromSaved'));
            //TABS.vtx.vtxTableSavePending = false;
            const oldText = $("#save_button").text();
            $("#save_button").html(i18n.getMessage('vtxButtonSaved'));

            setTimeout(function() {
                $("#save_button").html(oldText);
            }, 2000);
            TABS.vtx.initialize();
            console.log('exit save_completed()');
        };
        console.log('exit save_vtx()');
    }
}; //TABS.vtx.initialize

///////////// THIS NEEDS FIXING FOR EMUFLIGHT
function dump_html_to_msp() {
    console.log('enter dump_html_to_msp()');
    // General config
    const frequencyEnabled = $("#vtx_frequency_channel").prop('checked');
    console.log('manual freq toggle is: '+frequencyEnabled);
    if (frequencyEnabled) {
        VTX_CONFIG.vtx_frequency = parseInt( $("#vtx_frequency").val() );
        VTX_CONFIG.vtx_band =      parseInt(  ( $("#vtx_frequency").val() / 8 ) + 1 );
        VTX_CONFIG.vtx_channel =   parseInt(  ( $("#vtx_frequency").val() % 8 ) + 1 );
    } else {
        VTX_CONFIG.vtx_band =      parseInt( $("#vtx_band").val() );
        VTX_CONFIG.vtx_channel =   parseInt( $("#vtx_channel").val() );
        VTX_CONFIG.vtx_frequency = 0;
        //if (semver.lt(CONFIG.apiVersion, "1.40.0")) {
        //if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
        //    if (VTX_CONFIG.vtx_band > 0 || VTX_CONFIG.vtx_channel > 0) {
        //        VTX_CONFIG.vtx_frequency = (band - 1) * 8 + (channel - 1);
        //    }
        //}
    }

    VTX_CONFIG.vtx_power = parseInt($("#vtx_power").val());
    VTX_CONFIG.vtx_pit_mode = $("#vtx_pit_mode").prop('checked');
    // VTX_CONFIG.vtx_low_power_disarm = parseInt($("#vtx_low_power_disarm").val());  //no EMUF MSP

    console.log('set VTX_CONFIG b'+VTX_CONFIG.vtx_band+'/c'+VTX_CONFIG.vtx_channel+'/f'+VTX_CONFIG.vtx_frequency+'/p'+VTX_CONFIG.vtx_power+'/m'+VTX_CONFIG.vtx_pit_mode);
    console.log('exit dump_html_to_msp()');
};

TABS.vtx.cleanup = function(callback) {
    console.log('enter TABS.vtx.cleanup()');
    // Add here things that need to be cleaned or closed before leaving the tab
    //GUI.interval_remove(this._DEVICE_STATUS_UPDATE_INTERVAL_NAME);
    if (callback) {
        callback();
    }
    console.log('exit TABS.vtx.cleanup()');
};

TABS.vtx.refresh = function(callback) {
    var self = this;
    GUI.tab_switch_cleanup(function() {
        self.initialize();
        //self.setDirty(false);
        if (callback) {
            callback();
        }
    });
};
