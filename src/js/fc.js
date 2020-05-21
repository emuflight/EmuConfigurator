'use strict';

// define all the global variables that are uses to hold FC state
var CONFIG;
var BF_CONFIG;          // Remove when we officialy retire BF 3.1
var FEATURE_CONFIG;
var BEEPER_CONFIG;
var MIXER_CONFIG;
var BOARD_ALIGNMENT_CONFIG;
var LED_STRIP;
var LED_COLORS;
var LED_MODE_COLORS;
var PID;
var PID_names;
var PIDs;
var RC_MAP;
var RC;
var RC_tuning;
var EMUF_ADVANCED;
var AUX_CONFIG;
var AUX_CONFIG_IDS;
var MODE_RANGES;
var MODE_RANGES_EXTRA;
var ADJUSTMENT_RANGES;
var SERVO_CONFIG;
var SERVO_RULES;
var SERIAL_CONFIG;
var SENSOR_DATA;
var MOTOR_DATA;
var SERVO_DATA;
var GPS_DATA;
var ANALOG;
var VOLTAGE_METERS;
var VOLTAGE_METER_CONFIGS;
var CURRENT_METERS;
var CURRENT_METER_CONFIGS;
var BATTERY_STATE;
var BATTERY_CONFIG;
var ARMING_CONFIG;
var FC_CONFIG;
var MISC; // DEPRECATED
var MOTOR_CONFIG;
var GPS_CONFIG;
var COMPASS_CONFIG;
var RSSI_CONFIG;
var MOTOR_3D_CONFIG;
var DATAFLASH;
var SDCARD;
var BLACKBOX;
var TRANSPONDER;
var RC_DEADBAND_CONFIG;
var SENSOR_ALIGNMENT;
var RX_CONFIG;
var FAILSAFE_CONFIG;
var GPS_RESCUE;
var RXFAIL_CONFIG;
var PID_ADVANCED_CONFIG;
var FILTER_CONFIG;
var IMUF_FILTER_CONFIG;
var KALMAN_FILTER_CONFIG;
var ADVANCED_TUNING;
var SENSOR_CONFIG;
var COPY_PROFILE;
var DEFAULT;

