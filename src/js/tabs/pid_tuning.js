'use strict';

TABS.pid_tuning = {
    RATE_PROFILE_MASK: 128,
    showAllPids: false,
    updating: true,
    dirty: false,
    currentProfile: null,
    currentRateProfile: null,
    currentRatesType: null,
    SETPOINT_WEIGHT_RANGE_LOW: 2.55,
    SETPOINT_WEIGHT_RANGE_HIGH: 20,
    SETPOINT_WEIGHT_RANGE_LEGACY: 2.54,
    activeSubtab: 'pid'
};

TABS.pid_tuning.initialize = function(callback) {

    var self = this;

    if (GUI.active_tab !== 'pid_tuning') {
        GUI.active_tab = 'pid_tuning';
        self.activeSubtab = 'pid';
    }

    // Update filtering defaults based on API version
    var FILTER_DEFAULT = FC.getFilterDefaults();

    // requesting MSP_STATUS manually because it contains CONFIG.profile
    MSP.promise(MSPCodes.MSP_STATUS).then(function() {
        if (semver.gte(CONFIG.apiVersion, CONFIGURATOR.pidControllerChangeMinApiVersion)) {
            return MSP.promise(MSPCodes.MSP_PID_CONTROLLER);
        }
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_PIDNAMES);
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_PID);
    }).then(function() {
        if (semver.gte(CONFIG.apiVersion, "1.16.0")) {
            return MSP.promise(MSPCodes.MSP_PID_ADVANCED);
        }
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_RC_TUNING);
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_EMUF);
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_FILTER_CONFIG);
    }).then(function() {
        if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
            if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX" && semver.lt(CONFIG.apiVersion, "1.42.0")) {
                return MSP.promise(MSPCodes.MSP_FAST_KALMAN);
            } else {
                return MSP.promise(MSPCodes.MSP_IMUF_CONFIG);
            }
        }
    }).then(function() {
        return MSP.promise(MSPCodes.MSP_RC_DEADBAND);
    }).then(function() {
        MSP.send_message(MSPCodes.MSP_MIXER_CONFIG, false, false, load_html);
    });

    function load_html() {
        $('#content').load("./tabs/pid_tuning.html", process_html);
    }

    var presetJson;

    if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX") {
        if (semver.gte(CONFIG.apiVersion, "1.46.0")) {
            presetJson = require(presetsFolders + "/presets-nonHELIO-v0.3.0.json");
        } else {
            presetJson = require(presetsFolders + "/presets-nonHELIO-v0.2.0.json");
        }

    } else {
        if (semver.gte(CONFIG.apiVersion, "1.46.0")) {
            presetJson = require(presetsFolders + "/presets-HELIO-v0.3.0.json");
        } else {
            presetJson = require(presetsFolders + "/presets-HELIO-v0.2.0.json");
        }
    }

    function pid_and_rc_to_form() {
        self.setProfile();
        if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
            self.setRateProfile();
        }

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0") && isExpertModeEnabled() ) {
            $('.feel').show();
            //debug
            //console.log('Enable FEEL tab');
        } else {
            $('.feel').hide();
            //debug
            //console.log('Disable FEEL tab');
        }
        //end MSP 1.51


        // Fill in the data from PIDs array

        // For each pid name
        PID_names.forEach(function(elementPid, indexPid) {

            // Look into the PID table to a row with the name of the pid
            var searchRow = $('.pid_tuning .' + elementPid + ' input');

            // Assign each value
            searchRow.each(function(indexInput) {
                if (PIDs[indexPid][indexInput] !== undefined) {
                    $(this).val(PIDs[indexPid][indexInput]);
                }
            });
        });

        // Fill in data from RC_tuning object


        $('.pid_tuning input[name="rc_rate"]').val(RC_tuning.RC_RATE.toFixed(2));
        $('.pid_tuning input[name="roll_pitch_rate"]').val(RC_tuning.roll_pitch_rate.toFixed(2));
        $('.pid_tuning input[name="roll_rate"]').val(RC_tuning.roll_rate.toFixed(2));
        $('.pid_tuning input[name="pitch_rate"]').val(RC_tuning.pitch_rate.toFixed(2));
        $('.pid_tuning input[name="yaw_rate"]').val(RC_tuning.yaw_rate.toFixed(2));
        $('.pid_tuning input[name="rc_expo"]').val(RC_tuning.RC_EXPO.toFixed(2));
        $('.pid_tuning input[name="rc_yaw_expo"]').val(RC_tuning.RC_YAW_EXPO.toFixed(2));
        $('.throttle input[name="mid"]').val(RC_tuning.throttle_MID.toFixed(2));
        $('.throttle input[name="expo"]').val(RC_tuning.throttle_EXPO.toFixed(2));
        $('.tpa input[name="tpa_P"]').val(RC_tuning.dynamic_THR_PID_P.toFixed(2));
        $('.tpa input[name="tpa_I"]').val(EMUF_ADVANCED.dynamic_THR_PID_I.toFixed(2));
        $('.tpa input[name="tpa_D"]').val(EMUF_ADVANCED.dynamic_THR_PID_D.toFixed(2));
        $('.tpa input[name="tpa-breakpoint"]').val(RC_tuning.dynamic_THR_breakpoint);
        if (semver.gte(CONFIG.apiVersion, "1.43.0")) {
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                $('.spa input[name="spa_P"]').val(ADVANCED_TUNING.setPointPTransition);
                $('.spa input[name="spa_I"]').val(ADVANCED_TUNING.setPointITransition);
                $('.spa input[name="spa_D"]').val(ADVANCED_TUNING.setPointDTransition);
                $('.spa_roll').hide();
                $('.spa_pitch').hide();
            } else {
                $('.spa').hide();
                $('.spa_roll input[name="spaRoll_P"]').val(ADVANCED_TUNING.setPointPTransitionRoll);
                $('.spa_roll input[name="spaRoll_I"]').val(ADVANCED_TUNING.setPointITransitionRoll);
                $('.spa_roll input[name="spaRoll_D"]').val(ADVANCED_TUNING.setPointDTransitionRoll);
                console.log(ADVANCED_TUNING.setPointPTransitionPitch);
                $('.spa_pitch input[name="spaPitch_P"]').val(ADVANCED_TUNING.setPointPTransitionPitch);
                $('.spa_pitch input[name="spaPitch_I"]').val(ADVANCED_TUNING.setPointITransitionPitch);
                $('.spa_pitch input[name="spaPitch_D"]').val(ADVANCED_TUNING.setPointDTransitionPitch);
            }
            $('.spa_yaw input[name="spaYaw_P"]').val(ADVANCED_TUNING.setPointPTransitionYaw);
            $('.spa_yaw input[name="spaYaw_I"]').val(ADVANCED_TUNING.setPointITransitionYaw);
            $('.spa_yaw input[name="spaYaw_D"]').val(ADVANCED_TUNING.setPointDTransitionYaw);
        } else {
            $('.spa').hide();
            $('.spa_roll').hide();
            $('.spa_pitch').hide();
            $('.spa_yaw').hide();
        }

        if (semver.lt(CONFIG.apiVersion, "1.10.0")) {
            $('.pid_tuning input[name="rc_yaw_expo"]').hide();
            $('.pid_tuning input[name="rc_expo"]').attr("rowspan", "3");
        }

        if (semver.gte(CONFIG.apiVersion, "1.16.0") && semver.lt(CONFIG.apiVersion, "1.46.0")) {
            $('input[id="vbatpidcompensation"]').prop('checked', ADVANCED_TUNING.vbatPidCompensation !== 0);
        }else{
          console.log('vbat');
          $('.vbatpidcompensation').hide();
        }

        if (semver.gte(CONFIG.apiVersion, "1.16.0")) {
            $('.pid_tuning input[name="rc_rate_yaw"]').val(RC_tuning.rcYawRate.toFixed(2));
            if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
                $('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val(FILTER_CONFIG.gyro_lowpass_hz_roll);
                $('.pid_filter input[name="gyroLowpassFrequencyPitch"]').val(FILTER_CONFIG.gyro_lowpass_hz_pitch);
                $('.pid_filter input[name="gyroLowpassFrequencyYaw"]').val(FILTER_CONFIG.gyro_lowpass_hz_yaw);
                $('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val(FILTER_CONFIG.dterm_lowpass_hz_roll);
                $('.pid_filter input[name="dtermLowpassFrequencyPitch"]').val(FILTER_CONFIG.dterm_lowpass_hz_pitch);
                $('.pid_filter input[name="dtermLowpassFrequencyYaw"]').val(FILTER_CONFIG.dterm_lowpass_hz_yaw);
                $('.gyroLowpassFrequency').hide();
                $('.dtermLowpassFrequency').hide();
                $('.yawLowpassFrequency').hide();
                //experimental expert-mode show/hide also in main.js
                if (!isExpertModeEnabled()) {
                    $('.LPFPit').hide();
                    $('.LPFYaw').hide();
                    $('#pid-tuning .gyroLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningGyroLowpassFrequency"));
                    $('#pid-tuning .dtermLowpassFrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningDTermLowpassFrequency"));
                }
            } else {
                $('.gyroLowpassFrequencyAxis').hide();
                $('.dtermLowpassFrequencyAxis').hide();
                $('.pid_filter input[name="gyroLowpassFrequency"]').val(FILTER_CONFIG.gyro_lowpass_hz);
                $('.pid_filter input[name="dtermLowpassFrequency"]').val(FILTER_CONFIG.dterm_lowpass_hz);
                $('.pid_filter input[name="yawLowpassFrequency"]').val(FILTER_CONFIG.yaw_lowpass_hz);
            }
        } else {
            $('.tab-pid_tuning .subtab-filter').hide();
            $('.tab-pid_tuning .tab_container').hide();
            $('.pid_tuning input[name="rc_rate_yaw"]').hide();
        }

        //experimental expert-mode synchronize hidden Pitch/Yaw
        $('.pid_filter input[name="gyroLowpassFrequencyRoll"]').change(function() {
            if (!isExpertModeEnabled()) {
                $('.pid_filter input[name="gyroLowpassFrequencyPitch"]').val(parseInt($('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val()));
                $('.pid_filter input[name="gyroLowpassFrequencyYaw"]').val(parseInt($('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val()));
            }
        });
        $('.pid_filter input[name="dtermLowpassFrequencyRoll"]').change(function() {
            if (!isExpertModeEnabled()) {
                $('.pid_filter input[name="dtermLowpassFrequencyPitch"]').val(parseInt($('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val()));
                $('.pid_filter input[name="dtermLowpassFrequencyYaw"]').val(parseInt($('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val()));
            }
        });

        if (semver.gte(CONFIG.apiVersion, "1.20.0") ||
            semver.gte(CONFIG.apiVersion, "1.16.0") && FEATURE_CONFIG.features.isEnabled('SUPEREXPO_RATES')) {
            $('#pid-tuning .rate').text(i18n.getMessage("pidTuningSuperRate"));
        } else {
            $('#pid-tuning .rate').text(i18n.getMessage("pidTuningRate"));
        }

        if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
            $('.pid_filter input[name="gyroNotch1Frequency"]').val(FILTER_CONFIG.gyro_notch_hz);
            $('.pid_filter input[name="gyroNotch1Cutoff"]').val(FILTER_CONFIG.gyro_notch_cutoff);
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                $('.pid_filter input[name="dTermNotchFrequency"]').val(FILTER_CONFIG.dterm_notch_hz);
                $('.pid_filter input[name="dTermNotchCutoff"]').val(FILTER_CONFIG.dterm_notch_cutoff);
            } else {
                $('.dtermNotch').hide();
            }
            var dtermSetpointTransitionNumberElement = $('input[name="dtermSetpointTransition-number"]');
            if (semver.gte(CONFIG.apiVersion, "1.38.0")) {
                dtermSetpointTransitionNumberElement.attr('min', 0.00);
            } else {
                dtermSetpointTransitionNumberElement.attr('min', 0.01);
            }

            dtermSetpointTransitionNumberElement.val(ADVANCED_TUNING.dtermSetpointTransition / 100);

            if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                $('input[name="dtermBoost-number"]').val(ADVANCED_TUNING.dtermBoost);
            } else {
                $('input[name="dtermSetpoint-number"]').val(ADVANCED_TUNING.dtermSetpointWeight / 100);
          }
        } else {
            $('.pid_filter .newFilter').hide();
        }

        if (semver.gte(CONFIG.apiVersion, "1.21.0")) {
            $('.pid_filter input[name="gyroNotch2Frequency"]').val(FILTER_CONFIG.gyro_notch2_hz);
            $('.pid_filter input[name="gyroNotch2Cutoff"]').val(FILTER_CONFIG.gyro_notch2_cutoff);
        } else {
            $('.pid_filter .gyroNotch2').hide();
        }

        $('.NEWANGLEUI').hide();
        $('.OLDANGLEUI').hide();
        //$('#showAllPids').hide(); //remove the useless button
        if ( semver.gte(CONFIG.apiVersion, "1.24.0") ) {
            $('.pid_tuning input[name="angleLimit"]').val(ADVANCED_TUNING.levelAngleLimit);
            $('.angleLimit').show();
            console.log('show angle limit');
            if ( semver.lte(CONFIG.apiVersion, "1.43.0") ) {
                // angle p.i.d loaded near beginning of function
                $('.OLDANGLEUI').show();
                $('.NEWANGLEUI').hide();
                $('.pid_optional').show();
                console.log('show OLDANGLEUI; hide NEWANGLEUI; show pid_Optional');
            } else { //skip 1.44 & 1.45 not implemented and older angle UI broken
                if ( semver.gte(CONFIG.apiVersion, "1.46.0") ) {
                    $('.pid_tuning input[name="p_angle_high"]').val(ADVANCED_TUNING.p_angle_high);
                    $('.pid_tuning input[name="p_angle_low"]').val(ADVANCED_TUNING.p_angle_low);
                    $('.pid_tuning input[name="d_angle_high"]').val(ADVANCED_TUNING.d_angle_high);
                    $('.pid_tuning input[name="d_angle_low"]').val(ADVANCED_TUNING.d_angle_low);
                    $('.pid_tuning input[name="f_angle"]').val(ADVANCED_TUNING.f_angle);
                    $('.pid_tuning input[name="angle_expo"]').val(ADVANCED_TUNING.angleExpo );
                    $('.pid_tuning input[name="horizon_tilt_effect"]').val(ADVANCED_TUNING.horizonTiltEffect);
                    $('.pid_tuning input[name="horizon_transition"]').val(ADVANCED_TUNING.horizonTransition);
                    $('.OLDANGLEUI').hide();
                    $('.NEWANGLEUI').show();
                    $('.pid_optional').show();
                    //removes 5th column which is Feedforward
                    //$('#pid_main .pid_titlebar2 th').attr('colspan', 4);
                    $('#pid_main').attr('colspan', 4);  //almost certain this line has zero effect
                    $('#pid_main .feedforward').hide();

                    //MSP 1.51
                    if ( semver.gte(CONFIG.apiVersion, "1.51.0") ) {
                        // hide roll/pitch ff, but not yaw
                        $('#pid_main .feedforward').hide();
                        $('#pid_main .DFyaw').show(); //order matters
                    } else {
                        //removes 5th column which is Feedforward
                        //$('#pid_main .pid_titlebar2 th').attr('colspan', 4);
                        $('#pid_main').attr('colspan', 4);
                        $('#pid_main .feedforward').hide();
                        //MSP 1.51
                        $('#pid_main .DFyaw').hide()
                    }
                    //end MSP 1.51

                    console.log('hide OLDANGLEUI; show NEWANGLEUI; show pid_Optional');
                }
            }
        }

        if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
            $('.pid_filter select[name="dtermLowpassType"]').val(FILTER_CONFIG.dterm_lowpass_type);
            $('.antigravity input[name="itermThrottleThreshold"]').val(ADVANCED_TUNING.itermThrottleThreshold);
            $('.antigravity input[name="itermAcceleratorGain"]').val(ADVANCED_TUNING.itermAcceleratorGain / 1000);

            //quick & dirty 0.3.0
            if (FEATURE_CONFIG.features.isEnabled('ANTI_GRAVITY') && semver.lt(CONFIG.flightControllerVersion, "0.3.0")) {
                $('.antigravity').show();
            } else {
                $('.antigravity').hide();
            }
            var antiGravitySwitch = $('#antiGravitySwitch');
            antiGravitySwitch.prop('checked', ADVANCED_TUNING.itermAcceleratorGain !== 1000);
            antiGravitySwitch.change(function() {
                var checked = $(this).is(':checked');
                if (checked) {
                    $('.antigravity input[name="itermAcceleratorGain"]').val(Math.max(ADVANCED_TUNING.itermAcceleratorGain / 1000, 1.1));
                    $('.antigravity .suboption').show();
                    if (ADVANCED_TUNING.antiGravityMode == 0) {
                        $('.antigravity .antiGravityThres').hide();
                    }
                    if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
                        $('.antigravity .antiGravityMode').show();
                    } else {
                        $('.antigravity .antiGravityMode').hide();
                    }
                } else {
                    $('.antigravity select[id="antiGravityMode"]').val(0);
                    $('.antigravity input[name="itermAcceleratorGain"]').val(1);
                    $('.antigravity .suboption').hide();
                }
            });
            antiGravitySwitch.change();
        } else {
            $('.dtermLowpassType').hide();
            $('.antigravity').hide();
        }

        if (semver.gte(CONFIG.apiVersion, "1.37.0")) {
            $('.pid_tuning input[name="rc_rate_pitch"]').val(RC_tuning.rcPitchRate.toFixed(2));
            $('.pid_tuning input[name="rc_pitch_expo"]').val(RC_tuning.RC_PITCH_EXPO.toFixed(2));
        }

        // MSP 1.51
        // this block needs to be below all of the prior rc rates items in order for it to work properly
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            $('select[name="rcRatesTypeSelect"]').val(RC_tuning.rates_type);
            console.log('initial call to changeRatesType with RC_tuning.rates_type: '+RC_tuning.rates_type);
            self.changeRatesType(RC_tuning.rates_type); // update rate type code when updating the tab
        } else {
            $('#rates_type').hide();
            $('.rates_type').hide();
        }
        // end MSP 1.51

        if (semver.gte(CONFIG.apiVersion, "1.39.0")) {
            $('.pid_filter select[name="gyroLowpassType"]').val(FILTER_CONFIG.gyro_lowpass_type);
            $('.pid_filter select[name="gyroLowpass2Type"]').val(FILTER_CONFIG.gyro_lowpass2_type);
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                $('.pid_filter input[name="gyroLowpass2Frequency"]').val(FILTER_CONFIG.gyro_lowpass2_hz);
                $('.pid_filter input[name="dtermLowpass2Frequency"]').val(FILTER_CONFIG.dterm_lowpass2_hz);

                //workaround for pre-relese 0.2.22RC2 and dev builds
                if (semver.eq(CONFIG.apiVersion, "1.43.0") && !semver.eq(CONFIG.flightControllerVersion, "0.2.22")) {
                    $('.pid_filter input[name="dtermDynLpf"]').val(FILTER_CONFIG.dterm_dyn_lpf);
                    $('.pid_filter .gyroDynGroup').hide();
                    if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX") {
                        $('.pid_filter input[name="gyroDynLpf"]').val(FILTER_CONFIG.gyro_dyn_lpf);
                        $('.pid_filter .gyroDynGroup').show();
                    }
                } else {
                    $('.pid_filter .gyroDynGroup').hide();
                    $('.pid_filter .dyndtermlpf').hide();
                }

                // We load it again because the limits are now bigger than in 1.16.0
                $('.pid_filter input[name="gyroLowpassFrequency"]').attr("max", "16000");
                $('.pid_filter input[name="gyroLowpassFrequency"]').val(FILTER_CONFIG.gyro_lowpass_hz);
                $('.dtermLowpass2FrequencyAxis').hide();
                $('.gyroLowpass2FrequencyAxis').hide();
            } else {   //gte 1.44  - perAxis LPF
                $('.gyroLowpass2Frequency').hide();
                $('.dtermLowpass2Frequency').hide();
                $('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val(FILTER_CONFIG.gyro_lowpass2_hz_roll);
                $('.pid_filter input[name="gyroLowpass2FrequencyPitch"]').val(FILTER_CONFIG.gyro_lowpass2_hz_pitch);
                $('.pid_filter input[name="gyroLowpass2FrequencyYaw"]').val(FILTER_CONFIG.gyro_lowpass2_hz_yaw);
                console.log('dterm_lowpass2_hz_roll' + FILTER_CONFIG.dterm_lowpass2_hz_roll);
                $('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val(FILTER_CONFIG.dterm_lowpass2_hz_roll);
                $('.pid_filter input[name="dtermLowpass2FrequencyPitch"]').val(FILTER_CONFIG.dterm_lowpass2_hz_pitch);
                $('.pid_filter input[name="dtermLowpass2FrequencyYaw"]').val(FILTER_CONFIG.dterm_lowpass2_hz_yaw);
                //experimental expert-mode show/hid also in main.js
                if (!isExpertModeEnabled()) {
                    $('.LPFPit').hide();
                    $('.LPFYaw').hide();
                    $('#pid-tuning .gyroLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningGyroLowpass2Frequency"));
                    $('#pid-tuning .dtermLowpass2FrequencyAxis .LPFRol').text(i18n.getMessage("pidTuningDTermLowpass2Frequency"));
                }
            }
            //removes 5th column which is Feedforward
            $('#pid_main .pid_titlebar2 th').attr('colspan', 4);
        } else {
            $('.gyroLowpass2').hide();
            $('.gyroLowpass2Type').hide();
            $('.dtermLowpass2').hide();
            $('#pid_main .pid_titlebar2 th').attr('colspan', 4);
        }

        //experimental expert-mode synchronize hidden Pitch/Yaw
        $('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').change(function() {
            if (!isExpertModeEnabled()) {
                $('.pid_filter input[name="gyroLowpass2FrequencyPitch"]').val(parseInt($('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val()));
                $('.pid_filter input[name="gyroLowpass2FrequencyYaw"]').val(parseInt($('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val()));
            }
        });
        $('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').change(function() {
            if (!isExpertModeEnabled()) {
                $('.pid_filter input[name="dtermLowpass2FrequencyPitch"]').val(parseInt($('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val()));
                $('.pid_filter input[name="dtermLowpass2FrequencyYaw"]').val(parseInt($('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val()));
            }
        });

        if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
            //sharpness allows off 0 in msp 1.49
            //MSP 1.51 adjustment //semver.lt
            if (semver.gte(CONFIG.apiVersion, "1.49.0") && semver.lt(CONFIG.apiVersion, "1.51.0")) {
                 $('.pid_filter input[name="imuf_sharpness"]').attr("min", "0");
            }

            if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX" && semver.lt(CONFIG.apiVersion, "1.42.0")) {
                $('.kalmanFilterSettingsPanel').show();
                $('.pid_filter input[name="kalmanQCoefficient"]').val(KALMAN_FILTER_CONFIG.gyro_filter_q);
                $('.pid_filter input[name="kalmanRCoefficient"]').val(KALMAN_FILTER_CONFIG.gyro_filter_w);
                $('#imufFilterSettingsPanel').hide();
            } else {
                $('#imuf_roll_q').val(IMUF_FILTER_CONFIG.imuf_roll_q);
                $('#imuf_pitch_q').val(IMUF_FILTER_CONFIG.imuf_pitch_q);
                $('#imuf_yaw_q').val(IMUF_FILTER_CONFIG.imuf_yaw_q);
                //experimental expert-mode show/hide also in main.js
                if (!isExpertModeEnabled()) {
                    $('.IMUFQroll').show();
                    $('.IMUFQpitch').hide();
                    $('.IMUFQyaw').hide();
                    $('#pid-tuning .IMUFQroll').text(i18n.getMessage("pidTuningImufQ"));
                } //end expert-mode
                $('#imuf_w').val(IMUF_FILTER_CONFIG.imuf_w);
                $('.imufSharpness').hide();
                //MSP 1.51 adjustment  //semver.lt
                if (semver.gte(CONFIG.apiVersion, "1.46.0") && semver.lt(CONFIG.apiVersion, "1.51.0")){
                    $('.imufSharpness').show();
                    console.log('sharpness' + IMUF_FILTER_CONFIG.imuf_sharpness);
                    $('#imuf_sharpness').val(IMUF_FILTER_CONFIG.imuf_sharpness);
                }
                if (CONFIG.boardIdentifier === "HESP" || CONFIG.boardIdentifier === "SX10" || CONFIG.boardIdentifier === "FLUX") {
                    $('#imuf_roll_lpf_cutoff_hz').val(IMUF_FILTER_CONFIG.imuf_roll_lpf_cutoff_hz);
                    $('#imuf_pitch_lpf_cutoff_hz').val(IMUF_FILTER_CONFIG.imuf_pitch_lpf_cutoff_hz);
                    $('#imuf_yaw_lpf_cutoff_hz').val(IMUF_FILTER_CONFIG.imuf_yaw_lpf_cutoff_hz);
                    //experimental expert-mode show/hide also in main.js
                    if (!isExpertModeEnabled()) {
                        $('.IMUFLPFroll').show();
                        $('.IMUFLPFpitch').hide();
                        $('.IMUFLPFyaw').hide();
                        $('#pid-tuning .IMUFLPFroll').text(i18n.getMessage("pidTuningImuflpf"));
                    } //end expert-mode
                    if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                        $('#imuf_acc_lpf_cutoff_hz').val(IMUF_FILTER_CONFIG.imuf_acc_lpf_cutoff_hz);
                    } else {
                        $('.imuf_acc_lpf_cutoff_hz_tr').hide();
                    }
                } else {
                    $('.imuf_roll_lpf_cutoff_hz_tr').hide();
                    $('.imuf_pitch_lpf_cutoff_hz_tr').hide();
                    $('.imuf_yaw_lpf_cutoff_hz_tr').hide();
                    $('.imuf_acc_lpf_cutoff_hz_tr').hide();
                    $('.IMUFLPF').hide();
                    $('.IMUFLPFroll').hide();
                    $('.IMUFLPFpitch').hide();
                    $('.IMUFLPFyaw').hide();
                    console.log("PIDTAB: non-Helio hide IMUF LPF");

                }
                //Only show HELIO SPRING compatible settings
                $('.kalmanFilterSettingsPanel').hide();
                $('#filterTuningHelp').hide();
                $('#imufFilterSettingsPanel').show();
            }

            //experimental expert-mode synchronize hidden Pitch/Yaw
            $('.pid_filter input[name="imuf_roll_q"]').change(function() {
                if (!isExpertModeEnabled()) {
                    $('.pid_filter input[name="imuf_pitch_q"]').val(parseInt($('.pid_filter input[name="imuf_roll_q"]').val()));
                    $('.pid_filter input[name="imuf_yaw_q"]').val(parseInt($('.pid_filter input[name="imuf_roll_q"]').val()));
                }
            });

              //experimental expert-mode synchronize hidden Pitch/Yaw
              $('.pid_filter input[name="imuf_roll_lpf_cutoff_hz"]').change(function() {
                  if (!isExpertModeEnabled()) {
                      $('.pid_filter input[name="imuf_pitch_lpf_cutoff_hz"]').val(parseInt($('.pid_filter input[name="imuf_roll_lpf_cutoff_hz"]').val()));
                      $('.pid_filter input[name="imuf_yaw_lpf_cutoff_hz"]').val(parseInt($('.pid_filter input[name="imuf_roll_lpf_cutoff_hz"]').val()));
                  }
              });

            // Feathered PIDs
            if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                $('#featheredPidsLine').hide();
                $('#featheredPidsLineNumber').show();
                $('input[name="featheredPids-number"]').val(ADVANCED_TUNING.feathered_pids);
            } else {
                $('input[id="feathered_pids"]').prop('checked', ADVANCED_TUNING.feathered_pids !== 0);
            }

            // MSP 1.51
            if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
                //emuGravity
                $('input[name="emuGravity-number"]').val(ADVANCED_TUNING.emuGravityGain);
                $('#emuGravity').show();
                //df_yaw
                $('input[name="DFyaw-number"]').val(ADVANCED_TUNING.directFF_yaw);
                $('#DFyaw').show();
                //axis-lock
                $('input[name="axisLockHz-number"]').val(ADVANCED_TUNING.axis_lock_hz )
                $('input[name="axisLockMultiplier-number"]').val(ADVANCED_TUNING.axis_lock_multiplier)
                $('#axisLockMultiplier').show();
                $('#axisLockHz').show();
            } else {
                $('#emuGravity').hide();
                $('#DFyaw').hide();
                $('#axisLockMultiplier').hide();
                $('#axisLockHz').hide();
            }
            //end MSP 1.51

            // nfe racer mode
            if (semver.gte(CONFIG.apiVersion, "1.43.0") && semver.lt(CONFIG.flightControllerVersion, "0.3.3") ) {
                $('input[id="nferacermode"]').prop('checked', ADVANCED_TUNING.nfe_racermode !== 0);
            } else {
                $('.nferacermode').hide();
            }

            // I Term Rotation
            $('input[id="itermrotation"]').prop('checked', ADVANCED_TUNING.itermRotation !== 0);

            // Smart Feed Forward
            if (semver.lt(CONFIG.apiVersion, "1.43.0")) {
                $('input[id="smartfeedforward"]').prop('checked', ADVANCED_TUNING.smartFeedforward !== 0);
            } else {
                $('.smartfeedforward').hide();
            }

            //iTermRelax V2 //read
            if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                $('#iRelaxV2').show();
                $('#iRelaxYawV2').show();
                $('input[name="iRelax-number"]').val(ADVANCED_TUNING.iterm_relax_cutoff);
                $('input[name="iRelaxYaw-number"]').val(ADVANCED_TUNING.iterm_relax_cutoff_yaw);

            } else {
                $('#iRelaxV2').hide();
                $('#iRelaxYawV2').hide();
            }

            // I Term Relax (V1)
            var itermRelaxCheck = $('input[id="itermrelax"]');

            itermRelaxCheck.prop('checked', ADVANCED_TUNING.itermRelax !== 0);
            $('select[id="itermrelaxAxes"]').val(ADVANCED_TUNING.itermRelax > 0 ? ADVANCED_TUNING.itermRelax : 1);
            $('select[id="itermrelaxType"]').val(ADVANCED_TUNING.itermRelaxType);
            $('input[name="itermRelaxCutoff"]').val(ADVANCED_TUNING.itermRelaxCutoff);

            itermRelaxCheck.change(function() {
                var checked = $(this).is(':checked');

                if (checked) {
                    $('.itermrelax .suboption').show();
                } else {
                    $('.itermrelax .suboption').hide();
                }
            });
            itermRelaxCheck.change();

            // Absolute Control
            var absoluteControlGainNumberElement = $('input[name="absoluteControlGain-number"]');
            absoluteControlGainNumberElement.val(ADVANCED_TUNING.absoluteControlGain).trigger('input');

            // iDecay Control
            var iDecayNumberElement = $('input[name="iDecay-number"]');
            iDecayNumberElement.val(ADVANCED_TUNING.iDecay).trigger('input');

            // errorBoost Control
            var errorBoostNumberElement = $('input[name="errorBoost-number"]');
            errorBoostNumberElement.val(ADVANCED_TUNING.errorBoost).trigger('input');

            // errorBoost Limit Control
            var errorBoostLimitNumberElement = $('input[name="errorBoostLimit-number"]');
            errorBoostLimitNumberElement.val(ADVANCED_TUNING.errorBoostLimit).trigger('input');

            if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                // errorBoost Control
                var errorBoostYawNumberElement = $('input[name="errorBoostYaw-number"]');
                errorBoostYawNumberElement.val(ADVANCED_TUNING.errorBoostYaw).trigger('input');

                // errorBoost Limit Control
                var errorBoostLimitYawNumberElement = $('input[name="errorBoostLimitYaw-number"]');
                errorBoostLimitYawNumberElement.val(ADVANCED_TUNING.errorBoostLimitYaw).trigger('input');
            } else {
                $('.errorBoostYaw').hide();
                $('.errorBoostLimitYaw').hide();
            }

            //dBoost //read
            if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                $('input[name="dtermBoost-number"]').val(ADVANCED_TUNING.dtermBoost);
                $('input[name="dtermBoostLimit-number"]').val(ADVANCED_TUNING.dtermBoostLimit);

                $('#dtermBoost').show();
                $('#dtermBoostLimit').show();

            } else {
                $('#dtermBoost').hide();
                $('#dtermBoostLimit').hide();
            }

            // Throttle Boost
            var throttleBoostNumberElement = $('input[name="throttleBoost-number"]');
            throttleBoostNumberElement.val(ADVANCED_TUNING.throttleBoost).trigger('input');

            // Acro Trainer
             if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                 var acroTrainerAngleLimitNumberElement = $('input[name="acroTrainerAngleLimit-number"]');
                 acroTrainerAngleLimitNumberElement.val(ADVANCED_TUNING.acroTrainerAngleLimit).trigger('input');
             } else {
                 $('.acroTrainerAngleLimit').hide();
             }

            // Yaw D
            $('.pid_tuning .YAW input[name="d"]').val(PIDs[2][2]); // PID Yaw D

            // Feedforward
            if (semver.lt(CONFIG.apiVersion, "1.46.0")) {
                $('.pid_tuning .ROLL input[name="f"]').val(ADVANCED_TUNING.feedforwardRoll);
                $('.pid_tuning .PITCH input[name="f"]').val(ADVANCED_TUNING.feedforwardPitch);
                $('.pid_tuning .YAW input[name="f"]').val(ADVANCED_TUNING.feedforwardYaw);
                var feedforwardTransitionNumberElement = $('input[name="feedforwardTransition-number"]');
                feedforwardTransitionNumberElement.val(ADVANCED_TUNING.feedforwardTransition / 100);
                //adds 5th column which is Feedforward
                $('#pid_main').attr('colspan', 5);
                $('#pid_main .feedforward').show();
                $('.feedforwardTransition').show();
            } else {
                //removes 5th column which is Feedforward
                $('#pid_main').attr('colspan', 4);
                $('#pid_main .feedforward').hide();
                $('.feedforwardTransition').hide();
            }
            if (semver.gte(CONFIG.apiVersion, "1.46.0")) {

                //rateSensCenter
                var rateSensCenterNumberElement = $('input[name="rateSensCenter-number"]');
                var rateSensCenterRangeElement = $('input[name="rateSensCenter-range"]');

                //Use 'input' event for coupled controls to allow synchronized update
                rateSensCenterNumberElement.on('input', function () {
                    rateSensCenterRangeElement.val($(this).val());
                });
                rateSensCenterRangeElement.on('input', function () {
                    rateSensCenterNumberElement.val($(this).val());
                });
                rateSensCenterNumberElement.val(RC_tuning.rateSensCenter).trigger('input');

                //rateSensEnd
                var rateSensEndNumberElement = $('input[name="rateSensEnd-number"]');
                var rateSensEndRangeElement = $('input[name="rateSensEnd-range"]');

                //Use 'input' event for coupled controls to allow synchronized update
                rateSensEndNumberElement.on('input', function () {
                    rateSensEndRangeElement.val($(this).val());
                });
                rateSensEndRangeElement.on('input', function () {
                    rateSensEndNumberElement.val($(this).val());
                });
                rateSensEndNumberElement.val(RC_tuning.rateSensEnd).trigger('input');

                //rateCorrectionCenter
                var rateCorrectionCenterNumberElement = $('input[name="rateCorrectionCenter-number"]');
                var rateCorrectionCenterRangeElement = $('input[name="rateCorrectionCenter-range"]');

                //Use 'input' event for coupled controls to allow synchronized update
                rateCorrectionCenterNumberElement.on('input', function () {
                    rateCorrectionCenterRangeElement.val($(this).val());
                });
                rateCorrectionCenterRangeElement.on('input', function () {
                    rateCorrectionCenterNumberElement.val($(this).val());
                });
                rateCorrectionCenterNumberElement.val(RC_tuning.rateCorrectionCenter).trigger('input');

                //rateCorrectionEnd
                var rateCorrectionEndNumberElement = $('input[name="rateCorrectionEnd-number"]');
                var rateCorrectionEndRangeElement = $('input[name="rateCorrectionEnd-range"]');

                //Use 'input' event for coupled controls to allow synchronized update
                rateCorrectionEndNumberElement.on('input', function () {
                    rateCorrectionEndRangeElement.val($(this).val());
                });
                rateCorrectionEndRangeElement.on('input', function () {
                    rateCorrectionEndNumberElement.val($(this).val());
                });
                rateCorrectionEndNumberElement.val(RC_tuning.rateCorrectionEnd).trigger('input');

                //rateWeightCenter
                var rateWeightCenterNumberElement = $('input[name="rateWeightCenter-number"]');
                var rateWeightCenterRangeElement = $('input[name="rateWeightCenter-range"]');

                //Use 'input' event for coupled controls to allow synchronized update
                rateWeightCenterNumberElement.on('input', function () {
                    rateWeightCenterRangeElement.val($(this).val());
                });
                rateWeightCenterRangeElement.on('input', function () {
                    rateWeightCenterNumberElement.val($(this).val());
                });
                rateWeightCenterNumberElement.val(RC_tuning.rateWeightCenter).trigger('input');

                 //rateWeightEnd
                 var rateWeightEndNumberElement = $('input[name="rateWeightEnd-number"]');
                 var rateWeightEndRangeElement = $('input[name="rateWeightEnd-range"]');

                 //Use 'input' event for coupled controls to allow synchronized update
                 rateWeightEndNumberElement.on('input', function () {
                     rateWeightEndRangeElement.val($(this).val());
                 });
                 rateWeightEndRangeElement.on('input', function () {
                     rateWeightEndNumberElement.val($(this).val());
                 });
                 rateWeightEndNumberElement.val(RC_tuning.rateWeightEnd).trigger('input');
            }
            if (FEATURE_CONFIG.features.isEnabled('DYNAMIC_FILTER') && (semver.gte(CONFIG.apiVersion, "1.47.0"))) {
                $('.matrixFilter').show();
                $('.pid_filter input[name="MatrixNotchQ"]').val(FILTER_CONFIG.dynamic_gyro_notch_q);
                $('.pid_filter input[name="MatrixNotchMin"]').val(FILTER_CONFIG.dynamic_gyro_notch_min_hz);
            } else {
                $('.matrixFilter').hide();
            }
            var feedforwardTransitionNumberElement = $('input[name="feedforwardTransition-number"]');
            feedforwardTransitionNumberElement.val(ADVANCED_TUNING.feedforwardTransition / 100);

            // AntiGravity Mode
            var antiGravityModeSelect = $('.antigravity select[id="antiGravityMode"]');
            antiGravityModeSelect.change(function() {
                var antiGravityModeValue = $('.antigravity select[id="antiGravityMode"]').val();

                // Smooth
                if (antiGravityModeValue == 0) {
                    $('.antiGravityThres').hide();
                } else {
                    $('.antiGravityThres').show();
                }
            });

            antiGravityModeSelect.val(ADVANCED_TUNING.antiGravityMode).change();

        } else {
            $('.feathered_pids').hide();
            $('.itermrotation').hide();
            $('.smartfeedforward').hide();
            $('.itermrelax').hide();
            $('.absoluteControlGain').hide();
            $('.iDecay').hide();
            $('.errorBoost').hide();
            $('.errorBoostLimit').hide();
            $('.errorBoostYaw').hide();
            $('.errorBoostLimitYaw').hide();
            $('.throttleBoost').hide();
            $('.acroTrainerAngleLimit').hide();

            $('.pid_tuning .YAW input[name="d"]').hide();

            // Feedforward column
            $('#pid_main tr :nth-child(6)').hide();

            $('#pid-tuning .feedforwardTransition').hide();
        }


        //quick & dirty 0.3.0
        if (semver.gte(CONFIG.flightControllerVersion, "0.3.0")) {
            $('.absoluteControlGain').hide();
            $('.itermrelax').hide();
        }

        //smart_dterm_smoothing, witchcraft_, table //first build with legit MSP144 is 0.2.35
        //MSP 1.51 adjustment // semver.lt
        if ( semver.gte(CONFIG.apiVersion, "1.44.0") && semver.gte(CONFIG.flightControllerVersion, "0.2.35") && semver.lt(CONFIG.apiVersion, "1.51.0")) {
            $('.smartDTermWitchBox input[name="smartdTermRoll"]').val(FILTER_CONFIG.smartSmoothing_roll);
            $('.smartDTermWitchBox input[name="smartdTermPitch"]').val(FILTER_CONFIG.smartSmoothing_pitch);
            $('.smartDTermWitchBox input[name="smartdTermYaw"]').val(FILTER_CONFIG.smartSmoothing_yaw);

            $('.smartDTermWitchBox input[name="witchcraftRoll"]').val(FILTER_CONFIG.witchcraft_roll);
            $('.smartDTermWitchBox input[name="witchcraftPitch"]').val(FILTER_CONFIG.witchcraft_pitch);
            $('.smartDTermWitchBox input[name="witchcraftYaw"]').val(FILTER_CONFIG.witchcraft_yaw);
        } else {
            $('.smartDTermWitchBox').hide();
        }


        if (semver.gte(CONFIG.apiVersion, "1.41.0")) {
            $('select[id="throttleLimitType"]').val(RC_tuning.throttle_limit_type);
            $('.throttle_limit input[name="throttleLimitPercent"]').val(RC_tuning.throttle_limit_percent);
        } else {
            $('.throttle_limit').hide();
        }

        $('input[id="gyroNotch1Enabled"]').change(function() {
            var checked = $(this).is(':checked');
            var hz = FILTER_CONFIG.gyro_notch_hz > 0 ? FILTER_CONFIG.gyro_notch_hz : FILTER_DEFAULT.gyro_notch_hz;

            $('.pid_filter input[name="gyroNotch1Frequency"]').val(checked ? hz : 0).attr('disabled', !checked)
                .attr("min", checked ? 1 : 0).change();
            $('.pid_filter input[name="gyroNotch1Cutoff"]').attr('disabled', !checked).change();
        });

        $('input[id="gyroNotch2Enabled"]').change(function() {
            var checked = $(this).is(':checked');
            var hz = FILTER_CONFIG.gyro_notch2_hz > 0 ? FILTER_CONFIG.gyro_notch2_hz : FILTER_DEFAULT.gyro_notch2_hz;

            $('.pid_filter input[name="gyroNotch2Frequency"]').val(checked ? hz : 0).attr('disabled', !checked)
                .attr("min", checked ? 1 : 0).change();
            $('.pid_filter input[name="gyroNotch2Cutoff"]').attr('disabled', !checked).change();
        });


        $('input[id="dTermNotchEnabled"]').change(function() {
            var checked = $(this).is(':checked');
            var hz = FILTER_CONFIG.dterm_notch_hz > 0 ? FILTER_CONFIG.dterm_notch_hz : FILTER_DEFAULT.dterm_notch_hz;

            $('.pid_filter input[name="dTermNotchFrequency"]').val(checked ? hz : 0).attr('disabled', !checked)
                .attr("min", checked ? 1 : 0).change();
            $('.pid_filter input[name="dTermNotchCutoff"]').attr('disabled', !checked).change();
        });

        $('input[id="gyroLowpassEnabled"]').change(function() {
            var checked = $(this).is(':checked');

            var cutoff = FILTER_CONFIG.gyro_lowpass_hz > 0 ? FILTER_CONFIG.gyro_lowpass_hz : FILTER_DEFAULT.gyro_lowpass_hz;
            var cutoffRoll = FILTER_CONFIG.gyro_lowpass_hz_roll > 0 ? FILTER_CONFIG.gyro_lowpass_hz_roll : FILTER_DEFAULT.gyro_lowpass_hz;
            var cutoffPitch = FILTER_CONFIG.gyro_lowpass_hz_pitch > 0 ? FILTER_CONFIG.gyro_lowpass_hz_pitch : FILTER_DEFAULT.gyro_lowpass_hz;
            var cutoffYaw = FILTER_CONFIG.gyro_lowpass_hz_yaw > 0 ? FILTER_CONFIG.gyro_lowpass_hz_yaw : FILTER_DEFAULT.gyro_lowpass_hz;

            var type = (FILTER_CONFIG.gyro_lowpass_hz > 0 || FILTER_CONFIG.gyro_lowpass_hz_roll > 0) ? FILTER_CONFIG.gyro_lowpass_type : FILTER_DEFAULT.gyro_lowpass_type;

            if(!isExpertModeEnabled() && (semver.gte(CONFIG.apiVersion, "1.45.0"))) {
                $('.pid_filter input[name="gyroLowpassFrequency"]').val((checked) ? cutoffRoll : 0).attr('disabled', !checked);
            }else{
                $('.pid_filter input[name="gyroLowpassFrequency"]').val((checked) ? cutoff : 0).attr('disabled', !checked);
            }
            $('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val((checked) ? cutoffRoll : 0).attr('disabled', !checked);
            $('.pid_filter input[name="gyroLowpassFrequencyPitch"]').val((checked) ? cutoffPitch : 0).attr('disabled', !checked);
            $('.pid_filter input[name="gyroLowpassFrequencyYaw"]').val((checked) ? cutoffYaw : 0).attr('disabled', !checked);
            $('.pid_filter select[name="gyroLowpassType"]').val(type).attr('disabled', !checked);

            self.updateFilterWarning();
        });


        $('input[id="gyroLowpass2Enabled"]').change(function() {
            var checked = $(this).is(':checked');
            var cutoff = FILTER_CONFIG.gyro_lowpass2_hz > 0 ? FILTER_CONFIG.gyro_lowpass2_hz : FILTER_DEFAULT.gyro_lowpass2_hz;
            var cutoffRoll = FILTER_CONFIG.gyro_lowpass2_hz_roll > 0 ? FILTER_CONFIG.gyro_lowpass2_hz_roll : FILTER_DEFAULT.gyro_lowpass2_hz;
            var cutoffPitch = FILTER_CONFIG.gyro_lowpass2_hz_pitch > 0 ? FILTER_CONFIG.gyro_lowpass2_hz_pitch : FILTER_DEFAULT.gyro_lowpass2_hz;
            var cutoffYaw = FILTER_CONFIG.gyro_lowpass2_hz_yaw > 0 ? FILTER_CONFIG.gyro_lowpass2_hz_yaw : FILTER_DEFAULT.gyro_lowpass2_hz;
            var type = (FILTER_CONFIG.gyro_lowpass2_hz > 0 || FILTER_CONFIG.gyro_lowpass2_hz_roll > 0) ? FILTER_CONFIG.gyro_lowpass2_type : FILTER_DEFAULT.gyro_lowpass2_type;

            if(!isExpertModeEnabled() &&  (semver.gte(CONFIG.apiVersion, "1.45.0"))) {
                $('.pid_filter input[name="gyroLowpass2Frequency"]').val(checked ? cutoffRoll : 0).attr('disabled', !checked);
            }else{
                $('.pid_filter input[name="gyroLowpass2Frequency"]').val(checked ? cutoff : 0).attr('disabled', !checked);
            }
            $('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val(checked ? cutoffRoll : 0).attr('disabled', !checked);
            $('.pid_filter input[name="gyroLowpass2FrequencyPitch"]').val(checked ? cutoffPitch : 0).attr('disabled', !checked);
            $('.pid_filter input[name="gyroLowpass2FrequencyYaw"]').val(checked ? cutoffYaw : 0).attr('disabled', !checked);
            $('.pid_filter select[name="gyroLowpass2Type"]').val(type).attr('disabled', !checked);
        });

        $('input[id="dtermLowpassEnabled"]').change(function() {
            var checked = $(this).is(':checked');

            var cutoff = FILTER_CONFIG.dterm_lowpass_hz > 0 ? FILTER_CONFIG.dterm_lowpass_hz : FILTER_DEFAULT.dterm_lowpass_hz;
            var cutoffRoll = FILTER_CONFIG.dterm_lowpass_hz_roll > 0 ? FILTER_CONFIG.dterm_lowpass_hz_roll : FILTER_DEFAULT.dterm_lowpass_hz;
            var cutoffPitch = FILTER_CONFIG.dterm_lowpass_hz_pitch > 0 ? FILTER_CONFIG.dterm_lowpass_hz_pitch : FILTER_DEFAULT.dterm_lowpass_hz;
            var cutoffYaw = FILTER_CONFIG.dterm_lowpass_hz_yaw > 0 ? FILTER_CONFIG.dterm_lowpass_hz_yaw : FILTER_DEFAULT.dterm_lowpass_hz;
            var type = (FILTER_CONFIG.dterm_lowpass_hz > 0 || FILTER_CONFIG.dterm_lowpass_hz_roll > 0) ? FILTER_CONFIG.dterm_lowpass_type : FILTER_DEFAULT.dterm_lowpass_type;

            if(!isExpertModeEnabled() &&  (semver.gte(CONFIG.apiVersion, "1.45.0"))) {
                $('.pid_filter input[name="dtermLowpassFrequency"]').val((checked) ? cutoffRoll : 0).attr('disabled', !checked);
            }else{
                $('.pid_filter input[name="dtermLowpassFrequency"]').val((checked) ? cutoff : 0).attr('disabled', !checked);
            }
            $('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val((checked) ? cutoffRoll : 0).attr('disabled', !checked);
            $('.pid_filter input[name="dtermLowpassFrequencyPitch"]').val((checked) ? cutoffPitch : 0).attr('disabled', !checked);
            $('.pid_filter input[name="dtermLowpassFrequencyYaw"]').val((checked) ? cutoffYaw : 0).attr('disabled', !checked);
            $('.pid_filter select[name="dtermLowpassType"]').val(type).attr('disabled', !checked);

            self.updateFilterWarning();
        });

        $('input[id="dtermLowpass2Enabled"]').change(function() {
            var checked = $(this).is(':checked');
            var cutoff = FILTER_CONFIG.dterm_lowpass2_hz > 0 ? FILTER_CONFIG.dterm_lowpass2_hz : FILTER_DEFAULT.dterm_lowpass2_hz;
            console.log('check valeuir' + FILTER_CONFIG.dterm_lowpass2_hz_roll);
            var cutoffRoll = FILTER_CONFIG.dterm_lowpass2_hz_roll > 0 ? FILTER_CONFIG.dterm_lowpass2_hz_roll : FILTER_DEFAULT.dterm_lowpass2_hz;
            var cutoffPitch = FILTER_CONFIG.dterm_lowpass2_hz_pitch > 0 ? FILTER_CONFIG.dterm_lowpass2_hz_pitch : FILTER_DEFAULT.dterm_lowpass2_hz;
            var cutoffYaw = FILTER_CONFIG.dterm_lowpass2_hz_yaw > 0 ? FILTER_CONFIG.dterm_lowpass2_hz_yaw : FILTER_DEFAULT.dterm_lowpass2_hz;

            if(!isExpertModeEnabled() &&  (semver.gte(CONFIG.apiVersion, "1.45.0"))) {
                $('.pid_filter input[name="dtermLowpass2Frequency"]').val(checked ? cutoffRoll : 0).attr('disabled', !checked);
            }else{
                $('.pid_filter input[name="dtermLowpass2Frequency"]').val(checked ? cutoff : 0).attr('disabled', !checked);
            }

            $('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val(checked ? cutoffRoll : 0).attr('disabled', !checked);
            $('.pid_filter input[name="dtermLowpass2FrequencyPitch"]').val(checked ? cutoffPitch : 0).attr('disabled', !checked);
            $('.pid_filter input[name="dtermLowpass2FrequencyYaw"]').val(checked ? cutoffYaw : 0).attr('disabled', !checked);
        });

        if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
            $('input[id="yawLowpassEnabled"]').change(function() {
                var checked = $(this).is(':checked');
                var cutoff = FILTER_CONFIG.yaw_lowpass_hz > 0 ? FILTER_CONFIG.yaw_lowpass_hz : FILTER_DEFAULT.yaw_lowpass_hz;

                $('.pid_filter input[name="yawLowpassFrequency"]').val(checked ? cutoff : 0).attr('disabled', !checked);
            });
        }

        // The notch cutoff must be smaller than the notch frecuency
        function adjustNotchCutoff(frequencyName, cutoffName) {
            var frecuency = parseInt($(".pid_filter input[name='" + frequencyName + "']").val());
            var cutoff = parseInt($(".pid_filter input[name='" + cutoffName + "']").val());

            // Change the max and refresh the value if needed
            var maxCutoff = frecuency == 0 ? 0 : frecuency - 1;
            $(".pid_filter input[name='" + cutoffName + "']").attr("max", maxCutoff);
            if (cutoff >= frecuency) {
                $(".pid_filter input[name='" + cutoffName + "']").val(maxCutoff);
            }
        }

        $('input[name="gyroNotch1Frequency"]').change(function() {
            adjustNotchCutoff("gyroNotch1Frequency", "gyroNotch1Cutoff");
        }).change();

        $('input[name="gyroNotch2Frequency"]').change(function() {
            adjustNotchCutoff("gyroNotch2Frequency", "gyroNotch2Cutoff");
        }).change();

        $('input[name="dTermNotchFrequency"]').change(function() {
            adjustNotchCutoff("dTermNotchFrequency", "dTermNotchCutoff");
        }).change();

        // Initial state of the filters: enabled or disabled
        $('input[id="gyroNotch1Enabled"]').prop('checked', FILTER_CONFIG.gyro_notch_hz != 0).change();
        $('input[id="gyroNotch2Enabled"]').prop('checked', FILTER_CONFIG.gyro_notch2_hz != 0).change();

        if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
            $('input[id="dTermNotchEnabled"]').prop('checked', FILTER_CONFIG.dterm_notch_hz != 0).change();
            $('input[id="gyroLowpassEnabled"]').prop('checked', FILTER_CONFIG.gyro_lowpass_hz != 0).change();
            $('input[id="dtermLowpassEnabled"]').prop('checked', FILTER_CONFIG.dterm_lowpass_hz != 0).change();
            $('input[id="dtermLowpass2Enabled"]').prop('checked', FILTER_CONFIG.dterm_lowpass2_hz != 0).change();
            $('input[id="gyroLowpass2Enabled"]').prop('checked', FILTER_CONFIG.gyro_lowpass2_hz != 0).change();
            $('input[id="yawLowpassEnabled"]').prop('checked', FILTER_CONFIG.yaw_lowpass_hz != 0).change();
        } else {
            $('input[id="gyroLowpassEnabled"]').prop('checked', FILTER_CONFIG.gyro_lowpass_hz_pitch != 0).change();
            $('input[id="dtermLowpassEnabled"]').prop('checked', FILTER_CONFIG.dterm_lowpass_hz_pitch != 0).change();
            $('input[id="dtermLowpass2Enabled"]').prop('checked', FILTER_CONFIG.dterm_lowpass2_hz_pitch != 0).change();
            $('input[id="gyroLowpass2Enabled"]').prop('checked', FILTER_CONFIG.gyro_lowpass2_hz_pitch != 0).change();
        }

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //ABG gyro
            $('input[name="gyroABGalpha-number"]').val(FILTER_CONFIG.gyro_ABG_alpha);
            $('input[name="gyroABGboost-number"]').val(FILTER_CONFIG.gyro_ABG_boost);
            $('input[name="gyroABGhalflife-number"]').val(FILTER_CONFIG.gyro_ABG_half_life);
            $('.GyroABGFilter').show();
            //ABG dterm
            $('input[name="dtermABGalpha-number"]').val(FILTER_CONFIG.dterm_ABG_alpha);
            $('input[name="dtermABGboost-number"]').val(FILTER_CONFIG.dterm_ABG_boost);
            $('input[name="dtermABGhalflife-number"]').val(FILTER_CONFIG.dterm_ABG_half_life);
            $('.DTermABGFilter').show();
        } else {
            $('.GyroABGFilter').hide();
            $('.DTermABGFilter').hide();
        }
        // end MSP 1.51

        // MSP 1.51
        //this could easily be located below emu_gravity(pid_tab) as well, but instead located here since it's related to gyro struct
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //SmithPredictor
            $('input[name="SmithPredictorEnabledSwitch"]').prop('checked', FILTER_CONFIG.smithPredictorEnabled !== 0);
            $('#SmithPredictor').show();
        } else {
            $('#SmithPredictor').hide();
        }
        // end MSP 1.51

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            // Motor Mixer
            $('.MotorMixer select[name="MotorMixerImplSelect"]').val(ADVANCED_TUNING.mixer_impl);
            $('.MotorMixer input[name="MixerLazinessEnabled"').prop('checked',ADVANCED_TUNING.mixer_laziness !== 0);
            $('.MotorMixer input[name="MixerThrottleCompEnabled"').prop('checked',ADVANCED_TUNING.mixer_yaw_throttle_comp !== 0);
            //Thrust Linearization
            $('.ThrustLinear input[name="pidTuningTLLowOuput-number"').val(ADVANCED_TUNING.linear_thrust_low_output);
            $('.ThrustLinear input[name="pidTuningTLHighOuput-number"').val(ADVANCED_TUNING.linear_thrust_high_output);
            //Throttle Linearization
            $('.ThrottleLinear input[name="LinearThrottleEnabled"').prop('checked',ADVANCED_TUNING.linear_throttle !== 0);
        }  // does not require ELSE-block to hide fields, because container feel-tab is hidden/unhidden.
        //end MSP 1.51

        //experimental expert-mode show/hide SPA
        if (!isExpertModeEnabled()) {
            $('.isexpertmode').hide();
        }
    } //pid_and_rc_to_form()

    function form_to_pid_and_rc() {
        // Fill in the data from PIDs array
        // Catch all the changes and stuff the inside PIDs array

        // For each pid name
        PID_names.forEach(function(elementPid, indexPid) {

            // Look into the PID table to a row with the name of the pid
            var searchRow = $('.pid_tuning .' + elementPid + ' input');

            // Assign each value
            searchRow.each(function(indexInput) {
                if ($(this).val()) {
                    PIDs[indexPid][indexInput] = parseFloat($(this).val());
                }
            });
        });

        // catch RC_tuning changes
        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            RC_tuning.rates_type = $('select[name="rcRatesTypeSelect"]').val();
        }
        //end MSP 1.51

        //MSP 1.51
        const pitch_rate_e = $('.pid_tuning input[name="pitch_rate"]');
        const roll_rate_e = $('.pid_tuning input[name="roll_rate"]');
        const yaw_rate_e = $('.pid_tuning input[name="yaw_rate"]');
        const rc_rate_pitch_e = $('.pid_tuning input[name="rc_rate_pitch"]');
        const rc_rate_e = $('.pid_tuning input[name="rc_rate"]');
        const rc_rate_yaw_e = $('.pid_tuning input[name="rc_rate_yaw"]');
        const rc_pitch_expo_e = $('.pid_tuning input[name="rc_pitch_expo"]');
        const rc_expo_e = $('.pid_tuning input[name="rc_expo"]');
        const rc_yaw_expo_e = $('.pid_tuning input[name="rc_yaw_expo"]');

        RC_tuning.RC_RATE = parseFloat(rc_rate_e.val());
        RC_tuning.roll_rate = parseFloat(roll_rate_e.val());
        RC_tuning.pitch_rate = parseFloat(pitch_rate_e.val());
        RC_tuning.yaw_rate = parseFloat(yaw_rate_e.val());
        RC_tuning.RC_EXPO = parseFloat(rc_expo_e.val());
        RC_tuning.RC_YAW_EXPO = parseFloat(rc_yaw_expo_e.val());
        RC_tuning.rcYawRate = parseFloat(rc_rate_yaw_e.val());
        RC_tuning.rcPitchRate = parseFloat(rc_rate_pitch_e.val());
        RC_tuning.RC_PITCH_EXPO = parseFloat(rc_pitch_expo_e.val());
       if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            switch(self.currentRatesType) {
                case 1: //raceflight
                    console.log('raceflight / 100 code');
                    RC_tuning.pitch_rate = parseFloat(pitch_rate_e.val()) / 100;
                    RC_tuning.roll_rate = parseFloat(roll_rate_e.val()) / 100;
                    RC_tuning.yaw_rate = parseFloat(yaw_rate_e.val()) / 100;
                    RC_tuning.rcPitchRate = parseFloat(rc_rate_pitch_e.val()) / 1000;
                    RC_tuning.RC_RATE = parseFloat(rc_rate_e.val()) / 1000;
                    RC_tuning.rcYawRate = parseFloat(rc_rate_yaw_e.val()) / 1000;
                    RC_tuning.RC_PITCH_EXPO = parseFloat(rc_pitch_expo_e.val()) / 100;
                    RC_tuning.RC_EXPO = parseFloat(rc_expo_e.val()) / 100;
                    RC_tuning.RC_YAW_EXPO = parseFloat(rc_yaw_expo_e.val()) / 100;
                    break;
                case 3: //actual
                    console.log('actual / 1000 code');
                    RC_tuning.pitch_rate = parseFloat(pitch_rate_e.val()) / 1000;
                    RC_tuning.roll_rate = parseFloat(roll_rate_e.val()) / 1000;
                    RC_tuning.yaw_rate = parseFloat(yaw_rate_e.val()) / 1000;
                    RC_tuning.rcPitchRate = parseFloat(rc_rate_pitch_e.val()) / 1000;
                    RC_tuning.RC_RATE = parseFloat(rc_rate_e.val()) / 1000;
                    RC_tuning.rcYawRate = parseFloat(rc_rate_yaw_e.val()) / 1000;
                    break;
                // add future rates types here
                default: // BetaFlight
                    break;
            }
        }
        //end MSP 1.51
        RC_tuning.throttle_EXPO = parseFloat($('.throttle input[name="expo"]').val());
        RC_tuning.dynamic_THR_PID_P = parseFloat($('.tpa input[name="tpa_P"]').val());
        RC_tuning.dynamic_THR_breakpoint = parseInt($('.tpa input[name="tpa-breakpoint"]').val());

        // rateDynamincs (Stick-pids)
        if (semver.gte(CONFIG.apiVersion, "1.46.0")) {
            (RC_tuning.rateSensCenter) = parseInt($('.rateDynamics input[name="rateSensCenter-number"]').val());
            (RC_tuning.rateSensEnd) = parseInt($('.rateDynamics input[name="rateSensEnd-number"]').val());
            (RC_tuning.rateCorrectionCenter) = parseInt($('.rateDynamics input[name="rateCorrectionCenter-number"]').val());
            (RC_tuning.rateCorrectionEnd) = parseInt($('.rateDynamics input[name="rateCorrectionEnd-number"]').val());
            (RC_tuning.rateWeightCenter) = parseInt($('.rateDynamics input[name="rateWeightCenter-number"]').val());
            (RC_tuning.rateWeightEnd) = parseInt($('.rateDynamics input[name="rateWeightEnd-number"]').val());
        }

        //MSP 1.51
        if ( semver.gte(CONFIG.apiVersion, "1.51.0") ) {
            RC_tuning.addRollToYawRc =parseInt($('.DualAxisSteering input[name="addRollToYawRc-number"]').val()); //.pid_tuning //#DualAxisSteering
            RC_tuning.addYawToRollRc = parseInt($('.DualAxisSteering input[name="addYawToRollRc-number"]').val()); //.pid_tuning //#DualAxisSteering
            console.log("parsed form to DAS: " + RC_tuning.addRollToYawRc + " & " + RC_tuning.addYawToRollRc );
        }
        //end MSP 1.51

        if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
            FILTER_CONFIG.gyro_lowpass_hz = parseInt($('.pid_filter input[name="gyroLowpassFrequency"]').val());
            FILTER_CONFIG.dterm_lowpass_hz = parseInt($('.pid_filter input[name="dtermLowpassFrequency"]').val());
            FILTER_CONFIG.yaw_lowpass_hz = parseInt($('.pid_filter input[name="yawLowpassFrequency"]').val());
        } else {
            FILTER_CONFIG.gyro_lowpass_hz_roll = parseInt($('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val());
            FILTER_CONFIG.gyro_lowpass_hz_pitch = parseInt($('.pid_filter input[name="gyroLowpassFrequencyPitch"]').val());
            FILTER_CONFIG.gyro_lowpass_hz_yaw = parseInt($('.pid_filter input[name="gyroLowpassFrequencyYaw"]').val());
            FILTER_CONFIG.dterm_lowpass_hz_roll = parseInt($('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val());
            FILTER_CONFIG.dterm_lowpass_hz_pitch = parseInt($('.pid_filter input[name="dtermLowpassFrequencyPitch"]').val());
            FILTER_CONFIG.dterm_lowpass_hz_yaw = parseInt($('.pid_filter input[name="dtermLowpassFrequencyYaw"]').val());
        }

        if (semver.gte(CONFIG.apiVersion, "1.16.0") && !semver.gte(CONFIG.apiVersion, "1.20.0")) {
            FEATURE_CONFIG.features.updateData($('input[name="SUPEREXPO_RATES"]'));
        }

        if (semver.gte(CONFIG.apiVersion, "1.16.0")) {
            ADVANCED_TUNING.vbatPidCompensation = $('input[id="vbatpidcompensation"]').is(':checked') ? 1 : 0;
        }

        if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
            ADVANCED_TUNING.dtermSetpointTransition = parseInt($('input[name="dtermSetpointTransition-number"]').val() * 100);
            //dBoost //save
            if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                ADVANCED_TUNING.dtermBoost = parseInt($('input[name="dtermBoost-number"]').val());
            } else {
                ADVANCED_TUNING.dtermSetpointWeight = parseInt($('input[name="dtermSetpoint-number"]').val() * 100);
            }

            FILTER_CONFIG.gyro_notch_hz = parseInt($('.pid_filter input[name="gyroNotch1Frequency"]').val());
            FILTER_CONFIG.gyro_notch_cutoff = parseInt($('.pid_filter input[name="gyroNotch1Cutoff"]').val());
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                FILTER_CONFIG.dterm_notch_hz = parseInt($('.pid_filter input[name="dTermNotchFrequency"]').val());
                FILTER_CONFIG.dterm_notch_cutoff = parseInt($('.pid_filter input[name="dTermNotchCutoff"]').val());
            }
            if (semver.gte(CONFIG.apiVersion, "1.21.0")) {
                FILTER_CONFIG.gyro_notch2_hz = parseInt($('.pid_filter input[name="gyroNotch2Frequency"]').val());
                FILTER_CONFIG.gyro_notch2_cutoff = parseInt($('.pid_filter input[name="gyroNotch2Cutoff"]').val());
            }
        }

        if ( semver.gte(CONFIG.apiVersion, "1.24.0") ) {
            ADVANCED_TUNING.levelAngleLimit = parseInt($('.pid_tuning input[name="angleLimit"]').val());
            if ( semver.gte(CONFIG.apiVersion, "1.46.0") ) {
                    ADVANCED_TUNING.p_angle_high = parseInt($('.pid_tuning input[name="p_angle_high"]').val());
                    ADVANCED_TUNING.p_angle_low = parseInt($('.pid_tuning input[name="p_angle_low"]').val());
                    ADVANCED_TUNING.d_angle_high = parseInt($('.pid_tuning input[name="d_angle_high"]').val());
                    ADVANCED_TUNING.d_angle_low = parseInt($('.pid_tuning input[name="d_angle_low"]').val());
                    ADVANCED_TUNING.f_angle = parseInt($('.pid_tuning input[name="f_angle"]').val());

                    ADVANCED_TUNING.angleExpo = parseInt($('.pid_tuning input[name="angle_expo"]').val());
                    ADVANCED_TUNING.horizonTiltEffect = parseInt($('.pid_tuning input[name="horizon_tilt_effect"]').val());
                    ADVANCED_TUNING.horizonTransition =  parseInt($('.pid_tuning input[name="horizon_transition"]').val());
            }
        }

        if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
            FILTER_CONFIG.dterm_lowpass_type = $('.pid_filter select[name="dtermLowpassType"]').val();
            ADVANCED_TUNING.itermThrottleThreshold = parseInt($('.antigravity input[name="itermThrottleThreshold"]').val());
            ADVANCED_TUNING.itermAcceleratorGain = parseInt($('.antigravity input[name="itermAcceleratorGain"]').val() * 1000);
        }

        if (semver.gte(CONFIG.apiVersion, "1.39.0")) {
            if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
                FILTER_CONFIG.gyro_lowpass2_hz_roll = parseInt($('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val());
                FILTER_CONFIG.gyro_lowpass2_hz_pitch = parseInt($('.pid_filter input[name="gyroLowpass2FrequencyPitch"]').val());
                FILTER_CONFIG.gyro_lowpass2_hz_yaw = parseInt($('.pid_filter input[name="gyroLowpass2FrequencyYaw"]').val());
                FILTER_CONFIG.dterm_lowpass2_hz_roll = parseInt($('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val());
                FILTER_CONFIG.dterm_lowpass2_hz_pitch = parseInt($('.pid_filter input[name="dtermLowpass2FrequencyPitch"]').val());
                FILTER_CONFIG.dterm_lowpass2_hz_yaw = parseInt($('.pid_filter input[name="dtermLowpass2FrequencyYaw"]').val());
            } else {
                FILTER_CONFIG.gyro_lowpass2_hz = parseInt($('.pid_filter input[name="gyroLowpass2Frequency"]').val());
                FILTER_CONFIG.dterm_lowpass2_hz = parseInt($('.pid_filter input[name="dtermLowpass2Frequency"]').val());
            }

            FILTER_CONFIG.gyro_lowpass_type = parseInt($('.pid_filter select[name="gyroLowpassType"]').val());
            FILTER_CONFIG.gyro_lowpass2_type = parseInt($('.pid_filter select[name="gyroLowpass2Type"]').val());
        }

        if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
            if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                ADVANCED_TUNING.feathered_pids = $('input[name="featheredPids-number"]').val();
            } else {
                ADVANCED_TUNING.feathered_pids = $('input[id="feathered_pids"]').is(':checked') ? 1 : 0;
            }

            // MSP 1.51
            if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
                //emuGravity
                ADVANCED_TUNING.emuGravityGain = $('input[name="emuGravity-number"]').val();
                //df_yaw
                ADVANCED_TUNING.directFF_yaw = $('input[name="DFyaw-number"]').val();
                //axis-lock
                ADVANCED_TUNING.axis_lock_hz = $('input[name="axisLockHz-number"]').val();
                ADVANCED_TUNING.axis_lock_multiplier = $('input[name="axisLockMultiplier-number"]').val();
            }
            //end MSP 1.51

            ADVANCED_TUNING.itermRotation = $('input[id="itermrotation"]').is(':checked') ? 1 : 0;
            if (semver.gte(CONFIG.apiVersion, "1.43.0")) {
                ADVANCED_TUNING.nfe_racermode = $('input[id="nferacermode"]').is(':checked') ? 1 : 0;
            }
            ADVANCED_TUNING.smartFeedforward = $('input[id="smartfeedforward"]').is(':checked') ? 1 : 0;
            //iTermRelax V2 //save
            //dBoost //save
            if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                ADVANCED_TUNING.iterm_relax_cutoff = parseInt($('input[name="iRelax-number"]').val());
                ADVANCED_TUNING.iterm_relax_cutoff_yaw = parseInt($('input[name="iRelaxYaw-number"]').val());
                ADVANCED_TUNING.dtermBoostLimit = parseInt($('input[name="dtermBoostLimit-number"]').val());
            } else { //iTermRelax V1 save
                ADVANCED_TUNING.itermRelax = $('input[id="itermrelax"]').is(':checked') ? $('select[id="itermrelaxAxes"]').val() : 0;
                ADVANCED_TUNING.itermRelaxType = $('input[id="itermrelax"]').is(':checked') ? $('select[id="itermrelaxType"]').val() : 0;
                ADVANCED_TUNING.itermRelaxCutoff = parseInt($('input[name="itermRelaxCutoff"]').val());
            }
            ADVANCED_TUNING.absoluteControlGain = $('input[name="absoluteControlGain-number"]').val();
            ADVANCED_TUNING.iDecay = $('input[name="iDecay-number"]').val();
            ADVANCED_TUNING.errorBoost = $('input[name="errorBoost-number"]').val();
            ADVANCED_TUNING.errorBoostLimit = $('input[name="errorBoostLimit-number"]').val();
            ADVANCED_TUNING.throttleBoost = $('input[name="throttleBoost-number"]').val();
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                ADVANCED_TUNING.acroTrainerAngleLimit = $('input[name="acroTrainerAngleLimit-number"]').val();
            }
            if (semver.lt(CONFIG.apiVersion, "1.46.0")) {
                ADVANCED_TUNING.feedforwardRoll = parseInt($('.pid_tuning .ROLL input[name="f"]').val());
                ADVANCED_TUNING.feedforwardPitch = parseInt($('.pid_tuning .PITCH input[name="f"]').val());
                ADVANCED_TUNING.feedforwardYaw = parseInt($('.pid_tuning .YAW input[name="f"]').val());
                ADVANCED_TUNING.feedforwardTransition = parseInt($('input[name="feedforwardTransition-number"]').val() * 100);
            }
            ADVANCED_TUNING.antiGravityMode = $('select[id="antiGravityMode"]').val();

            if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX" && semver.lt(CONFIG.apiVersion, "1.42.0")) {
                KALMAN_FILTER_CONFIG.gyro_filter_q = parseInt($('.pid_filter input[name="kalmanQCoefficient"]').val());
                KALMAN_FILTER_CONFIG.gyro_filter_w = parseInt($('.pid_filter input[name="kalmanRCoefficient"]').val());
            } else {
                IMUF_FILTER_CONFIG.imuf_roll_q = parseInt($('#imuf_roll_q').val());
                IMUF_FILTER_CONFIG.imuf_pitch_q = parseInt($('#imuf_pitch_q').val());
                IMUF_FILTER_CONFIG.imuf_yaw_q = parseInt($('#imuf_yaw_q').val());
                IMUF_FILTER_CONFIG.imuf_w = parseInt($('#imuf_w').val());
                //MSP 1.51 adjustment
                if (semver.lt(CONFIG.apiVersion, "1.51.0")) {
                    IMUF_FILTER_CONFIG.imuf_sharpness = parseInt($('#imuf_sharpness').val());
                } //end MSP 1.51 adjustment

                if (CONFIG.boardIdentifier === "HESP" || CONFIG.boardIdentifier === "SX10" || CONFIG.boardIdentifier === "FLUX") {
                    IMUF_FILTER_CONFIG.imuf_roll_lpf_cutoff_hz = parseInt($('#imuf_roll_lpf_cutoff_hz').val());
                    IMUF_FILTER_CONFIG.imuf_pitch_lpf_cutoff_hz = parseInt($('#imuf_pitch_lpf_cutoff_hz').val());
                    IMUF_FILTER_CONFIG.imuf_yaw_lpf_cutoff_hz = parseInt($('#imuf_yaw_lpf_cutoff_hz').val());
                    if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                        IMUF_FILTER_CONFIG.imuf_acc_lpf_cutoff_hz = parseInt($('#imuf_acc_lpf_cutoff_hz').val());
                    }
                }
            }
        }

        if (semver.gte(CONFIG.apiVersion, "1.41.0")) {
            RC_tuning.throttle_limit_type = $('select[id="throttleLimitType"]').val();
            RC_tuning.throttle_limit_percent = parseInt($('.throttle_limit input[name="throttleLimitPercent"]').val());
        }

        EMUF_ADVANCED.dynamic_THR_PID_I = parseFloat($('.tpa input[name="tpa_I"]').val());
        EMUF_ADVANCED.dynamic_THR_PID_D = parseFloat($('.tpa input[name="tpa_D"]').val());

        if (semver.gte(CONFIG.apiVersion, "1.43.0")) {
            ADVANCED_TUNING.errorBoostYaw = $('input[name="errorBoostYaw-number"]').val();
            ADVANCED_TUNING.errorBoostLimitYaw = $('input[name="errorBoostLimitYaw-number"]').val();
            if (semver.lt(CONFIG.apiVersion, "1.44.0")) {
                ADVANCED_TUNING.setPointPTransition = parseFloat($('.spa input[name="spa_P"]').val());
                ADVANCED_TUNING.setPointITransition = parseFloat($('.spa input[name="spa_I"]').val());
                ADVANCED_TUNING.setPointDTransition = parseFloat($('.spa input[name="spa_D"]').val());
            } else {
                ADVANCED_TUNING.setPointPTransitionRoll = parseFloat($('.spa_roll input[name="spaRoll_P"]').val());
                ADVANCED_TUNING.setPointITransitionRoll = parseFloat($('.spa_roll input[name="spaRoll_I"]').val());
                ADVANCED_TUNING.setPointDTransitionRoll = parseFloat($('.spa_roll input[name="spaRoll_D"]').val());
                ADVANCED_TUNING.setPointPTransitionPitch = parseFloat($('.spa_pitch input[name="spaPitch_P"]').val());
                ADVANCED_TUNING.setPointITransitionPitch = parseFloat($('.spa_pitch input[name="spaPitch_I"]').val());
                ADVANCED_TUNING.setPointDTransitionPitch = parseFloat($('.spa_pitch input[name="spaPitch_D"]').val());
            }
            ADVANCED_TUNING.setPointPTransitionYaw = parseFloat($('.spa_yaw input[name="spaYaw_P"]').val());
            ADVANCED_TUNING.setPointITransitionYaw = parseFloat($('.spa_yaw input[name="spaYaw_I"]').val());
            ADVANCED_TUNING.setPointDTransitionYaw = parseFloat($('.spa_yaw input[name="spaYaw_D"]').val());
        }

        //save smart_dterm_smoothing_, witchcraft_ //first build with legit MSP144 is 0.2.35
        if ( semver.gte(CONFIG.apiVersion, "1.44.0") && semver.gte(CONFIG.flightControllerVersion, "0.2.35") ) {
            FILTER_CONFIG.smartSmoothing_roll  = parseFloat($('.smartDTermWitchBox input[name="smartdTermRoll"]').val());
            FILTER_CONFIG.smartSmoothing_pitch = parseFloat($('.smartDTermWitchBox input[name="smartdTermPitch"]').val());
            FILTER_CONFIG.smartSmoothing_yaw   = parseFloat($('.smartDTermWitchBox input[name="smartdTermYaw"]').val());

            FILTER_CONFIG.witchcraft_roll      = parseFloat($('.smartDTermWitchBox input[name="witchcraftRoll"]').val());
            FILTER_CONFIG.witchcraft_pitch     = parseFloat($('.smartDTermWitchBox input[name="witchcraftPitch"]').val());
            FILTER_CONFIG.witchcraft_yaw       = parseFloat($('.smartDTermWitchBox input[name="witchcraftYaw"]').val());
        }

        if ( FEATURE_CONFIG.features.isEnabled('DYNAMIC_FILTER') && semver.gte(CONFIG.apiVersion, "1.47.0")) {
            FILTER_CONFIG.dynamic_gyro_notch_q  = parseFloat($('.pid_filter input[name="MatrixNotchQ"]').val());
            FILTER_CONFIG.dynamic_gyro_notch_min_hz = parseFloat($('.pid_filter input[name="MatrixNotchMin"]').val());
        }

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //ABG gyro
            FILTER_CONFIG.gyro_ABG_alpha = $('.pid_filter input[name="gyroABGalpha-number"]').val();
            FILTER_CONFIG.gyro_ABG_boost = $('.pid_filter input[name="gyroABGboost-number"]').val();
            FILTER_CONFIG.gyro_ABG_half_life = $('.pid_filter input[name="gyroABGhalflife-number"]').val();

            //ABG dterm
            FILTER_CONFIG.dterm_ABG_alpha = $('.pid_filter input[name="dtermABGalpha-number"]').val();
            FILTER_CONFIG.dterm_ABG_boost = $('.pid_filter input[name="dtermABGboost-number"]').val();
            FILTER_CONFIG.dterm_ABG_half_life = $('.pid_filter input[name="dtermABGhalflife-number"]').val();
        }
        // end MSP 1.51

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //SmithPredictor
            FILTER_CONFIG.smithPredictorEnabled = $('input[name="SmithPredictorEnabledSwitch"]').is(':checked') ? 1 : 0;
        }
        // end MSP 1.51

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            //MotorMixer
            ADVANCED_TUNING.mixer_impl = $('.MotorMixer select[name="MotorMixerImplSelect"]').val();
            ADVANCED_TUNING.mixer_laziness = $('input[name="MixerLazinessEnabled"]').is(':checked') ? 1 : 0;
            ADVANCED_TUNING.mixer_yaw_throttle_comp = $('input[name="MixerThrottleCompEnabled"]').is(':checked') ? 1 : 0;
            MixerThrottleCompEnabled
            //Thrust Linearization
            ADVANCED_TUNING.linear_thrust_low_output = $('input[name="pidTuningTLLowOuput-number"]').val();
            ADVANCED_TUNING.linear_thrust_high_output = $('input[name="pidTuningTLHighOuput-number"]').val();
            //Throttle Linearization
            ADVANCED_TUNING.linear_throttle = $('input[name="LinearThrottleEnabled"]').is(':checked') ? 1 : 0;
        }
        // end MSP 1.51
    } //end function form_to_pid_and_rc()

    function showAllPids() {
        // Hide all optional elements
        //$('.pid_optional tr').show(); // Hide all rows
        //$('.pid_optional table').show(); // Hide tables
        $('.pid_optional').show(); // Hide general div

        // Only show rows supported by the firmware
        PID_names.forEach(function(elementPid) {
            // Show rows for the PID
            $('.pid_tuning .' + elementPid).show();

            // Show titles and other elements needed by the PID
            $('.needed_by_' + elementPid).show();
        });
    }

    function hideUnusedPids() {
        // Hide all optional elements
        //$('.pid_optional tr').hide(); // Hide all rows
        //$('.pid_optional table').hide(); // Hide tables
        $('.pid_optional').hide(); // Hide general div

        if (!have_sensor(CONFIG.activeSensors, 'acc')) {
            $('#pid_accel').hide();
        }

        var hideSensorPid = function(element, sensorReady) {
            var isVisible = element.is(":visible");
            if (!isVisible || !sensorReady) {
                element.hide();
                isVisible = false;
            }

            return isVisible;
        }

        var isVisibleBaroMagGps = false;

        isVisibleBaroMagGps |= hideSensorPid($('#pid_baro'), have_sensor(CONFIG.activeSensors, 'baro') || have_sensor(CONFIG.activeSensors, 'sonar'));

        isVisibleBaroMagGps |= hideSensorPid($('#pid_mag'), have_sensor(CONFIG.activeSensors, 'mag'));

        isVisibleBaroMagGps |= hideSensorPid($('#pid_gps'), have_sensor(CONFIG.activeSensors, 'GPS'));

        if (!isVisibleBaroMagGps) {
            $('#pid_baro_mag_gps').hide();
        }
    }

    function drawAxes(curveContext, width, height) {
        curveContext.strokeStyle = '#000000';
        curveContext.lineWidth = 4;

        // Horizontal
        curveContext.beginPath();
        curveContext.moveTo(0, height / 2);
        curveContext.lineTo(width, height / 2);
        curveContext.stroke();

        // Vertical
        curveContext.beginPath();
        curveContext.moveTo(width / 2, 0);
        curveContext.lineTo(width / 2, height);
        curveContext.stroke();

    }

    function checkInput(element) {
        var value = parseFloat(element.val());
        if (value < parseFloat(element.prop('min')) ||
            value > parseFloat(element.prop('max'))) {
            value = undefined;
        }

        return value;
    }

    var useLegacyCurve = false;
    if (!semver.gte(CONFIG.apiVersion, "1.16.0")) {
        useLegacyCurve = true;
    }

    self.rateCurve = new RateCurve(useLegacyCurve);

    function printMaxAngularVel(rate, rcRate, rcExpo, useSuperExpo, deadband, limit, maxAngularVelElement) {
        var maxAngularVel = self.rateCurve.getMaxAngularVel(rate, rcRate, rcExpo, useSuperExpo, deadband, limit).toFixed(0);
        maxAngularVelElement.text(maxAngularVel);

        return maxAngularVel;
    }

    function drawCurve(rate, rcRate, rcExpo, useSuperExpo, deadband, limit, maxAngularVel, colour, yOffset, context) {
        context.save();
        context.strokeStyle = colour;
        context.translate(0, yOffset);
        self.rateCurve.draw(rate, rcRate, rcExpo, useSuperExpo, deadband, limit, maxAngularVel, context);
        context.restore();
    }

    function process_html() {
        if (semver.gte(CONFIG.apiVersion, "1.16.0") && !semver.gte(CONFIG.apiVersion, "1.20.0")) {
            FEATURE_CONFIG.features.generateElements($('.tab-pid_tuning .features'));
        } else {
            $('.tab-pid_tuning .pidTuningFeatures').hide();
        }

        if (semver.lt(CONFIG.apiVersion, "1.39.0")) {
            $('input[name="dtermSetpoint-number"]').attr('max', self.SETPOINT_WEIGHT_RANGE_LEGACY);
        }

        // translate to user-selected language
        i18n.localizePage();

        // Local cache of current rates
        self.currentRates = {
            roll_rate: RC_tuning.roll_rate,
            pitch_rate: RC_tuning.pitch_rate,
            yaw_rate: RC_tuning.yaw_rate,
            rc_rate: RC_tuning.RC_RATE,
            rc_rate_yaw: RC_tuning.rcYawRate,
            rc_expo: RC_tuning.RC_EXPO,
            rc_yaw_expo: RC_tuning.RC_YAW_EXPO,
            rc_rate_pitch: RC_tuning.rcPitchRate,
            rc_pitch_expo: RC_tuning.RC_PITCH_EXPO,
            superexpo: FEATURE_CONFIG.features.isEnabled('SUPEREXPO_RATES'),
            deadband: RC_DEADBAND_CONFIG.deadband,
            yawDeadband: RC_DEADBAND_CONFIG.yaw_deadband,
            roll_rate_limit: RC_tuning.roll_rate_limit,
            pitch_rate_limit: RC_tuning.pitch_rate_limit,
            yaw_rate_limit: RC_tuning.yaw_rate_limit
        };

        if (semver.lt(CONFIG.apiVersion, "1.7.0")) {
            self.currentRates.roll_rate = RC_tuning.roll_pitch_rate;
            self.currentRates.pitch_rate = RC_tuning.roll_pitch_rate;
        }

        if (semver.lt(CONFIG.apiVersion, "1.16.0")) {
            self.currentRates.rc_rate_yaw = self.currentRates.rc_rate;
        }

        if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
            self.currentRates.superexpo = true;
        }

        if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
            $('.pid_tuning input[name="sensitivity"]').hide();
            $('.pid_tuning .levelSensitivityHeader').empty();
        }

        if (semver.lt(CONFIG.apiVersion, "1.37.0")) {
            self.currentRates.rc_rate_pitch = self.currentRates.rc_rate;
            self.currentRates.rc_expo_pitch = self.currentRates.rc_expo;
        }

        // MSP 1.51
        if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
            switch(RC_tuning.rates_type) {
                case 1: //raceflight
                    self.currentRates.roll_rate *= 100;
                    self.currentRates.pitch_rate *= 100;
                    self.currentRates.yaw_rate *= 100;
                    self.currentRates.rc_rate *= 1000;
                    self.currentRates.rc_rate_yaw *= 1000;
                    self.currentRates.rc_rate_pitch *= 1000;
                    self.currentRates.rc_expo *= 100;
                    self.currentRates.rc_yaw_expo *= 100;
                    self.currentRates.rc_pitch_expo *= 100;
                    break;
                case 3: //actual
                    self.currentRates.roll_rate *= 1000;
                    self.currentRates.pitch_rate *= 1000;
                    self.currentRates.yaw_rate *= 1000;
                    self.currentRates.rc_rate *= 1000;
                    self.currentRates.rc_rate_yaw *= 1000;
                    self.currentRates.rc_rate_pitch *= 1000;
                    break;
                // add future rates types here
                default: // BetaFlight
                    break;
            }
        }
        //end MSP 1.51

        function activateSubtab(subtabName) {
            const names = ['pid', 'rates', 'filter','feel'];
            if (!names.includes(subtabName)) {
                console.debug('Invalid subtab name: "' + subtabName + '"');
                return;
            }
            for (name of names) {
                const el = $('.tab-pid_tuning .subtab-' + name);
                el[name == subtabName ? 'show' : 'hide']();
            }
            $('.tab-pid_tuning .tab_container td').removeClass('active');
            $('.tab-pid_tuning .tab_container .' + subtabName).addClass('active');
            self.activeSubtab = subtabName;
            //debug
            console.log('Activated subtab: '+subtabName);
        }

        activateSubtab(self.activeSubtab);

        $('.tab-pid_tuning .tab_container .pid').on('click', () => activateSubtab('pid'));

        $('.tab-pid_tuning .tab_container .rates').on('click', () => activateSubtab('rates'));

        $('.tab-pid_tuning .tab_container .filter').on('click', () => activateSubtab('filter'));

        //MSP 1.51
        $('.tab-pid_tuning .tab_container .feel').on('click', () => activateSubtab('feel'));
        //end MSP 1.51

        function loadProfilesList() {
            var numberOfProfiles = 3;
            if (semver.gte(CONFIG.apiVersion, "1.20.0") &&
                CONFIG.numProfiles === 2) {
                numberOfProfiles = 2;
            }

            var profileElements = [];
            for (var i = 0; i < numberOfProfiles; i++) {
                profileElements.push(i18n.getMessage("pidTuningProfileOption", [(i + 1)]));
            }
            return profileElements;
        }

        function loadRateProfilesList() {
            var numberOfRateProfiles = 6;
            if (semver.lt(CONFIG.apiVersion, "1.37.0")) {
                numberOfRateProfiles = 3;
            }

            var rateProfileElements = [];
            for (var i = 0; i < numberOfRateProfiles; i++) {
                rateProfileElements.push(i18n.getMessage("pidTuningRateProfileOption", [(i + 1)]));
            }
            return rateProfileElements;
        }

        function loadPresetsList() {
            var numberOfPresets = Object.keys(presetJson).length;
            var keys = Object.keys(presetJson);
            keys.sort();
            keys.reverse();
            var presetsElements = [];
            for (var i = 0; i < numberOfPresets; i++) {
                presetsElements.push(keys[i]);
            }
            return presetsElements;
        }

        // This vars are used here for populate the profile (and rate profile) selector AND in the copy profile (and rate profile) window
        var selectRateProfileValues = loadRateProfilesList();
        var selectProfileValues = loadProfilesList();
        var selectPresetValues;
        if (presetJson) {
            selectPresetValues = loadPresetsList();
        } else {
            selectPresetValues = [];
        }

        function populateProfilesSelector(selectProfileValues) {
            var profileSelect = $('select[name="profile"]');
            selectProfileValues.forEach(function(value, key) {
                profileSelect.append('<option value="' + key + '">' + value + '</option>');
            });
        }

        populateProfilesSelector(selectProfileValues);

        function populateRateProfilesSelector(selectRateProfileValues) {
            var rateProfileSelect = $('select[name="rate_profile"]');
            selectRateProfileValues.forEach(function(value, key) {
                rateProfileSelect.append('<option value="' + key + '">' + value + '</option>');
            });
        }

        populateRateProfilesSelector(selectRateProfileValues);

        function populatePresetsSelector(selectPresetValues) {
            var presetSelect = $('select[name="preset"]');
            presetSelect.append('<option value="default">Select a Preset</option>');
            selectPresetValues.forEach(function(value, key) {
                presetSelect.append('<option value="' + value + '">' + value + '</option>');
            });

        }

        populatePresetsSelector(selectPresetValues);

        var showAllButton = $('#showAllPids');

        function updatePidDisplay() {
            if (!self.showAllPids) {
                hideUnusedPids();
                showAllButton.text(i18n.getMessage("pidTuningShowAllPids"));
            } else {
                showAllPids();
                showAllButton.text(i18n.getMessage("pidTuningHideUnusedPids"));
            }
        }

        showAllPids();
        updatePidDisplay();

        showAllButton.on('click', function() {
            self.showAllPids = !self.showAllPids;
            updatePidDisplay();
        });

        $('#resetProfile').on('click', function() {
            resetProfile();
        });

        // PRESETS

        function resetProfile() {
            self.updating = true;
            MSP.promise(MSPCodes.MSP_SET_RESET_CURR_PID).then(function() {
                self.refresh(function() {
                    self.updating = false;
                    GUI.log(i18n.getMessage('pidTuningProfileReset'));
                });
            });
        }

        $('.tab-pid_tuning select[name="profile"]').change(function() {
            self.currentProfile = parseInt($(this).val());
            self.updating = true;
            $(this).prop('disabled', 'true');
            MSP.promise(MSPCodes.MSP_SELECT_SETTING, [self.currentProfile]).then(function() {
                self.refresh(function() {
                    self.updating = false;

                    $('.tab-pid_tuning select[name="profile"]').prop('disabled', 'false');
                    CONFIG.profile = self.currentProfile;

                    GUI.log(i18n.getMessage('pidTuningLoadedProfile', [self.currentProfile + 1]));
                });
            });
        });

        var save_and_reboot = false;

        $('#pid-tuning .presetBuild').hide();

        $('.tab-pid_tuning select[name="preset"]').change(function() {
            var presetSelected = $('.tab-pid_tuning select[name="preset"]').val();

            if (presetSelected == "default") {
                //resetProfile();

                pid_and_rc_to_form();
                save_and_reboot = false;
            } else {
                // preset warning message
                save_and_reboot = false;

                var presetNote = presetJson[presetSelected]['preset_note'];
                var presetBuildMotors = presetJson[presetSelected]['build_motors'];
                var presetBuildFrame = presetJson[presetSelected]['build_frame'];
                var presetBuildProps = presetJson[presetSelected]['build_props'];
                var presetBuildBattery = presetJson[presetSelected]['build_battery'];

                const warningPreset = '<span class=\"message-negative\">IMPORTANT:</span> <br>Test each preset with hover. Check motors temperature and check for problems. Not all presets will work with your quad. Use at your own risk. <br><br>';
                var presetMessage =  warningPreset + presetNote + '<br><br> Preset was made based on such components: <br> <b> • MOTORS: </b>' + presetBuildMotors + '<br> <b> • FRAME: </b>' + presetBuildFrame  + '<br> <b> • PROPS: </b>' + presetBuildProps + '<br> <b> • BATTERY: </b>' + presetBuildBattery ;

                $('#pid-tuning .presetBuild').html(presetMessage);

                // TODO not working need to fix
                if ( (presetSelected == "Default") || semver.lt(CONFIG.apiVersion, "1.46.0") ) {
                    $('#pid-tuning .presetBuild').hide();
                } else {
                    $('#pid-tuning .presetBuild').show();
                }

                // preset filter values
                if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX" && semver.lt(CONFIG.apiVersion, "1.42.0")) {
                    $('.pid_filter input[name="kalmanQCoefficient"]').val(presetJson[presetSelected]['gyro_filter_q']);
                    $('.pid_filter input[name="kalmanRCoefficient"]').val(presetJson[presetSelected]['gyro_filter_w']);
                } else {
                    $('#imuf_roll_q').val(presetJson[presetSelected]['imuf_roll_q']);
                    $('#imuf_pitch_q').val(presetJson[presetSelected]['imuf_pitch_q']);
                    $('#imuf_yaw_q').val(presetJson[presetSelected]['imuf_yaw_q']);
                    $('#imuf_w').val(presetJson[presetSelected]['imuf_w']);
                    //MSP 1.51 adjustment //semver.lt
                    if (semver.gte(CONFIG.apiVersion, "1.46.0") && semver.lt(CONFIG.apiVersion, "1.51.0")) {
                        $('#imuf_sharpness').val(presetJson[presetSelected]['imuf_sharpness']);
                    }
                    if (CONFIG.boardIdentifier === "HESP" || CONFIG.boardIdentifier === "SX10" || CONFIG.boardIdentifier === "FLUX") {
                        $('#imuf_pitch_lpf_cutoff_hz').val(presetJson[presetSelected]['imuf_pitch_lpf_cutoff_hz']);
                        $('#imuf_roll_lpf_cutoff_hz').val(presetJson[presetSelected]['imuf_roll_lpf_cutoff_hz']);
                        $('#imuf_yaw_lpf_cutoff_hz').val(presetJson[presetSelected]['imuf_yaw_lpf_cutoff_hz']);
                        if (semver.gte(CONFIG.apiVersion, "1.42.0")) {
                            $('#imuf_acc_lpf_cutoff_hz').val(presetJson[presetSelected]['imuf_acc_lpf_cutoff_hz']);
                        }
                    }
                }
                $('input[id="gyroLowpassEnabled"]').prop('checked', presetJson[presetSelected]['gyro_lowpass_enabled'] !== "OFF").change();
                $('.pid_filter select[name="gyroLowpassType"]').val(presetJson[presetSelected]['gyro_lowpass_type']);
                $('input[id="gyroLowpass2Enabled"]').prop('checked', presetJson[presetSelected]['gyro_lowpass2_enabled'] !== "OFF").change();
                $('.pid_filter select[name="gyroLowpass2Type"]').val(presetJson[presetSelected]['gyro_lowpass2_type']);
                if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
                    $('.pid_filter input[name="gyroLowpassFrequencyRoll"]').val(presetJson[presetSelected]['gyro_lowpass_hz_roll']);
                    $('.pid_filter input[name="gyroLowpassFrequencyPitch"]').val(presetJson[presetSelected]['gyro_lowpass_hz_pitch']);
                    $('.pid_filter input[name="gyroLowpassFrequencyYaw"]').val(presetJson[presetSelected]['gyro_lowpass_hz_yaw']);
                    $('.pid_filter input[name="gyroLowpass2FrequencyRoll"]').val(presetJson[presetSelected]['gyro_lowpass2_hz_roll']);
                    $('.pid_filter input[name="gyroLowpass2FrequencyPitch"]').val(presetJson[presetSelected]['gyro_lowpass2_hz_pitch']);
                    $('.pid_filter input[name="gyroLowpass2FrequencyYaw"]').val(presetJson[presetSelected]['gyro_lowpass2_hz_yaw']);
                } else {
                    $('.pid_filter input[name="gyroLowpassFrequency"]').val(presetJson[presetSelected]['gyro_lowpass_hz']);
                    $('.pid_filter input[name="gyroLowpass2Frequency"]').val(presetJson[presetSelected]['gyro_lowpass2_hz']);
                }

                $('input[id="gyroNotch1Enabled"]').prop('checked', presetJson[presetSelected]['gyro_notch1_enabled'] !== "OFF").change();
                $('.pid_filter input[name="gyroNotch1Frequency"]').val(presetJson[presetSelected]['gyro_notch1_hz']);
                $('.pid_filter input[name="gyroNotch1Cutoff"]').val(presetJson[presetSelected]['gyro_notch1_cutoff']);

                $('input[id="gyroNotch2Enabled"]').prop('checked', presetJson[presetSelected]['gyro_notch2_enabled'] !== "OFF").change();
                $('.pid_filter input[name="gyroNotch2Frequency"]').val(presetJson[presetSelected]['gyro_notch2_hz']);
                $('.pid_filter input[name="gyroNotch2Cutoff"]').val(presetJson[presetSelected]['gyro_notch2_cutoff']);

                $('input[id="dtermLowpassEnabled"]').prop('checked', presetJson[presetSelected]['dterm_lowpass_enabled'] !== "OFF").change();
                $('.pid_filter select[name="dtermLowpassType"]').val(presetJson[presetSelected]['dterm_lowpass_type']);
                $('input[id="dtermLowpass2Enabled"]').prop('checked', presetJson[presetSelected]['dterm_lowpass2_enabled'] !== "OFF").change();

                if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
                    $('.pid_filter input[name="dtermLowpassFrequencyRoll"]').val(presetJson[presetSelected]['dterm_lowpass_hz_roll']);
                    $('.pid_filter input[name="dtermLowpassFrequencyPitch"]').val(presetJson[presetSelected]['dterm_lowpass_hz_pitch']);
                    $('.pid_filter input[name="dtermLowpassFrequencyYaw"]').val(presetJson[presetSelected]['dterm_lowpass_hz_yaw']);
                    $('.pid_filter input[name="dtermLowpass2FrequencyRoll"]').val(presetJson[presetSelected]['dterm_lowpass2_hz_roll']);
                    $('.pid_filter input[name="dtermLowpass2FrequencyPitch"]').val(presetJson[presetSelected]['dterm_lowpass2_hz_pitch']);
                    $('.pid_filter input[name="dtermLowpass2FrequencyYaw"]').val(presetJson[presetSelected]['dterm_lowpass2_hz_yaw']);
                } else {
                    $('.pid_filter input[name="dtermLowpassFrequency"]').val(presetJson[presetSelected]['dterm_lowpass_hz']);
                    $('.pid_filter input[name="dtermLowpass2Frequency"]').val(presetJson[presetSelected]['dterm_lowpass2_hz']);
                }
                if (semver.gte(CONFIG.apiVersion, "1.46.0")) {
                    $('.smartDTermWitchBox input[name="smartdTermRoll"]').val(presetJson[presetSelected]['smart_dterm_smoothing_roll']);
                    $('.smartDTermWitchBox input[name="smartdTermPitch"]').val(presetJson[presetSelected]['smart_dterm_smoothing_pitch']);
                    $('.smartDTermWitchBox input[name="smartdTermYaw"]').val(presetJson[presetSelected]['smart_dterm_smoothing_yaw']);

                    $('.smartDTermWitchBox input[name="witchcraftRoll"]').val(presetJson[presetSelected]['witchcraft_roll']);
                    $('.smartDTermWitchBox input[name="witchcraftPitch"]').val(presetJson[presetSelected]['witchcraft_pitch']);
                    $('.smartDTermWitchBox input[name="witchcraftYaw"]').val(presetJson[presetSelected]['witchcraft_yaw']);
                }
                $('input[id="dTermNotchEnabled"]').prop('checked', presetJson[presetSelected]['dterm_notch_enabled'] !== "OFF").change();
                $('.pid_filter input[name="dTermNotchFrequency"]').val(presetJson[presetSelected]['dterm_notch_hz']);
                $('.pid_filter input[name="dTermNotchCutoff"]').val(presetJson[presetSelected]['dterm_notch_cutoff']);

                $('input[id="yawLowpassEnabled"]').prop('checked', presetJson[presetSelected]['yaw_lowpass_enabled'] !== "OFF").change();
                $('.pid_filter input[name="yawLowpassFrequency"]').val(presetJson[presetSelected]['yaw_lowpass_hz']);

                // Other settings

                var iDecayNumberElement = $('input[name="feedforwardTransition-number"]');
                iDecayNumberElement.val(presetJson[presetSelected]['feedforward_transition'] / 100).trigger('input');

                var iDecayNumberElement = $('input[name="throttleBoost-number"]');
                iDecayNumberElement.val(presetJson[presetSelected]['throttle_boost']).trigger('input');

                var iDecayNumberElement = $('input[name="absoluteControlGain-number"]');
                iDecayNumberElement.val(presetJson[presetSelected]['abs_control_gain']).trigger('input');

                var iDecayNumberElement = $('input[name="iDecay-number"]');
                iDecayNumberElement.val(presetJson[presetSelected]['i_decay']).trigger('input');

                var errorBoostNumberElement = $('input[name="errorBoost-number"]');
                errorBoostNumberElement.val(presetJson[presetSelected]['emu_boost']).trigger('input');

                var errorBoostLimitNumberElement = $('input[name="errorBoostLimit-number"]');
                errorBoostLimitNumberElement.val(presetJson[presetSelected]['emu_boost_limit']).trigger('input');

                var errorBoostYawNumberElement = $('input[name="errorBoostYaw-number"]');
                errorBoostYawNumberElement.val(presetJson[presetSelected]['emu_boost_yaw']).trigger('input');

                var errorBoostLimitYawNumberElement = $('input[name="errorBoostLimitYaw-number"]');
                errorBoostLimitYawNumberElement.val(presetJson[presetSelected]['emu_boost_limit_yaw']).trigger('input');

                //dBoost and iRelaxV2 presets //msp 1.49
                // if non-existing preset, use hardcoded defaults
                if (semver.gte(CONFIG.apiVersion, "1.49.0")) {
                    if (typeof presetJson[presetSelected]['dterm_boost'] === 'undefined' || presetJson[presetSelected]['dterm_boost'] === null) {
                        // variable is undefined or null (non-exist)
                        $('input[name="dtermBoost-number"]').val('0');
                    } else {
                        // preset exists, so use it.
                        $('input[name="dtermBoost-number"]').val(presetJson[presetSelected]['dterm_boost']);
                    }

                    if (typeof presetJson[presetSelected]['dterm_boost_limit'] === 'undefined' || presetJson[presetSelected]['dterm_boost_limit'] === null) {
                        // variable is undefined or null (non-exist)
                        $('input[name="dtermBoostLimit-number"]').val('0');
                    } else {
                        // preset exists, so use it.
                        $('input[name="dtermBoostLimit-number"]').val(presetJson[presetSelected]['dterm_boost_limit']);
                    }

                    if (typeof presetJson[presetSelected]['iterm_relax2_cutoff'] === 'undefined' || presetJson[presetSelected]['iterm_relax2_cutoff'] === null) {
                        // variable is undefined or null (non-exist)
                        $('input[name="iRelax-number"]').val('11');
                    } else {
                        // preset exists, so use it.
                        $('input[name="iRelax-number"]').val(presetJson[presetSelected]['iterm_relax2_cutoff']);
                    }

                    if (typeof presetJson[presetSelected]['iterm_relax2_cutoff_yaw'] === 'undefined' || presetJson[presetSelected]['iterm_relax2_cutoff_yaw'] === null) {
                        // variable is undefined or null (non-exist)
                        $('input[name="iRelaxYaw-number"]').val('25');
                    } else {
                        // preset exists, so use it.
                        $('input[name="iRelaxYaw-number"]').val(presetJson[presetSelected]['iterm_relax2_cutoff_yaw']);
                    }
                } //end - dBoost and iRelaxV2 presets //msp 1.49

                $('input[name="featheredPids-number"]').val(presetJson[presetSelected]['feathered_pids']);
                $('input[id="itermrotation"]').prop('checked', presetJson[presetSelected]['iterm_rotation'] !== "OFF").change();
                $('input[id="vbatpidcompensation"]').prop('checked', presetJson[presetSelected]['vbat_pid_gain'] !== "OFF").change();
                $('input[id="smartfeedforward"]').prop('checked', presetJson[presetSelected]['smart_feedforward'] !== "OFF").change();
                $('input[id="itermrelax"]').prop('checked', presetJson[presetSelected]['iterm_relax_enabled'] !== "OFF").change();
                $('select[id="itermrelaxAxes"]').val(presetJson[presetSelected]['iterm_relax'] + 1);
                $('select[id="itermrelaxType"]').val(presetJson[presetSelected]['iterm_relax_type']);
                $('input[name="itermRelaxCutoff"]').val(presetJson[presetSelected]['iterm_relax_cutoff']);

                // TPA settings
                $('.tpa input[name="tpa_P"]').val(presetJson[presetSelected]['tpa_rate_p'] / 100);
                $('.tpa input[name="tpa_I"]').val(presetJson[presetSelected]['tpa_rate_i'] / 100);
                $('.tpa input[name="tpa_D"]').val(presetJson[presetSelected]['tpa_rate_d'] / 100);
                $('.tpa input[name="tpa-breakpoint"]').val(presetJson[presetSelected]['tpa_breakpoint']);

                if (semver.gte(CONFIG.apiVersion, "1.43.0")) {
                    // spa settings
                    if (semver.gte(CONFIG.apiVersion, "1.44.0")) {
                        $('.spa_roll input[name="spaRoll_P"]').val(presetJson[presetSelected]['spa_rate_p_roll']);
                        $('.spa_roll input[name="spaRoll_I"]').val(presetJson[presetSelected]['spa_rate_i_roll']);
                        $('.spa_roll input[name="spaRoll_D"]').val(presetJson[presetSelected]['spa_rate_d_roll']);
                        $('.spa_pitch input[name="spaPitch_P"]').val(presetJson[presetSelected]['spa_rate_p_pitch']);
                        $('.spa_pitch input[name="spaPitch_I"]').val(presetJson[presetSelected]['spa_rate_i_pitch']);
                        $('.spa_pitch input[name="spaPitch_D"]').val(presetJson[presetSelected]['spa_rate_d_pitch']);
                    } else {
                        $('.spa input[name="spa_P"]').val(presetJson[presetSelected]['spa_rate_p']);
                        $('.spa input[name="spa_I"]').val(presetJson[presetSelected]['spa_rate_i']);
                        $('.spa input[name="spa_D"]').val(presetJson[presetSelected]['spa_rate_d']);
                    }
                    $('.spa_yaw input[name="spaYaw_P"]').val(presetJson[presetSelected]['spa_rate_p_yaw']);
                    $('.spa_yaw input[name="spaYaw_I"]').val(presetJson[presetSelected]['spa_rate_i_yaw']);
                    $('.spa_yaw input[name="spaYaw_D"]').val(presetJson[presetSelected]['spa_rate_d_yaw']);
                }


                // pid preset values
                PID_names.forEach(function(elementPid, indexPid) {
                    // Look into the PID table to a row with the name of the pid
                    var searchRow = $('.pid_tuning .' + elementPid + ' input');
                    // Assign each value
                    searchRow.each(function(indexInput) {
                        // roll values
                        if (indexPid == 0) {
                            if (indexInput == 0) {
                                $(this).val(presetJson[presetSelected]['p_roll']);
                            }
                            if (indexInput == 1) {
                                $(this).val(presetJson[presetSelected]['i_roll']);
                            }
                            if (indexInput == 2) {
                                $(this).val(presetJson[presetSelected]['d_roll']);
                            }
                            if (indexInput == 3) {
                                $(this).val(presetJson[presetSelected]['f_roll']);
                            }
                        }
                        //pitch values
                        if (indexPid == 1) {
                            if (indexInput == 0) {
                                $(this).val(presetJson[presetSelected]['p_pitch']);
                            }
                            if (indexInput == 1) {
                                $(this).val(presetJson[presetSelected]['i_pitch']);
                            }
                            if (indexInput == 2) {
                                $(this).val(presetJson[presetSelected]['d_pitch']);
                            }
                            if (indexInput == 3) {
                                $(this).val(presetJson[presetSelected]['f_pitch']);
                            }
                        }
                        // yaw values
                        if (indexPid == 2) {
                            if (indexInput == 0) {
                                $(this).val(presetJson[presetSelected]['p_yaw']);
                            }
                            if (indexInput == 1) {
                                $(this).val(presetJson[presetSelected]['i_yaw']);
                            }
                            if (indexInput == 2) {
                                $(this).val(presetJson[presetSelected]['d_yaw']);
                            }
                            if (indexInput == 3) {
                                $(this).val(presetJson[presetSelected]['f_yaw']);
                            }
                        }
                    });
                });
            }
        });

        if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
            $('.tab-pid_tuning select[name="rate_profile"]').change(function() {
                self.currentRateProfile = parseInt($(this).val());
                self.updating = true;
                $(this).prop('disabled', 'true');
                MSP.promise(MSPCodes.MSP_SELECT_SETTING, [self.currentRateProfile + self.RATE_PROFILE_MASK]).then(function() {
                    self.refresh(function() {
                        self.updating = false;

                        $('.tab-pid_tuning select[name="rate_profile"]').prop('disabled', 'false');
                        CONFIG.rateProfile = self.currentRateProfile;

                        GUI.log(i18n.getMessage('pidTuningLoadedRateProfile', [self.currentRateProfile + 1]));
                    });
                });
            });

            var dtermTransitionNumberElement = $('input[name="dtermSetpointTransition-number"]');
            var dtermTransitionWarningElement = $('#pid-tuning .dtermSetpointTransitionWarning');

            function checkUpdateDtermTransitionWarning(value) {
                if (value > 0 && value < 0.1) {
                    dtermTransitionWarningElement.show();
                } else {
                    dtermTransitionWarningElement.hide();
                }
            }
            checkUpdateDtermTransitionWarning(dtermTransitionNumberElement.val());

            //Use 'input' event for coupled controls to allow synchronized update
            dtermTransitionNumberElement.on('input', function() {
                checkUpdateDtermTransitionWarning($(this).val());
            });

        } else {
            $('.tab-pid_tuning .rate_profile').hide();

            $('#pid-tuning .dtermSetpointTransition').hide();
            $('#pid-tuning .dtermSetpoint').hide();
        }

        if (!semver.gte(CONFIG.apiVersion, "1.16.0")) {
            $('#pid-tuning .delta').hide();
            $('.tab-pid_tuning .note').hide();
        }

        // Add a name to each row of PIDs if empty
        $('.pid_tuning tr').each(function() {
            for (i = 0; i < PID_names.length; i++) {
                if ($(this).hasClass(PID_names[i])) {
                    var firstColumn = $(this).find('td:first');
                    if (!firstColumn.text()) {
                        firstColumn.text(PID_names[i]);
                    }
                }
            }
        });

        // DTerm filter options
        function loadFilterTypeValues() {
            var filterTypeValues = [];
            filterTypeValues.push("PT1");
            filterTypeValues.push("BIQUAD");
            if (semver.lte(CONFIG.apiVersion, "1.41.0")) {
                filterTypeValues.push("KALMAN");
            }
            if (semver.lt(CONFIG.apiVersion, "1.39.0")) {
                filterTypeValues.push("FIR");
            }
            if (semver.gte(CONFIG.apiVersion, "1.51.0")) {
                filterTypeValues.push("PT2");
                filterTypeValues.push("PT3");
                filterTypeValues.push("PT4");
            }
            return filterTypeValues;
        }

        function populateFilterTypeSelector(name, selectDtermValues) {
            var dtermFilterSelect = $('select[name="' + name + '"]');
            selectDtermValues.forEach(function(value, key) {
                dtermFilterSelect.append('<option value="' + key + '">' + value + '</option>');
            });
        }

        populateFilterTypeSelector('gyroLowpassType', loadFilterTypeValues());
        populateFilterTypeSelector('gyroLowpassDynType', loadFilterTypeValues());
        populateFilterTypeSelector('gyroLowpass2Type', loadFilterTypeValues());
        populateFilterTypeSelector('dtermLowpassType', loadFilterTypeValues());
        populateFilterTypeSelector('dtermLowpass2Type', loadFilterTypeValues());
        //populateFilterTypeSelector('dtermLowpassDynType', loadFilterTypeValues());

        // MSP 1.51
        // MotorMixer Implementation
        function loadMotorMixerImplValues() {
            var motorMixerImplValues = [];
            motorMixerImplValues.push("LEGACY");
            motorMixerImplValues.push("SMOOTH");
            motorMixerImplValues.push("2PASS");
            return motorMixerImplValues;
        }

        function populateMotorMixerImplSelector(name, selectMotorMixerImplValues) {
            var motorMixerImplSelect = $('select[name="' + name + '"]');
            selectMotorMixerImplValues.forEach(function(value, key) {
                motorMixerImplSelect.append('<option value="' + key + '">' + value + '</option>');
            });
        }

        populateMotorMixerImplSelector('MotorMixerImplSelect', loadMotorMixerImplValues());
        //end MSP 1.51

        // MSP 1.51
        // RC Rates Types
        function loadRCRatesTypeValues() {
            var rcRatesTypeValues = [];
            rcRatesTypeValues.push("BETAFLIGHT"); //0
            rcRatesTypeValues.push("RACEFLIGHT"); //1
            rcRatesTypeValues.push("KISS");       //2
            rcRatesTypeValues.push("ACTUAL");     //3
            return rcRatesTypeValues;
        }

        function populateRCRatesTypeSelector(name, selectRCRatesTypeValues) {
            var rcRatesTypeSelect = $('select[name="' + name + '"]');
            selectRCRatesTypeValues.forEach(function(value, key) {
                rcRatesTypeSelect.append('<option value="' + key + '">' + value + '</option>');
            });
        }

        populateRCRatesTypeSelector('rcRatesTypeSelect', loadRCRatesTypeValues());
        //end MSP 1.51

        pid_and_rc_to_form();

        var pidController_e = $('select[name="controller"]');

        if (semver.lt(CONFIG.apiVersion, "1.31.0")) {
            var pidControllerList;
            if (semver.lt(CONFIG.apiVersion, "1.14.0")) {
                pidControllerList = [{
                    name: "MultiWii (Old)"
                }, {
                    name: "MultiWii (rewrite)"
                }, {
                    name: "LuxFloat"
                }, {
                    name: "MultiWii (2.3 - latest)"
                }, {
                    name: "MultiWii (2.3 - hybrid)"
                }, {
                    name: "Harakiri"
                }]
            } else if (semver.lt(CONFIG.apiVersion, "1.20.0")) {
                pidControllerList = [{
                    name: ""
                }, {
                    name: "Integer"
                }, {
                    name: "Float"
                }]
            } else {
                pidControllerList = [{
                    name: "Legacy"
                }, {
                    name: "Emuflight"
                }]
            }

            for (var i = 0; i < pidControllerList.length; i++) {
                pidController_e.append('<option value="' + (i) + '">' + pidControllerList[i].name + '</option>');
            }

            if (semver.gte(CONFIG.apiVersion, CONFIGURATOR.pidControllerChangeMinApiVersion)) {
                pidController_e.val(PID.controller);

                self.updatePidControllerParameters();
            } else {
                GUI.log(i18n.getMessage('pidTuningUpgradeFirmwareToChangePidController', [CONFIG.apiVersion, CONFIGURATOR.pidControllerChangeMinApiVersion]));

                pidController_e.empty();
                pidController_e.append('<option value="">Unknown</option>');

                pidController_e.prop('disabled', true);
            }
        } else {
            $('.tab-pid_tuning div.controller').hide();

            self.updatePidControllerParameters();
        }

        if (semver.lt(CONFIG.apiVersion, "1.7.0")) {
            $('.tpa .tpa-breakpoint').hide();

            $('.pid_tuning .roll_rate').hide();
            $('.pid_tuning .pitch_rate').hide();
        } else {
            $('.pid_tuning .roll_pitch_rate').hide();
        }

        if (semver.gte(CONFIG.apiVersion, "1.37.0")) {
            $('.pid_tuning .bracket').hide();
            $('.pid_tuning input[name=rc_rate]').parent().attr('class', 'pid_data');
            $('.pid_tuning input[name=rc_rate]').parent().attr('rowspan', 1);
            $('.pid_tuning input[name=rc_expo]').parent().attr('class', 'pid_data');
            $('.pid_tuning input[name=rc_expo]').parent().attr('rowspan', 1);
        } else {
            $('.pid_tuning input[name=rc_rate_pitch]').parent().hide();
            $('.pid_tuning input[name=rc_pitch_expo]').parent().hide();
        }

        if (useLegacyCurve) {
            $('.new_rates').hide();
        }

        // rateDynamincs (Stick-pids)
        if (semver.gte(CONFIG.apiVersion, "1.46.0")) {
            $('.rateDynamics input[name="rateSensCenter-number"]').val(RC_tuning.rateSensCenter);
            $('.rateDynamics input[name="rateSensEnd-number"]').val(RC_tuning.rateSensEnd);
            $('.rateDynamics input[name="rateCorrectionCenter-number"]').val(RC_tuning.rateCorrectionCenter);
            $('.rateDynamics input[name="rateCorrectionEnd-number"]').val(RC_tuning.rateCorrectionEnd);
            $('.rateDynamics input[name="rateWeightCenter-number"]').val(RC_tuning.rateWeightCenter);
            $('.rateDynamics input[name="rateWeightEnd-number"]').val(RC_tuning.rateWeightEnd);
        } else {
            $('.rateDynamics').hide();
        }

        //MSP 1.51
        if ( semver.gte(CONFIG.apiVersion, "1.51.0") ) {
            $('.DualAxisSteering input[name="addRollToYawRc-number"]').val(RC_tuning.addRollToYawRc); //.pid_tuning  //#DualAxisSteering
            $('.DualAxisSteering input[name="addYawToRollRc-number"]').val(RC_tuning.addYawToRollRc); //.pid_tuning  //#DualAxisSteering
            $('.DualAxisSteering').show();
        } else {
            $('.DualAxisSteering').hide();
        }
        //end MSP 1.51


        // Getting the DOM elements for curve display
        var rcCurveElement = $('.rate_curve canvas#rate_curve_layer0').get(0),
            curveContext = rcCurveElement.getContext("2d"),
            updateNeeded = true,
            maxAngularVel;

        // make these variables global scope so that they can be accessed by the updateRates function.
        self.maxAngularVelRollElement = $('.pid_tuning .maxAngularVelRoll');
        self.maxAngularVelPitchElement = $('.pid_tuning .maxAngularVelPitch');
        self.maxAngularVelYawElement = $('.pid_tuning .maxAngularVelYaw');

        rcCurveElement.width = 1000;
        rcCurveElement.height = 1000;

        function updateRates(event) {
            setTimeout(function() { // let global validation trigger and adjust the values first
                if (event) { // if an event is passed, then use it
                    var targetElement = $(event.target),
                        targetValue = checkInput(targetElement);

                    if (self.currentRates.hasOwnProperty(targetElement.attr('name')) && targetValue !== undefined) {
                        //MSP 1.51
                        const stepValue = parseFloat(targetElement.prop('step')); // adjust value to match step (change only the result, not the the actual value)
                        if (stepValue != null) {
                            targetValue = Math.round(targetValue / stepValue) * stepValue;
                        }
                        self.currentRates[targetElement.attr('name')] = targetValue;
                        updateNeeded = true;
                    }

                    if (targetElement.attr('name') === 'rc_rate' && semver.lt(CONFIG.apiVersion, "1.16.0")) {
                        self.currentRates.rc_rate_yaw = targetValue;
                    }

                    if (targetElement.attr('name') === 'roll_pitch_rate' && semver.lt(CONFIG.apiVersion, "1.7.0")) {
                        self.currentRates.roll_rate = targetValue;
                        self.currentRates.pitch_rate = targetValue;
                        updateNeeded = true;
                    }

                    if (targetElement.attr('name') === 'SUPEREXPO_RATES') {
                        self.currentRates.superexpo = targetElement.is(':checked');
                        updateNeeded = true;
                    }

                    if (targetElement.attr('name') === 'rc_rate' && semver.lt(CONFIG.apiVersion, "1.37.0")) {
                        self.currentRates.rc_rate_pitch = targetValue;
                    }

                    if (targetElement.attr('name') === 'rc_expo' && semver.lt(CONFIG.apiVersion, "1.37.0")) {
                        self.currentRates.rc_pitch_expo = targetValue;
                    }

                    //MSP 1.51
                    if (targetElement.attr('id') === 'rcRatesTypeSelect' && semver.gte(CONFIG.apiVersion, "1.51.0")) {
                        self.changeRatesType(targetValue);
                        updateNeeded = true;
                        console.log('changeRatesType targetvalue: '+targetValue+'+ updateNeeded: '+updateNeeded);
                    }
                    //end MSP 1.51
                } else { // no event was passed, just force a graph update
                    updateNeeded = true;
                }
                if (updateNeeded) {
                    var curveHeight = rcCurveElement.height;
                    var curveWidth = rcCurveElement.width;
                    var lineScale = curveContext.canvas.width / curveContext.canvas.clientWidth;

                    curveContext.clearRect(0, 0, curveWidth, curveHeight);

                    if (!useLegacyCurve) {
                        maxAngularVel = Math.max(
                            printMaxAngularVel(self.currentRates.roll_rate, self.currentRates.rc_rate, self.currentRates.rc_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.roll_rate_limit, self.maxAngularVelRollElement),
                            printMaxAngularVel(self.currentRates.pitch_rate, self.currentRates.rc_rate_pitch, self.currentRates.rc_pitch_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.pitch_rate_limit, self.maxAngularVelPitchElement),
                            printMaxAngularVel(self.currentRates.yaw_rate, self.currentRates.rc_rate_yaw, self.currentRates.rc_yaw_expo, self.currentRates.superexpo, self.currentRates.yawDeadband, self.currentRates.yaw_rate_limit, self.maxAngularVelYawElement));

                        // make maxAngularVel multiple of 200deg/s so that the auto-scale doesn't keep changing for small changes of the maximum curve
                        maxAngularVel = self.rateCurve.setMaxAngularVel(maxAngularVel);

                        drawAxes(curveContext, curveWidth, curveHeight);
                    } else {
                        maxAngularVel = 0;
                    }

                    curveContext.lineWidth = 2 * lineScale;
                    drawCurve(self.currentRates.roll_rate, self.currentRates.rc_rate, self.currentRates.rc_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.roll_rate_limit, maxAngularVel, '#ff0000', 0, curveContext);
                    drawCurve(self.currentRates.pitch_rate, self.currentRates.rc_rate_pitch, self.currentRates.rc_pitch_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.pitch_rate_limit, maxAngularVel, '#00ff00', -4, curveContext);
                    drawCurve(self.currentRates.yaw_rate, self.currentRates.rc_rate_yaw, self.currentRates.rc_yaw_expo, self.currentRates.superexpo, self.currentRates.yawDeadband, self.currentRates.yaw_rate_limit, maxAngularVel, '#0000ff', 4, curveContext);

                    self.updateRatesLabels();

                    updateNeeded = false;
                }
            }, 0);
        }

        // UI Hooks
        // curves
        $('input.feature').on('input change', updateRates);
        $('.pid_tuning').on('input change', updateRates).trigger('input');

        $('.throttle input').on('input change', function() {
            setTimeout(function() { // let global validation trigger and adjust the values first
                var throttleMidE = $('.throttle input[name="mid"]'),
                    throttleExpoE = $('.throttle input[name="expo"]'),
                    mid = parseFloat(throttleMidE.val()),
                    expo = parseFloat(throttleExpoE.val()),
                    throttleCurve = $('.throttle .throttle_curve canvas').get(0),
                    context = throttleCurve.getContext("2d");

                // local validation to deal with input event
                if (mid >= parseFloat(throttleMidE.prop('min')) &&
                    mid <= parseFloat(throttleMidE.prop('max')) &&
                    expo >= parseFloat(throttleExpoE.prop('min')) &&
                    expo <= parseFloat(throttleExpoE.prop('max'))) {
                    // continue
                } else {
                    return;
                }

                var canvasHeight = throttleCurve.height;
                var canvasWidth = throttleCurve.width;

                // math magic by englishman
                var midx = canvasWidth * mid,
                    midxl = midx * 0.5,
                    midxr = (((canvasWidth - midx) * 0.5) + midx),
                    midy = canvasHeight - (midx * (canvasHeight / canvasWidth)),
                    midyl = canvasHeight - ((canvasHeight - midy) * 0.5 * (expo + 1)),
                    midyr = (midy / 2) * (expo + 1);

                // draw
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.beginPath();
                context.moveTo(0, canvasHeight);
                context.quadraticCurveTo(midxl, midyl, midx, midy);
                context.moveTo(midx, midy);
                context.quadraticCurveTo(midxr, midyr, canvasWidth, 0);
                context.lineWidth = 2;
                context.strokeStyle = '#2297eb';
                context.stroke();
            }, 0);
        }).trigger('input');

        $('a.refresh').click(function() {
            self.refresh(function() {
                GUI.log(i18n.getMessage('pidTuningDataRefreshed'));
            });
        });

        $('#pid-tuning').find('input').each(function(k, item) {
            if ($(item).attr('class') !== "feature toggle" &&
                $(item).attr('class') !== "nonProfile") {
                $(item).change(function() {
                    self.setDirty(true);
                });
            }
        });

        var dialogCopyProfile = $('.dialogCopyProfile')[0];
        var DIALOG_MODE_PROFILE = 0;
        var DIALOG_MODE_RATEPROFILE = 1;
        var dialogCopyProfileMode;

        if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
            var selectProfile = $('.selectProfile');
            var selectRateProfile = $('.selectRateProfile');

            $.each(selectProfileValues, function(key, value) {
                if (key != CONFIG.profile)
                    selectProfile.append(new Option(value, key));
            });
            $.each(selectRateProfileValues, function(key, value) {
                if (key != CONFIG.rateProfile)
                    selectRateProfile.append(new Option(value, key));
            });

            $('.copyprofilebtn').click(function() {
                $('.dialogCopyProfile').find('.contentProfile').show();
                $('.dialogCopyProfile').find('.contentRateProfile').hide();
                dialogCopyProfileMode = DIALOG_MODE_PROFILE;
                dialogCopyProfile.showModal();
            });

            $('.copyrateprofilebtn').click(function() {
                $('.dialogCopyProfile').find('.contentProfile').hide();
                $('.dialogCopyProfile').find('.contentRateProfile').show();
                dialogCopyProfileMode = DIALOG_MODE_RATEPROFILE;
                dialogCopyProfile.showModal();
            });

            $('.dialogCopyProfile-cancelbtn').click(function() {
                dialogCopyProfile.close();
            });

            $('.dialogCopyProfile-confirmbtn').click(function() {
                switch (dialogCopyProfileMode) {
                    case DIALOG_MODE_PROFILE:
                        COPY_PROFILE.type = DIALOG_MODE_PROFILE; // 0 = pid profile
                        COPY_PROFILE.dstProfile = parseInt(selectProfile.val());
                        COPY_PROFILE.srcProfile = CONFIG.profile;

                        MSP.send_message(MSPCodes.MSP_COPY_PROFILE, mspHelper.crunch(MSPCodes.MSP_COPY_PROFILE), false, close_dialog);

                        break;

                    case DIALOG_MODE_RATEPROFILE:
                        COPY_PROFILE.type = DIALOG_MODE_RATEPROFILE; // 1 = rate profile
                        COPY_PROFILE.dstProfile = parseInt(selectRateProfile.val());
                        COPY_PROFILE.srcProfile = CONFIG.rateProfile;

                        MSP.send_message(MSPCodes.MSP_COPY_PROFILE, mspHelper.crunch(MSPCodes.MSP_COPY_PROFILE), false, close_dialog);

                        break;

                    default:
                        close_dialog();
                        break;
                }

                function close_dialog() {
                    dialogCopyProfile.close();
                }
            });
        } else {
            $('.copyprofilebtn').hide();
            $('.copyrateprofilebtn').hide();
        }

        if (semver.gte(CONFIG.apiVersion, "1.16.0")) {
            $('#pid-tuning .delta select').change(function() {
                self.setDirty(true);
            });
        }

        if (semver.lt(CONFIG.apiVersion, "1.31.0")) {
            pidController_e.change(function() {
                self.setDirty(true);

                self.updatePidControllerParameters();
            });
        }

        // update == save.
        $('a.update').click(function() {
            form_to_pid_and_rc();

            self.updating = true;
            Promise.resolve(true)
                .then(function() {
                    var promise;
                    if (semver.gte(CONFIG.apiVersion, CONFIGURATOR.pidControllerChangeMinApiVersion) && semver.lt(CONFIG.apiVersion, "1.31.0")) {
                        PID.controller = pidController_e.val();
                        promise = MSP.promise(MSPCodes.MSP_SET_PID_CONTROLLER, mspHelper.crunch(MSPCodes.MSP_SET_PID_CONTROLLER));
                    }
                    return promise;
                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_SET_PID, mspHelper.crunch(MSPCodes.MSP_SET_PID));
                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_SET_PID_ADVANCED, mspHelper.crunch(MSPCodes.MSP_SET_PID_ADVANCED));
                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_SET_FILTER_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_FILTER_CONFIG));
                }).then(function() {
                    if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
                        if (CONFIG.boardIdentifier !== "HESP" && CONFIG.boardIdentifier !== "SX10" && CONFIG.boardIdentifier !== "FLUX" && semver.lt(CONFIG.apiVersion, "1.42.0")) {
                            return MSP.promise(MSPCodes.MSP_SET_FAST_KALMAN, mspHelper.crunch(MSPCodes.MSP_SET_FAST_KALMAN));
                        } else {
                            return MSP.promise(MSPCodes.MSP_SET_IMUF_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_IMUF_CONFIG));
                        }
                    }

                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_SET_RC_TUNING, mspHelper.crunch(MSPCodes.MSP_SET_RC_TUNING));
                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_SET_EMUF, mspHelper.crunch(MSPCodes.MSP_SET_EMUF));
                }).then(function() {
                    if (save_and_reboot == true) {
                        return MSP.promise(MSPCodes.MSP_SET_ADVANCED_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_ADVANCED_CONFIG));
                    }
                }).then(function() {
                    if (save_and_reboot == true) {
                        return MSP.promise(MSPCodes.MSP_SET_FEATURE_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_FEATURE_CONFIG));
                    }
                }).then(function() {
                    return MSP.promise(MSPCodes.MSP_EEPROM_WRITE);
                }).then(function() {
                    self.updating = false;
                    self.setDirty(false);

                    GUI.log(i18n.getMessage('pidTuningEepromSaved'));
                }).then(function() {
                    //GUI.log(i18n.getMessage('configurationEepromSaved'));
                    if (save_and_reboot == true) {
                        GUI.tab_switch_cleanup(function() {

                            MSP.send_message(MSPCodes.MSP_SET_REBOOT, false, false);
                            reinitialiseConnection(self);
                        });
                    }
                });
        });

        // Setup model for rates preview
        self.initRatesPreview();
        self.renderModel();

        self.updating = false;

        // enable RC data pulling for rates preview
        GUI.interval_add('receiver_pull', self.getRecieverData, true);

        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function status_pull() {
            MSP.send_message(MSPCodes.MSP_STATUS);
        }, 250, true);

        GUI.content_ready(callback);
    }
}; //end TABS.pid_tuning.initialize = function

