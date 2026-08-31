"use strict";

var
    CHANNEL_MIN_VALUE = 1000,
    CHANNEL_MID_VALUE = 1500,
    CHANNEL_MAX_VALUE = 2000,

    // Same fallback the Receiver tab's own channel bars use (receiver.js num_bars).
    AUX_COUNT = Math.max(0, ((opener.RC && opener.RC.active_channels > 0) ? opener.RC.active_channels : 8) - 4),

    // What's the index of each channel in the MSP channel list?
    channelMSPIndexes = {
        Roll: 0,
        Pitch: 1,
        Throttle: 2,
        Yaw: 3,
    },

    // Set reasonable initial/safe stick positions (Mode 2); also what Disable resets to.
    DEFAULT_STICK_VALUES = {
        Throttle: CHANNEL_MIN_VALUE,
        Pitch: CHANNEL_MID_VALUE,
        Roll: CHANNEL_MID_VALUE,
        Yaw: CHANNEL_MID_VALUE,
    },

    stickValues,

    // First the vertical axis, then the horizontal:
    gimbals = [
        ["Throttle", "Yaw"],
        ["Pitch", "Roll"],
    ],

    gimbalElems,
    sliderElems,

    enableTX = false;

for (var auxIndex = 1; auxIndex <= AUX_COUNT; auxIndex++) {
    channelMSPIndexes["Aux" + auxIndex] = 3 + auxIndex;
    DEFAULT_STICK_VALUES["Aux" + auxIndex] = CHANNEL_MIN_VALUE;
}
stickValues = Object.assign({}, DEFAULT_STICK_VALUES);

// This is a hack to get the i18n var of the parent, but the localizePage not works
const i18n = opener.i18n;

$(document).ready(function () {
    // Match the main window's current light/dark theme; this popup doesn't
    // get its own DarkTheme.js instance to react to later toggles.
    document.getElementById('mainDarkCss').disabled = !(opener.DarkTheme && opener.DarkTheme.configEnabled);

    $('[i18n]:not(.i18n-replaced)').each(function() {
        var element = $(this);

        element.html(i18n.getMessage(element.attr('i18n')));
        element.addClass('i18n-replaced');
    });
})

function buildChannelValues() {
    var
        channelValues = new Array(4 + AUX_COUNT).fill(0);

    for (var stickName in stickValues) {
        channelValues[channelMSPIndexes[stickName]] = stickValues[stickName];
    }

    return channelValues;
}

function transmitChannels() {
    if (!enableTX) {
        // Not transmitting, so setRawRx (which would also re-arm the FC's RC override)
        // is never called here -- check the connection directly instead, so a stale,
        // disabled popup still closes itself if the FC disconnects.
        if (opener.CONFIGURATOR && !opener.CONFIGURATOR.connectionValid) {
            window.close();
        }
        return;
    }

    // Callback given to us by the window creator so we can have it send data over MSP for us:
    if (!window.setRawRx(buildChannelValues())) {
        // MSP connection has gone away
        window.close();
    }
}

function stickPortionToChannelValue(portion) {
    portion = Math.min(Math.max(portion, 0.0), 1.0);
    
    return Math.round(portion * (CHANNEL_MAX_VALUE - CHANNEL_MIN_VALUE) + CHANNEL_MIN_VALUE);
}

function channelValueToStickPortion(channel) {
    return (channel - CHANNEL_MIN_VALUE) / (CHANNEL_MAX_VALUE - CHANNEL_MIN_VALUE);
}

function updateControlPositions() {
    for (var stickName in stickValues) {
        var
            stickValue = stickValues[stickName];
        
        // Look for the gimbal which corresponds to this stick name
        for (var gimbalIndex in gimbals) {
            var 
                gimbal = gimbals[gimbalIndex],
                gimbalElem = gimbalElems.get(gimbalIndex),
                gimbalSize = $(gimbalElem).width(),
                stickElem = $(".control-stick", gimbalElem);
            
            if (gimbal[0] === stickName) {
                stickElem.css('top', (1.0 - channelValueToStickPortion(stickValue)) * gimbalSize + "px");
                break;
            } else if (gimbal[1] === stickName) {
                stickElem.css('left', channelValueToStickPortion(stickValue) * gimbalSize + "px");
                break;
            }
        }
    }
}

