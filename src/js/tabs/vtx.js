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

const vtxTable = [
    [ 5865, 5845, 5825, 5805, 5785, 5765, 5745, 5725 ], // Boscam A
    [ 5733, 5752, 5771, 5790, 5809, 5828, 5847, 5866 ], // Boscam B
    [ 5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945 ], // Boscam E
    [ 5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880 ], // FatShark
    [ 5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917 ], // RaceBand
];

function lookupTableBandChan(band,chan) {
    return parseInt(vtxTable[band][chan]);
};

function lookupTableFreq(freq) {
    for (let i = 0; i < vtxTable.length; i++) {
        for (let j = 0; j < vtxTable[i].length; j++) {
            if (freq == vtxTable[i][j]) {
                return [i+1,j+1];
            }
        }
    }
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
    this.supported = semver.gte(CONFIG.apiVersion, "1.40.0"); //since EmuF 0.1.0 (BF 3.3.0)
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
            MSP.send_message(MSPCodes.MSP_VTX_CONFIG, false, false, load_html);
            console.log('exit vtx_config()');
        };
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

        // assign fields from EEPROM
        $("#vtx_frequency").val(VTX_CONFIG.vtx_frequency);
        $("#vtx_band").val(VTX_CONFIG.vtx_band);
        $("#vtx_channel").val(VTX_CONFIG.vtx_channel);
        $("#vtx_power").val(VTX_CONFIG.vtx_power);
        $("#vtx_pit_mode").prop('checked', VTX_CONFIG.vtx_pit_mode);
        $("#vtx_pit_mode_frequency").val(VTX_CONFIG.vtx_pit_mode_frequency);
        //const yesMessage =  i18n.getMessage("yes");
        //const noMessage =  i18n.getMessage("no");
        //$("#vtx_device_ready_description").text(VTX_CONFIG.vtx_device_ready ? yesMessage : noMessage);
        $("#vtx_type_description").text(self.getVtxTypeString()); //keep this one if nothing else

        //REFRESH BUTTON
        $('a.refresh').click(function() {   //this one clicked
            console.log('a.refresh clicked');
            self.refresh(function() {
                GUI.log(i18n.getMessage('VTX tab refreshed'));
            });
            console.log('exit refresh clicked');
        });

        // SAVE BUTTON
        console.log('setup save clickable');
        $('a.save').click(function() {
            console.log('save clicked');
            if (!self.updating) {
                console.log('call save_vtx()');
                save_vtx();
            }
        });

    //////////// cut vtx tables

    // Actions and other
    function frequencyOrBandChannel() {
        console.log('enter frequencyOrBandChannel()');
        const frequencyEnabled = $(this).prop('checked');
        if (frequencyEnabled) {
            $(".field.vtx_channel").hide();
            $(".field.vtx_band").hide();
            $(".field.vtx_frequency").show();
        } else {
            $(".field.vtx_channel").show();
            $(".field.vtx_band").show();
            $(".field.vtx_frequency").hide();
        }
        console.log('exit frequencyOrBandChannel()');
    };

    // user freq toggle
    $('input[id="vtx_frequency_channel"]').prop('checked', VTX_CONFIG.vtx_band === 0 && VTX_CONFIG.vtx_frequency > 0).change(frequencyOrBandChannel); // trigger on toggles
    $('input[id="vtx_frequency_channel"]').prop('checked',frequencyOrBandChannel);  //current status on load

    //////////// cut vtx tables

    console.log('exit initDisplay()');
}; // initDisplay


    function populateBandSelect() {
        console.log('enter populateBandSelect()');
        const selectBand = $(".field #vtx_band");
        //selectBand.append(new Option(i18n.getMessage('vtxBand_0'), 0));  //user
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
                    min: 1,
                    max: 3
                };
                break;
            case VtxDeviceTypes.VTXDEV_SMARTAUDIO:
                powerMinMax = {
                    min: 1,
                    max: 4
                };
                break;
            case VtxDeviceTypes.VTXDEV_TRAMP:
                powerMinMax = {
                    min: 1,
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

    // Save all the values to MSP
    function save_vtx() {
        console.log('enter save_vtx()');
        self.updating = true;
        dump_html_to_msp();

        console.log('save_vtx(): type:'+VTX_CONFIG.vtx_type
                    +' band:'+VTX_CONFIG.vtx_band
                    +' chan:'+VTX_CONFIG.vtx_channel
                    +' pwr:'+VTX_CONFIG.vtx_power
                    +' pit:'+VTX_CONFIG.vtx_pit_mode
                    +' freq:'+VTX_CONFIG.vtx_frequency);
        // Start MSP saving
        save_vtx_config();

        function save_vtx_config() {
            console.log('enter save_vtx_config()');
            console.log('save_vtx_config(): type:'+VTX_CONFIG.vtx_type
                    +' band:'+VTX_CONFIG.vtx_band
                    +' chan:'+VTX_CONFIG.vtx_channel
                    +' pwr:'+VTX_CONFIG.vtx_power
                    +' pit:'+VTX_CONFIG.vtx_pit_mode
                    +' freq:'+VTX_CONFIG.vtx_frequency);
            MSP.send_message(MSPCodes.MSP_SET_VTX_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_VTX_CONFIG), false, save_to_eeprom);
            console.log('exit save_vtx_config()');
        };

       function save_to_eeprom() {
           console.log('enter save_to_eeprom()');
           console.log('save_to_eeprom(): type:'+VTX_CONFIG.vtx_type
                    +' band:'+VTX_CONFIG.vtx_band
                    +' chan:'+VTX_CONFIG.vtx_channel
                    +' pwr:'+VTX_CONFIG.vtx_power
                    +' pit:'+VTX_CONFIG.vtx_pit_mode
                    +' freq:'+VTX_CONFIG.vtx_frequency);
           MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, save_completed);  //required to save
           console.log('exit save_to_eeprom()');
       };

        function save_completed() {
            console.log('enter save_completed()');
            console.log('save_completed(): type:'+VTX_CONFIG.vtx_type
                    +' band:'+VTX_CONFIG.vtx_band
                    +' chan:'+VTX_CONFIG.vtx_channel
                    +' pwr:'+VTX_CONFIG.vtx_power
                    +' pit:'+VTX_CONFIG.vtx_pit_mode
                    +' freq:'+VTX_CONFIG.vtx_frequency);
            GUI.log(i18n.getMessage('configurationEepromSaved'));
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
    const frequencyEnabled = $('input[id="vtx_frequency_channel"]').prop('checked');
    console.log('%c manual freq toggle is: '+frequencyEnabled, "color: magenta");
    if (frequencyEnabled) {  //user freq
        VTX_CONFIG.vtx_frequency = parseInt( $("#vtx_frequency").val() );
        //var tupleBandChan = lookupTableFreq(VTX_CONFIG.vtx_frequency);
        //console.log('%c lookupTableFreq('+VTX_CONFIG.vtx_frequency+'): '+tupleBandChan, "color: magenta");
        //VTX_CONFIG.vtx_band =      tupleBandChan[0];
        //VTX_CONFIG.vtx_channel =   tupleBandChan[1];
        VTX_CONFIG.vtx_band = 0; //user
        VTX_CONFIG.vtx_channel = 1;
    } else {  //band/channel
        VTX_CONFIG.vtx_band =      parseInt( $("#vtx_band").val() );
        VTX_CONFIG.vtx_channel =   parseInt( $("#vtx_channel").val() );
        if (semver.gte(CONFIG.apiVersion, "1.40.0")) { //redundant
            if (VTX_CONFIG.vtx_band > 0 || VTX_CONFIG.vtx_channel > 0) {
                VTX_CONFIG.vtx_frequency = (VTX_CONFIG.vtx_band - 1) * 8 + (VTX_CONFIG.vtx_channel - 1);
                console.log('%c special old ass encoded freq: '+VTX_CONFIG.vtx_frequency, "color: magenta");
            }
        } // else some other semver option that does not yet exist

        //VTX_CONFIG.vtx_frequency = lookupTableBandChan(VTX_CONFIG.vtx_band-1,VTX_CONFIG.vtx_channel-1);
        //console.log(`%c lookup vtxTable[${VTX_CONFIG.vtx_band}][${VTX_CONFIG.vtx_channel}]: `+VTX_CONFIG.vtx_frequency, "color: magenta");
    }

    VTX_CONFIG.vtx_power = parseInt($("#vtx_power").val());
    VTX_CONFIG.vtx_pit_mode = $("#vtx_pit_mode").prop('checked');
    // VTX_CONFIG.vtx_low_power_disarm = parseInt($("#vtx_low_power_disarm").val());  //no EMUF MSP

    console.log('dump_html_to_msp(): bnd'+VTX_CONFIG.vtx_band+'/ch'+VTX_CONFIG.vtx_channel+'/frq'+VTX_CONFIG.vtx_frequency+'/lvl'+VTX_CONFIG.vtx_power+'/pm'+VTX_CONFIG.vtx_pit_mode);
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