TABS.pid_tuning.getRecieverData = function() {
    MSP.send_message(MSPCodes.MSP_RC, false, false);
};

TABS.pid_tuning.initRatesPreview = function() {
    this.keepRendering = true;
    this.model = new Model($('.rates_preview'), $('.rates_preview canvas'));

    $('.tab-pid_tuning .tab_container .rates').on('click', $.proxy(this.model.resize, this.model));
    $('.tab-pid_tuning .tab_container .rates').on('click', $.proxy(this.updateRatesLabels, this));

    $(window).on('resize', $.proxy(this.model.resize, this.model));
    $(window).on('resize', $.proxy(this.updateRatesLabels, this));
};

TABS.pid_tuning.renderModel = function() {
    if (this.keepRendering) {
        requestAnimationFrame(this.renderModel.bind(this));
    }

    if (!this.clock) {
        this.clock = new THREE.Clock();
    }

    if (RC.channels[0] && RC.channels[1] && RC.channels[2]) {
        var delta = this.clock.getDelta();

        var roll = delta * this.rateCurve.rcCommandRawToDegreesPerSecond(RC.channels[0], this.currentRates.roll_rate, this.currentRates.rc_rate, this.currentRates.rc_expo, this.currentRates.superexpo, this.currentRates.deadband, this.currentRates.roll_rate_limit),
            pitch = delta * this.rateCurve.rcCommandRawToDegreesPerSecond(RC.channels[1], this.currentRates.pitch_rate, this.currentRates.rc_rate_pitch, this.currentRates.rc_pitch_expo, this.currentRates.superexpo, this.currentRates.deadband, this.currentRates.pitch_rate_limit),
            yaw = delta * this.rateCurve.rcCommandRawToDegreesPerSecond(RC.channels[2], this.currentRates.yaw_rate, this.currentRates.rc_rate_yaw, this.currentRates.rc_yaw_expo, this.currentRates.superexpo, this.currentRates.yawDeadband, this.currentRates.yaw_rate_limit);

        this.model.rotateBy(-degToRad(pitch), -degToRad(yaw), -degToRad(roll));

        if (this.checkRC()) this.updateRatesLabels(); // has the RC data changed ?
    }
};