function handleGimbalMouseDrag(e) {
    var 
        gimbal = $(gimbalElems.get(e.data.gimbalIndex)),
        gimbalOffset = gimbal.offset(),
        gimbalSize = gimbal.width();
    
    stickValues[gimbals[e.data.gimbalIndex][0]] = stickPortionToChannelValue(1.0 - (e.pageY - gimbalOffset.top) / gimbalSize);
    stickValues[gimbals[e.data.gimbalIndex][1]] = stickPortionToChannelValue((e.pageX - gimbalOffset.left) / gimbalSize);
    
    updateControlPositions();
}

function localizeAxisNames() {
    for (var gimbalIndex in gimbals) {
        var 
            gimbal = gimbalElems.get(gimbalIndex);
        
        $(".gimbal-label-vert", gimbal).text(i18n.getMessage("controlAxis" + gimbals[gimbalIndex][0]));
        $(".gimbal-label-horz", gimbal).text(i18n.getMessage("controlAxis" + gimbals[gimbalIndex][1]));
    }
    
    for (var sliderIndex = 0; sliderIndex < AUX_COUNT; sliderIndex++) {
        $(".slider-label", sliderElems.get(sliderIndex)).text(i18n.getMessage("controlAxisAux" + (sliderIndex + 1)));
    }
}

function setButtonLabel(enabled) {
    $(".button-enable .btn").text(i18n.getMessage(enabled ? "receiverMspDisableButton" : "receiverMspEnableButton"));
}

$(document).ready(function() {
    $(".button-enable .btn").click(function() {
        if (enableTX) {
            // Disable: reset to safe defaults and push one final frame before we stop sending.
            stickValues = Object.assign({}, DEFAULT_STICK_VALUES);
            updateControlPositions();
            $(".slider", sliderElems).each(function(sliderIndex) {
                $(this).val(CHANNEL_MIN_VALUE);
                $(".tooltip", this).text(CHANNEL_MIN_VALUE);
            });
            if (!window.setRawRx(buildChannelValues())) {
                // MSP connection has gone away
                window.close();
            }
            enableTX = false;
        } else {
            enableTX = true;
        }
        setButtonLabel(enableTX);
    });

    var slidersContainer = $(".control-sliders");
    for (var sliderCount = 0; sliderCount < AUX_COUNT; sliderCount++) {
        slidersContainer.append('<div class="control-slider"><div class="slider"><span class="slider-label"></span></div></div>');
    }

    gimbalElems = $(".control-gimbal");
    sliderElems = $(".control-slider");

    gimbalElems.each(function(gimbalIndex) {
        $(this).on('mousedown', {gimbalIndex: gimbalIndex}, function(e) {
            if (e.which === 1) { // Only move sticks on left mouse button
                handleGimbalMouseDrag(e);
                
                $(window).on('mousemove', {gimbalIndex: gimbalIndex}, handleGimbalMouseDrag);
            }
        });
    });
    
    $(".slider", sliderElems).each(function(sliderIndex) {
        var 
            initialValue = stickValues["Aux" + (sliderIndex + 1)];
        
        $(this)
            .noUiSlider({
                start: initialValue,
                range: {
                    min: CHANNEL_MIN_VALUE,
                    max: CHANNEL_MAX_VALUE
                }
            }).on('slide change set', function(e, value) {
                value = Math.round(parseFloat(value));
                
                stickValues["Aux" + (sliderIndex + 1)] = value;
                
                $(".tooltip", this).text(value);
            });
        
        $(this).append('<div class="tooltip"></div>');
        
        $(".tooltip", this).text(initialValue);
    });
    
    /* 
     * Mouseup handler needs to be bound to the window in order to receive mouseup if mouse leaves window.
     */
    $(window).mouseup(function(e) {
        $(this).off('mousemove', handleGimbalMouseDrag);
    });
    
    localizeAxisNames();
    
    updateControlPositions();
    
    setInterval(transmitChannels, 50);
});