var FC = {
    resetState: function () {
        CONFIG = {
            apiVersion:                       "0.0.0",
            flightControllerIdentifier:       '',
            flightControllerVersion:          '',
            version:                          0,
            buildInfo:                        '',
            multiType:                        0,
            msp_version:                      0, // not specified using semantic versioning
            capability:                       0,
            cycleTime:                        0,
            i2cError:                         0,
            activeSensors:                    0,
            mode:                             0,
            profile:                          0,
            uid:                              [0, 0, 0],
            accelerometerTrims:               [0, 0],
            name:                             '',
            displayName:                      'JOE PILOT',
            numProfiles:                      3,
            rateProfile:                      0,
            boardType:                        0,
            armingDisableCount:               0,
            armingDisableFlags:               0,
            armingDisabled:                   false,
            runawayTakeoffPreventionDisabled: false,
            boardIdentifier:                  "",
            boardVersion:                     0,
            commCapabilities:                 0,
            targetName:                       "",
            boardName:                        "",
            manufacturerId:                   "",
            signature:                        [],
            mcuTypeId:                        255,
        };

        BF_CONFIG = {
            currentscale:               0,
            currentoffset:              0,
            currentmetertype:           0,
            batterycapacity:            0,
        };

        COPY_PROFILE = {
            type:                       0,
            dstProfile:                 0,
            srcProfile:                 0,
        };

        FEATURE_CONFIG = {
            features:                   0,
        };

        BEEPER_CONFIG = {
            beepers:                    0,
            dshotBeaconTone:            0,
            dshotBeaconConditions:      0,
        };

        MIXER_CONFIG = {
            mixer:                      0,
            reverseMotorDir:            0,
        };

        BOARD_ALIGNMENT_CONFIG = {
            roll:                       0,
            pitch:                      0,
            yaw:                        0,
        };

        LED_STRIP =                     [];
        LED_COLORS =                    [];
        LED_MODE_COLORS =               [];

        PID = {
            controller:                 0
        };

        PID_names =                     [];
        PIDs = new Array(10);
        for (var i = 0; i < 10; i++) {
            PIDs[i] = new Array(3);
        }

        RC_MAP = [];

        // defaults
        // roll, pitch, yaw, throttle, aux 1, ... aux n
        RC = {
            active_channels:            0,
            channels:                   new Array(32),
        };

        RC_tuning = {
            RC_RATE:                    0,
            RC_EXPO:                    0,
            roll_pitch_rate:            0, // pre 1.7 api only
            roll_rate:                  0,
            pitch_rate:                 0,
            yaw_rate:                   0,
            dynamic_THR_PID_P:          0,
            throttle_MID:               0,
            throttle_EXPO:              0,
            dynamic_THR_breakpoint:     0,
            RC_YAW_EXPO:                0,
            rcYawRate:                  0,
            rcPitchRate:                0,
            RC_PITCH_EXPO:              0,
            roll_rate_limit:            1998,
            pitch_rate_limit:           1998,
            yaw_rate_limit:             1998,
        };

        EMUF_ADVANCED = {
          dynamic_THR_PID_I:            0,
          dynamic_THR_PID_D:            0,
        };

        AUX_CONFIG =                    [];
        AUX_CONFIG_IDS =                [];

        MODE_RANGES =                   [];
        MODE_RANGES_EXTRA =             [];
        ADJUSTMENT_RANGES =             [];

        SERVO_CONFIG =                  [];
        SERVO_RULES =                   [];

        SERIAL_CONFIG = {
            ports:                      [],

            // pre 1.6 settings
            mspBaudRate:                0,
            gpsBaudRate:                0,
            gpsPassthroughBaudRate:     0,
            cliBaudRate:                0,
        };

        SENSOR_DATA = {
            gyroscope:                  [0, 0, 0],
            accelerometer:              [0, 0, 0],
            magnetometer:               [0, 0, 0],
            altitude:                   0,
            sonar:                      0,
            kinematics:                 [0.0, 0.0, 0.0],
            debug:                      [0, 0, 0, 0],
        };

        MOTOR_DATA =                    new Array(8);
        SERVO_DATA =                    new Array(8);

        GPS_DATA = {
            fix:                        0,
            numSat:                     0,
            lat:                        0,
            lon:                        0,
            alt:                        0,
            speed:                      0,
            ground_course:              0,
            distanceToHome:             0,
            ditectionToHome:            0,
            update:                     0,

            chn:                        [],
            svid:                       [],
            quality:                    [],
            cno:                        []
        };

        ANALOG = {
            voltage:                    0,
            mAhdrawn:                   0,
            rssi:                       0,
            amperage:                   0,
            last_received_timestamp:    Date.now() // FIXME this code lies, it's never been received at this point
        };

        VOLTAGE_METERS =                [];
        VOLTAGE_METER_CONFIGS =         [];
        CURRENT_METERS =                [];
        CURRENT_METER_CONFIGS =         [];

        BATTERY_STATE = {};
        BATTERY_CONFIG = {
            vbatmincellvoltage:         0,
            vbatmaxcellvoltage:         0,
            vbatwarningcellvoltage:     0,
            capacity:                   0,
            voltageMeterSource:         0,
            currentMeterSource:         0,
        };

        ARMING_CONFIG = {
            auto_disarm_delay:          0,
            disarm_kill_switch:         0,
            small_angle:                0,
        };

        FC_CONFIG = {
            loopTime:                   0
        };

        MISC = {
            // DEPRECATED = only used to store values that are written back to the fc as-is, do NOT use for any other purpose
            failsafe_throttle:          0,
            gps_baudrate:               0,
            multiwiicurrentoutput:      0,
            placeholder2:               0,
            vbatscale:                  0,
            vbatmincellvoltage:         0,
            vbatmaxcellvoltage:         0,
            vbatwarningcellvoltage:     0,
            batterymetertype:           1, // 1=ADC, 2=ESC
        };
        MOTOR_CONFIG = {
            minthrottle:                0,
            maxthrottle:                0,
            mincommand:                 0,
        };

        GPS_CONFIG = {
            provider:                   0,
            ublox_sbas:                 0,
            auto_config:                0,
            auto_baud:                  0,
        };

        COMPASS_CONFIG = {
            mag_declination:            0,
        };

        RSSI_CONFIG = {
            channel:                    0,
        };

        MOTOR_3D_CONFIG = {
            deadband3d_low:             0,
            deadband3d_high:            0,
            neutral:                    0,
        };

        DATAFLASH = {
            ready:                      false,
            supported:                  false,
            sectors:                    0,
            totalSize:                  0,
            usedSize:                   0
        };

        SDCARD = {
            supported:                  false,
            state:                      0,
            filesystemLastError:        0,
            freeSizeKB:                 0,
            totalSizeKB:                0,
        };

        BLACKBOX = {
            supported:                  false,
            blackboxDevice:             0,
            blackboxRateNum:            1,
            blackboxRateDenom:          1,
            blackboxPDenom:             0,
        };

        TRANSPONDER = {
            supported:                  false,
            data:                       [],
            provider:                   0,
            providers:                  [],
        };

        RC_DEADBAND_CONFIG = {
            deadband:                   0,
            yaw_deadband:               0,
            alt_hold_deadband:          0,
            deadband3d_throttle:        0,
        };

        SENSOR_ALIGNMENT = {
            align_gyro:                 0,
            align_acc:                  0,
            align_mag:                  0,
            gyro_detection_flags:       0,
            gyro_to_use:                0,
            gyro_1_align:               0,
            gyro_2_align:               0,
        };

        PID_ADVANCED_CONFIG = {
            gyro_sync_denom:            0,
            pid_process_denom:          0,
            use_unsyncedPwm:            0,
            fast_pwm_protocol:          0,
            motor_pwm_rate:             0,
            digitalIdlePercent:         0,
            gyroUse32kHz:               0,
            motorPwmInversion:          0,
            gyroToUse:                  0,
            gyroHighFsr:                0,
            gyroMovementCalibThreshold: 0,
            gyroCalibDuration:          0,
            gyroOffsetYaw:              0,
            gyroCheckOverflow:          0,
            debugMode:                  0,
            debugModeCount:             0,
        };

        FILTER_CONFIG = {
            gyro_hardware_lpf:          0,
            gyro_32khz_hardware_lpf:    0,
            gyro_lowpass_hz:            0,
            dterm_dyn_lpf:              0,
            gyro_dyn_lpf:               0,
            gyro_lowpass_dyn_min_hz:    0,
            gyro_lowpass_dyn_max_hz:    0,
            gyro_lowpass_type:          0,
            gyro_lowpass2_hz:           0,
            gyro_lowpass2_type:         0,
            gyro_notch_hz:              0,
            gyro_notch_cutoff:          0,
            gyro_notch2_hz:             0,
            gyro_notch2_cutoff:         0,
            dterm_lowpass_hz:           0,
            dterm_lowpass_dyn_min_hz:   0,
            dterm_lowpass_dyn_max_hz:   0,
            dterm_lowpass_type:         0,
            dterm_lowpass2_hz:          0,
            dterm_lowpass2_type:        0,
            dterm_notch_hz:             0,
            dterm_notch_cutoff:         0,
            yaw_lowpass_hz:             0,
            dyn_notch_range:            0,
            dyn_notch_width_percent:    0,
            dyn_notch_q:                0,
            dyn_notch_min_hz:           0,
            dynamic_gyro_notch_q:       0,
            dynamic_gyro_notch_min_hz:  0,
        };

        IMUF_FILTER_CONFIG = {
            imuf_mode:                  0,
            imuf_roll_q:                0,
            imuf_pitch_q:               0,
            imuf_yaw_q:                 0,
            imuf_w:                     0,
            imuf_roll_lpf_cutoff_hz:    0,
            imuf_pitch_lpf_cutoff_hz:   0,
            imuf_yaw_lpf_cutoff_hz:     0,
            imuf_acc_lpf_cutoff_hz:     0,
        };

        KALMAN_FILTER_CONFIG = {
            gyro_filter_q:              0,
            gyro_filter_w:              0,
        };

        ADVANCED_TUNING = {
            rollPitchItermIgnoreRate:   0,
            yawItermIgnoreRate:         0,
            errorBoost:                 0,
            feathered_pids:             0,
            vbatPidCompensation:        0,
            dtermSetpointTransition:    0,
            errorBoostLimit:            0,
            iDecay:                     0,
            toleranceBandReduction:     0,
            itermThrottleGain:          0,
            pidMaxVelocity:             0,
            pidMaxVelocityYaw:          0,
            levelAngleLimit:            0,
            levelSensitivity:           0,
            itermThrottleThreshold:     0,
            itermAcceleratorGain:       0,
            itermRotation:              0,
            smartFeedforward:           0,
            itermRelax:                 0,
            itermRelaxType:             0,
            absoluteControlGain:        0,
            throttleBoost:              0,
            acroTrainerAngleLimit:      0,
            feedforwardRoll:            0,
            feedforwardPitch:           0,
            feedforwardYaw:             0,
            feedforwardTransition:      0,
            antiGravityMode:            0,
            itermRelaxCutoff:           0,
            errorBoostYaw:              0,
            errorBoostLimitYaw:         0,
            setPointPTransition:        0,
            setPointITransition:        0,
            setPointDTransition:        0,
            setPointPTransitionRoll:    0,
            setPointITransitionRoll:    0,
            setPointDTransitionRoll:    0,
            setPointPTransitionPitch:   0,
            setPointITransitionPitch:   0,
            setPointDTransitionPitch:   0,
            setPointPTransitionYaw:     0,
            setPointITransitionYaw:     0,
            setPointDTransitionYaw:     0,
            nfe_racermode:              0,
        };

        SENSOR_CONFIG = {
            acc_hardware:               0,
            baro_hardware:              0,
            mag_hardware:               0,
        };

        RX_CONFIG = {
            serialrx_provider:          0,
            stick_max:                  0,
            stick_center:               0,
            stick_min:                  0,
            spektrum_sat_bind:          0,
            cinematicYaw:               0,
            rx_min_usec:                0,
            rx_max_usec:                0,
            rcInterpolation:            0,
            rcInterpolationInterval:    0,
            rcInterpolationChannels:    0,
            airModeActivateThreshold:   0,
            rxSpiProtocol:              0,
            rxSpiId:                    0,
            rxSpiRfChannelCount:        0,
            fpvCamAngleDegrees:         0,
            rcSmoothingType:            0,
            rcSmoothingInputCutoff:     0,
            rcSmoothingDerivativeCutoff:0,
            rcSmoothingInputType:       0,
            rcSmoothingDerivativeType:  0,
        };

        FAILSAFE_CONFIG = {
            failsafe_delay:             0,
            failsafe_off_delay:         0,
            failsafe_throttle:          0,
            failsafe_switch_mode:       0,
            failsafe_throttle_low_delay:0,
            failsafe_procedure:         0,
        };

        GPS_RESCUE = {
            angle:                      0,
            initialAltitude:            0,
            descentDistance:            0,
            rescueGroundspeed:          0,
            throttleMin:                0,
            throttleMax:                0,
            throttleHover:              0,
            sanityChecks:               0,
            minSats:                    0,
        };

        RXFAIL_CONFIG = [];

        DEFAULT = {
            gyro_lowpass_hz:                100,
            gyro_lowpass_dyn_min_hz:        150,
            gyro_lowpass_dyn_max_hz:        450,
            gyro_lowpass_type:              FC.FILTER_TYPE_FLAGS.PT1,
            gyro_lowpass2_hz:               300,
            gyro_lowpass2_type:             FC.FILTER_TYPE_FLAGS.PT1,
            gyro_notch_cutoff:              300,
            gyro_notch_hz:                  400,
            gyro_notch2_cutoff:             100,
            gyro_notch2_hz:                 200,
            dterm_lowpass_hz:               100,
            dterm_lowpass_dyn_min_hz:       150,
            dterm_lowpass_dyn_max_hz:       250,
            dterm_lowpass_type:             FC.FILTER_TYPE_FLAGS.PT1,
            dterm_lowpass2_hz:              150,
            dterm_lowpass2_type:            FC.FILTER_TYPE_FLAGS.BIQUAD,
            dterm_notch_cutoff:             160,
            dterm_notch_hz:                 260,
            yaw_lowpass_hz:                 100,
            dterm_dyn_lpf:                  100,
            gyro_dyn_lpf:                   100,
        };
    },

    getHardwareName: function () {
        let name;
        if (CONFIG.targetName) {
            name = CONFIG.targetName;
        } else {
            name = CONFIG.boardIdentifier;
        }

        if (CONFIG.boardName && CONFIG.boardName !== name) {
            name = CONFIG.boardName + "(" + name + ")";
        }

        if (CONFIG.manufacturerId) {
            name = CONFIG.manufacturerId + "/" + name;
        }

        return name;
    },

    MCU_TYPES: {
        0: "SIMULATOR",
        1: "F103",
        2: "F303",
        3: "F40X",
        4: "F411",
        5: "F446",
        6: "F722",
        7: "F745",
        8: "F746",
        9: "F765",
        255: "Unknown MCU",
    },

    getMcuType: function () {
        return FC.MCU_TYPES[CONFIG.mcuTypeId];
    },

    COMM_CAPABILITIES_FLAGS: {
        HAS_VCP: 0x01,
        HAS_SOFTSERIAL: 0x02,
    },

    boardHasVcp: function () {
        var hasVcp = false;
        if (semver.gte(CONFIG.apiVersion, "1.37.0")) {
            hasVcp = (CONFIG.commCapabilities & FC.COMM_CAPABILITIES_FLAGS.HAS_VCP) !== 0;
        } else {
            hasVcp = BOARD.find_board_definition(CONFIG.boardIdentifier).vcp;
        }

        return hasVcp;
    },

    FILTER_TYPE_FLAGS: {
        PT1: 0,
        BIQUAD: 1,
    },

    getFilterDefaults: function() {
        var versionFilterDefaults = DEFAULT;

        if (semver.eq(CONFIG.apiVersion, "1.40.0")) {
            versionFilterDefaults.dterm_lowpass2_hz = 200;
        }
        return versionFilterDefaults;
    },
};