TABS.pid_tuning.cleanup = function(callback) {
    var self = this;
    if (self.model) {
        $(window).off('resize', $.proxy(self.model.resize, self.model));
    }
    $(window).off('resize', $.proxy(this.updateRatesLabels, this));
    self.keepRendering = false;
    if (callback) callback();
};

TABS.pid_tuning.refresh = function(callback) {
    var self = this;
    GUI.tab_switch_cleanup(function() {
        self.initialize();
        self.setDirty(false);
        if (callback) {
            callback();
        }
    });
};

TABS.pid_tuning.setProfile = function() {
    var self = this;
    self.currentProfile = CONFIG.profile;
    $('.tab-pid_tuning select[name="profile"]').val(self.currentProfile);
};

TABS.pid_tuning.setRateProfile = function() {
    var self = this;
    self.currentRateProfile = CONFIG.rateProfile;
    $('.tab-pid_tuning select[name="rate_profile"]').val(self.currentRateProfile);
};

TABS.pid_tuning.setDirty = function(isDirty) {
    var self = this;
    self.dirty = isDirty;
    $('.tab-pid_tuning select[name="profile"]').prop('disabled', isDirty);
    if (semver.gte(CONFIG.apiVersion, "1.20.0")) {
        $('.tab-pid_tuning select[name="rate_profile"]').prop('disabled', isDirty);
    }
};

TABS.pid_tuning.checkUpdateProfile = function(updateRateProfile) {
    var self = this;

    if (GUI.active_tab === 'pid_tuning') {

        if (!self.updating && !self.dirty) {
            var changedProfile = false;
            if (self.currentProfile !== CONFIG.profile) {
                self.setProfile();
                changedProfile = true;
            }

            var changedRateProfile = false;
            if (semver.gte(CONFIG.apiVersion, "1.20.0") &&
                updateRateProfile &&
                self.currentRateProfile !== CONFIG.rateProfile) {
                self.setRateProfile();
                changedRateProfile = true;
            }

            if (changedProfile || changedRateProfile) {
                self.refresh(function() {
                    if (changedProfile) {
                        GUI.log(i18n.getMessage('pidTuningReceivedProfile', [CONFIG.profile + 1]));
                        CONFIG.profile = self.currentProfile;
                    }

                    if (changedRateProfile) {
                        GUI.log(i18n.getMessage('pidTuningReceivedRateProfile', [CONFIG.rateProfile + 1]));
                        CONFIG.rateProfile = self.currentRateProfile
                    }
                });
            }
        }
    }
};

TABS.pid_tuning.checkRC = function() {
    // Function monitors for change in the primary axes rc received data and returns true if a change is detected.

    if (!this.oldRC) {
        this.oldRC = [RC.channels[0], RC.channels[1], RC.channels[2]];
    }

    // Monitor RC.channels and detect change of value;
    var rateCurveUpdateRequired = false;
    for (var i = 0; i < this.oldRC.length; i++) { // has the value changed ?
        if (this.oldRC[i] != RC.channels[i]) {
            this.oldRC[i] = RC.channels[i];
            rateCurveUpdateRequired = true; // yes, then an update of the values displayed on the rate curve graph is required
        }
    }
    return rateCurveUpdateRequired;
};

TABS.pid_tuning.updatePidControllerParameters = function() {
    if (semver.gte(CONFIG.apiVersion, "1.20.0") && semver.lt(CONFIG.apiVersion, "1.31.0") && $('.tab-pid_tuning select[name="controller"]').val() === '0') {
        $('.pid_tuning .YAW_JUMP_PREVENTION').show();
        $('#pid-tuning .delta').show();
        $('#pid-tuning .dtermSetpointTransition').hide();
        $('#pid-tuning .dtermSetpoint').hide();
    } else {
        $('.pid_tuning .YAW_JUMP_PREVENTION').hide();
        if (semver.gte(CONFIG.apiVersion, "1.40.0")) {
            $('#pid-tuning .dtermSetpointTransition').hide();
            $('#pid-tuning .dtermSetpoint').hide();
        } else {
            $('#pid-tuning .dtermSetpointTransition').show();
            $('#pid-tuning .dtermSetpoint').show();
        }
        $('#pid-tuning .delta').hide();
    }
};

TABS.pid_tuning.updateRatesLabels = function() {
    var self = this;
    if (!self.rateCurve.useLegacyCurve && self.rateCurve.maxAngularVel) {
        var drawAxisLabel = function(context, axisLabel, x, y, align, color) {
            context.fillStyle = color || '#000000';
            context.textAlign = align || 'center';
            context.fillText(axisLabel, x, y);
        };

        var drawBalloonLabel = function(context, axisLabel, x, y, align, colors, dirty) {

            /**
             * curveContext is the canvas to draw on
             * axisLabel is the string to display in the center of the balloon
             * x, y are the coordinates of the point of the balloon
             * align is whether the balloon appears to the left (align 'right') or right (align left) of the x,y coordinates
             * colors is an object defining color, border and text are the fill color, border color and text color of the balloon
             */

            const DEFAULT_OFFSET = 125; // in canvas scale; this is the horizontal length of the pointer
            const DEFAULT_RADIUS = 10; // in canvas scale, this is the radius around the balloon
            const DEFAULT_MARGIN = 5; // in canvas scale, this is the margin around the balloon when it overlaps

            const fontSize = parseInt(context.font);

            // calculate the width and height required for the balloon
            const width = (context.measureText(axisLabel).width * 1.2);
            const height = fontSize * 1.5; // the balloon is bigger than the text height
            const pointerY = y; // always point to the required Y
            // coordinate, even if we move the balloon itself to keep it on the canvas

            // setup balloon background
            context.fillStyle = colors.color || '#ffffff';
            context.strokeStyle = colors.border || '#000000';

            // correct x position to account for window scaling
            x *= context.canvas.clientWidth / context.canvas.clientHeight;

            // adjust the coordinates for determine where the balloon background should be drawn
            x += ((align == 'right') ? -(width + DEFAULT_OFFSET) : 0) + ((align == 'left') ? DEFAULT_OFFSET : 0);
            y -= (height / 2);
            if (y < 0) y = 0;
            else if (y > context.height) y = context.height; // prevent balloon from going out of canvas

            // check that the balloon does not already overlap
            for (var i = 0; i < dirty.length; i++) {
                if ((x >= dirty[i].left && x <= dirty[i].right) || (x + width >= dirty[i].left && x + width <= dirty[i].right)) { // does it overlap horizontally
                    if ((y >= dirty[i].top && y <= dirty[i].bottom) || (y + height >= dirty[i].top && y + height <= dirty[i].bottom)) { // this overlaps another balloon
                        // snap above or snap below
                        if (y <= (dirty[i].bottom - dirty[i].top) / 2 && (dirty[i].top - height) > 0) {
                            y = dirty[i].top - height;
                        } else { // snap down
                            y = dirty[i].bottom;
                        }
                    }
                }
            }

            // Add the draw area to the dirty array
            dirty.push({
                left: x,
                right: x + width,
                top: y - DEFAULT_MARGIN,
                bottom: y + height + DEFAULT_MARGIN
            });

            var pointerLength = (height - 2 * DEFAULT_RADIUS) / 6;

            context.beginPath();
            context.moveTo(x + DEFAULT_RADIUS, y);
            context.lineTo(x + width - DEFAULT_RADIUS, y);
            context.quadraticCurveTo(x + width, y, x + width, y + DEFAULT_RADIUS);

            if (align == 'right') { // point is to the right
                context.lineTo(x + width, y + DEFAULT_RADIUS + pointerLength);
                context.lineTo(x + width + DEFAULT_OFFSET, pointerY); // point
                context.lineTo(x + width, y + height - DEFAULT_RADIUS - pointerLength);
            }
            context.lineTo(x + width, y + height - DEFAULT_RADIUS);

            context.quadraticCurveTo(x + width, y + height, x + width - DEFAULT_RADIUS, y + height);
            context.lineTo(x + DEFAULT_RADIUS, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - DEFAULT_RADIUS);

            if (align == 'left') { // point is to the left
                context.lineTo(x, y + height - DEFAULT_RADIUS - pointerLength);
                context.lineTo(x - DEFAULT_OFFSET, pointerY); // point
                context.lineTo(x, y + DEFAULT_RADIUS - pointerLength);
            }
            context.lineTo(x, y + DEFAULT_RADIUS);

            context.quadraticCurveTo(x, y, x + DEFAULT_RADIUS, y);
            context.closePath();

            // fill in the balloon background
            context.fill();
            context.stroke();

            // and add the label
            drawAxisLabel(context, axisLabel, x + (width / 2), y + (height + fontSize) / 2 - 4, 'center', colors.text);

        };

        const BALLOON_COLORS = {
            roll: {
                color: 'rgba(255,128,128,0.4)',
                border: 'rgba(255,128,128,0.6)',
                text: '#000000'
            },
            pitch: {
                color: 'rgba(128,255,128,0.4)',
                border: 'rgba(128,255,128,0.6)',
                text: '#000000'
            },
            yaw: {
                color: 'rgba(128,128,255,0.4)',
                border: 'rgba(128,128,255,0.6)',
                text: '#000000'
            }
        };

        var rcStickElement = $('.rate_curve canvas#rate_curve_layer1').get(0);
        if (rcStickElement) {
            rcStickElement.width = 1000;
            rcStickElement.height = 1000;
            var stickContext = rcStickElement.getContext("2d");

            stickContext.save();

            var
                maxAngularVelRoll = self.maxAngularVelRollElement.text() + ' deg/s',
                maxAngularVelPitch = self.maxAngularVelPitchElement.text() + ' deg/s',
                maxAngularVelYaw = self.maxAngularVelYawElement.text() + ' deg/s',
                currentValues = [],
                balloonsDirty = [],
                curveHeight = rcStickElement.height,
                curveWidth = rcStickElement.width,
                maxAngularVel = self.rateCurve.maxAngularVel,
                windowScale = (400 / stickContext.canvas.clientHeight),
                rateScale = (curveHeight / 2) / maxAngularVel,
                lineScale = stickContext.canvas.width / stickContext.canvas.clientWidth,
                textScale = stickContext.canvas.clientHeight / stickContext.canvas.clientWidth;

            stickContext.clearRect(0, 0, curveWidth, curveHeight);

            // calculate the fontSize based upon window scaling
            if (windowScale <= 1) {
                stickContext.font = "24pt Verdana, Arial, sans-serif";
            } else {
                stickContext.font = (24 * windowScale) + "pt Verdana, Arial, sans-serif";
            }

            if (RC.channels[0] && RC.channels[1] && RC.channels[2]) {
                currentValues.push(self.rateCurve.drawStickPosition(RC.channels[0], self.currentRates.roll_rate, self.currentRates.rc_rate, self.currentRates.rc_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.roll_rate_limit, maxAngularVel, stickContext, '#FF8080') + ' deg/s');
                currentValues.push(self.rateCurve.drawStickPosition(RC.channels[1], self.currentRates.pitch_rate, self.currentRates.rc_rate_pitch, self.currentRates.rc_pitch_expo, self.currentRates.superexpo, self.currentRates.deadband, self.currentRates.pitch_rate_limit, maxAngularVel, stickContext, '#80FF80') + ' deg/s');
                currentValues.push(self.rateCurve.drawStickPosition(RC.channels[2], self.currentRates.yaw_rate, self.currentRates.rc_rate_yaw, self.currentRates.rc_yaw_expo, self.currentRates.superexpo, self.currentRates.yawDeadband, self.currentRates.yaw_rate_limit, maxAngularVel, stickContext, '#8080FF') + ' deg/s');
            } else {
                currentValues = [];
            }

            stickContext.lineWidth = lineScale;

            // use a custom scale so that the text does not appear stretched
            stickContext.scale(textScale, 1);

            // add the maximum range label
            drawAxisLabel(stickContext, maxAngularVel.toFixed(0) + ' deg/s', ((curveWidth / 2) - 10) / textScale, parseInt(stickContext.font) * 1.2, 'right');

            // and then the balloon labels.
            balloonsDirty = []; // reset the dirty balloon draw area (for overlap detection)
            // create an array of balloons to draw
            var balloons = [{
                value: parseInt(maxAngularVelRoll),
                balloon: function() {
                    drawBalloonLabel(stickContext, maxAngularVelRoll, curveWidth, rateScale * (maxAngularVel - parseInt(maxAngularVelRoll)), 'right', BALLOON_COLORS.roll, balloonsDirty);
                }
            }, {
                value: parseInt(maxAngularVelPitch),
                balloon: function() {
                    drawBalloonLabel(stickContext, maxAngularVelPitch, curveWidth, rateScale * (maxAngularVel - parseInt(maxAngularVelPitch)), 'right', BALLOON_COLORS.pitch, balloonsDirty);
                }
            }, {
                value: parseInt(maxAngularVelYaw),
                balloon: function() {
                    drawBalloonLabel(stickContext, maxAngularVelYaw, curveWidth, rateScale * (maxAngularVel - parseInt(maxAngularVelYaw)), 'right', BALLOON_COLORS.yaw, balloonsDirty);
                }
            }];
            // and sort them in descending order so the largest value is at the top always
            balloons.sort(function(a, b) {
                return (b.value - a.value)
            });

            // add the current rc values
            if (currentValues[0] && currentValues[1] && currentValues[2]) {
                balloons.push({
                    value: parseInt(currentValues[0]),
                    balloon: function() {
                        drawBalloonLabel(stickContext, currentValues[0], 10, 150, 'none', BALLOON_COLORS.roll, balloonsDirty);
                    }
                }, {
                    value: parseInt(currentValues[1]),
                    balloon: function() {
                        drawBalloonLabel(stickContext, currentValues[1], 10, 250, 'none', BALLOON_COLORS.pitch, balloonsDirty);
                    }
                }, {
                    value: parseInt(currentValues[2]),
                    balloon: function() {
                        drawBalloonLabel(stickContext, currentValues[2], 10, 350, 'none', BALLOON_COLORS.yaw, balloonsDirty);
                    }
                });
            }
            // then display them on the chart
            for (var i = 0; i < balloons.length; i++) balloons[i].balloon();

            stickContext.restore();
        }
    }
};

TABS.pid_tuning.updateFilterWarning = function() {
    var gyroDynamicLowpassEnabled = $('input[id="gyroLowpassDynEnabled"]').is(':checked');
    var gyroLowpass1Enabled = $('input[id="gyroLowpassEnabled"]').is(':checked');
    var dtermLowpass1Enabled = $('input[id="dtermLowpassEnabled"]').is(':checked');
    var warning_e = $('#pid-tuning .filterWarning');
    if (!(gyroDynamicLowpassEnabled || gyroLowpass1Enabled) || !dtermLowpass1Enabled) {
        if (CONFIG.boardIdentifier == "HESP" || CONFIG.boardIdentifier == "SX10" || CONFIG.boardIdentifier == "FLUX") {
            warning_e.hide();
        } else {
            warning_e.show();
        }
    } else {
        warning_e.hide();
    }

}

//MSP 1.51
TABS.pid_tuning.changeRatesType = function(rateTypeID) {
    const self = this;
    let sameRatesType = true;
    self.currentRatesType = rateTypeID;
    if (self.currentRatesType !== RC_tuning.rates_type) {
        sameRatesType = false;
        //debug
        console.log('changing rates type from '+RC_tuning.rates_type+' to '+self.currentRatesType);
    } else {
        //debug
        console.log('no change of rates type: '+RC_tuning.rates_type+' to '+self.currentRatesType);
    }
    //debug
    console.log('called changeRatesType with rateTypeID '+rateTypeID+' sameRatesType is '+sameRatesType);
    self.changeRatesSystem(sameRatesType);
};
TABS.pid_tuning.changeRatesSystem = function(sameType) {
    console.log('changeRatesSystem with parameter sameType = '+sameType)
    const self = this;
    let rcRateMax = 2.55, rcRateMin = 0.01, rcRateStep = 0.01;
    let rateMax = 1.0, rateStep = 0.01;
    let expoMax = 1.0, expoStep = 0.01;
    const rateMin = 0;
    const expoMin = 0;
    const pitch_rate_e = $('.pid_tuning input[name="pitch_rate"]');
    const roll_rate_e = $('.pid_tuning input[name="roll_rate"]');
    const yaw_rate_e = $('.pid_tuning input[name="yaw_rate"]');
    const rc_rate_pitch_e = $('.pid_tuning input[name="rc_rate_pitch"]');
    const rc_rate_e = $('.pid_tuning input[name="rc_rate"]');
    const rc_rate_yaw_e = $('.pid_tuning input[name="rc_rate_yaw"]');
    const rc_pitch_expo_e = $('.pid_tuning input[name="rc_pitch_expo"]');
    const rc_expo_e = $('.pid_tuning input[name="rc_expo"]');
    const rc_yaw_expo_e = $('.pid_tuning input[name="rc_yaw_expo"]');
    const rcRateLabel = $('#pid-tuning .pid_titlebar .rc_rate');
    const rateLabel = $('#pid-tuning .pid_titlebar .rate');
    const rcExpoLabel = $('#pid-tuning .pid_titlebar .rc_expo');
    // default values for betaflight curve. all the default values produce the same betaflight default curve (or at least near enough)
    let rcRateDefault = (1).toFixed(2), rateDefault = (0.7).toFixed(2), expoDefault = (0).toFixed(2);
    if (sameType) { // if selected rates type is different from the saved one, set values to default instead of reading
        pitch_rate_e.val(RC_tuning.pitch_rate.toFixed(2));
        roll_rate_e.val(RC_tuning.roll_rate.toFixed(2));
        yaw_rate_e.val(RC_tuning.yaw_rate.toFixed(2));
        rc_rate_pitch_e.val(RC_tuning.rcPitchRate.toFixed(2));
        rc_rate_e.val(RC_tuning.RC_RATE.toFixed(2));
        rc_rate_yaw_e.val(RC_tuning.rcYawRate.toFixed(2));
        rc_pitch_expo_e.val(RC_tuning.RC_PITCH_EXPO.toFixed(2));
        rc_expo_e.val(RC_tuning.RC_EXPO.toFixed(2));
        rc_yaw_expo_e.val(RC_tuning.RC_YAW_EXPO.toFixed(2));
    }
    switch(self.currentRatesType) {
        case 1: //raceflight
            rcRateLabel.text(i18n.getMessage("pidTuningRcRateRaceflight"));
            rateLabel.text(i18n.getMessage("pidTuningRateRaceflight"));
            rcExpoLabel.text(i18n.getMessage("pidTuningRcExpoRaceflight"));
            rcRateMax = 2000;
            rcRateMin = 10;
            rcRateStep = 10;
            rateMax = 255;
            rateStep = 1;
            expoMax = 100;
            expoStep = 1;
            if (sameType) {
                console.log('raceflight sameType');
                pitch_rate_e.val((RC_tuning.pitch_rate * 100).toFixed(0));
                roll_rate_e.val((RC_tuning.roll_rate * 100).toFixed(0));
                yaw_rate_e.val((RC_tuning.yaw_rate * 100).toFixed(0));
                rc_rate_pitch_e.val((RC_tuning.rcPitchRate * 1000).toFixed(0));
                rc_rate_e.val((RC_tuning.RC_RATE * 1000).toFixed(0));
                rc_rate_yaw_e.val((RC_tuning.rcYawRate * 1000).toFixed(0));
                rc_pitch_expo_e.val((RC_tuning.RC_PITCH_EXPO * 100).toFixed(0));
                rc_expo_e.val((RC_tuning.RC_EXPO * 100).toFixed(0));
                rc_yaw_expo_e.val((RC_tuning.RC_YAW_EXPO * 100).toFixed(0));
            } else {
                console.log('raceflight not sameType');
                rcRateDefault = (370).toFixed(0);
                rateDefault = (80).toFixed(0);
                expoDefault = (50).toFixed(0);
            }
            break;
        case 2: //kiss
            console.log('kiss');
            rcRateLabel.text(i18n.getMessage("pidTuningRcRate"));
            rateLabel.text(i18n.getMessage("pidTuningRcRateRaceflight"));
            rcExpoLabel.text(i18n.getMessage("pidTuningRcExpoKISS"));
            rateMax = 0.99;
            break;
        case 3: //actual
            rcRateLabel.text(i18n.getMessage("pidTuningRcRateActual"));
            rateLabel.text(i18n.getMessage("pidTuningRateQuickRates"));
            rcExpoLabel.text(i18n.getMessage("pidTuningRcExpoRaceflight"));
            rateMax = 2000;
            rateStep = 10;
            rcRateMax = 2000;
            rcRateMin = 10;
            rcRateStep = 10;
            if (sameType) {
                console.log('actual sameType');
                pitch_rate_e.val((RC_tuning.pitch_rate * 1000).toFixed(0));
                roll_rate_e.val((RC_tuning.roll_rate * 1000).toFixed(0));
                yaw_rate_e.val((RC_tuning.yaw_rate * 1000).toFixed(0));
                rc_rate_pitch_e.val((RC_tuning.rcPitchRate * 1000).toFixed(0));
                rc_rate_e.val((RC_tuning.RC_RATE * 1000).toFixed(0));
                rc_rate_yaw_e.val((RC_tuning.rcYawRate * 1000).toFixed(0));
            } else {
                console.log('actual not sameType');
                rcRateDefault = (200).toFixed(0);
                rateDefault = (670).toFixed(0);
                expoDefault = (0.54).toFixed(2);
            }
            break;
        // add future rates types here
        default: // BetaFlight
            console.log('betaflight');
            rcRateLabel.text(i18n.getMessage("pidTuningRcRate"));
            rateLabel.text(i18n.getMessage("pidTuningRate"));
            rcExpoLabel.text(i18n.getMessage("pidTuningRcExpo"));
            break;
    }
    const rc_rate_input_c = $('#pid-tuning input[class="rc_rate_input"]');
    const rate_input_c = $('#pid-tuning input[class="rate_input"]');
    const expo_input_c = $('#pid-tuning input[class="expo_input"]');
    if (!sameType) {
        rate_input_c.val(rateDefault);
        rc_rate_input_c.val(rcRateDefault);
        expo_input_c.val(expoDefault);
    }
    rc_rate_input_c.attr({"max":rcRateMax, "min":rcRateMin, "step":rcRateStep}).change();
    rate_input_c.attr({"max":rateMax, "min":rateMin, "step":rateStep}).change();
    expo_input_c.attr({"max":expoMax, "min":expoMin, "step":expoStep}).change();
    if (sameType) {
        self.setDirty(false);
    }
};
//end MSP 1.51


TABS.pid_tuning.cleanup = function (callback) {
    this.keepRendering = false;
    if (callback) callback();
};
