'use strict';

var MSP = {
    symbols: {
        BEGIN: '$'.charCodeAt(0),
        PROTO_V1: 'M'.charCodeAt(0),
        PROTO_V2: 'X'.charCodeAt(0),
        FROM_MWC: '>'.charCodeAt(0),
        TO_MWC: '<'.charCodeAt(0),
        UNSUPPORTED: '!'.charCodeAt(0),
    },
    constants: {
        PROTOCOL_V1:                1,
        PROTOCOL_V2:                2,
        JUMBO_FRAME_MIN_SIZE:       255,
    },
    decoder_states: {
        IDLE:                       0,
        PROTO_IDENTIFIER:           1,
        DIRECTION_V1:               2,
        DIRECTION_V2:               3,
        FLAG_V2:                    4,
        PAYLOAD_LENGTH_V1:          5,
        PAYLOAD_LENGTH_JUMBO_LOW:   6,
        PAYLOAD_LENGTH_JUMBO_HIGH:  7,
        PAYLOAD_LENGTH_V2_LOW:      8,
        PAYLOAD_LENGTH_V2_HIGH:     9,
        CODE_V1:                    10,
        CODE_JUMBO_V1:              11,
        CODE_V2_LOW:                12,
        CODE_V2_HIGH:               13,
        PAYLOAD_V1:                 14,
        PAYLOAD_V2:                 15,
        CHECKSUM_V1:                16,
        CHECKSUM_V2:                17,
    },
    state:                      0,
    message_direction:          1,
    code:                       0,
    dataView:                   0,
    message_length_expected:    0,
    message_length_received:    0,
    message_buffer:             null,
    message_buffer_uint8_view:  null,
    message_checksum:           0,
    messageIsJumboFrame:        false,
    crcError:                   false,

    callbacks:                  [],
    packet_error:               0,
    unsupported:                0,

    // Reentrant save protection: beginProtectedSave() returns a token identifying one tab's save
    // chain and increments activeSaveCount; requests issued while activeSaveCount > 0 are marked
    // protected and survive a tab switch instead of being abandoned by callbacks_cleanup(). Tabs call
    // endProtectedSave(token) once their chain settles (success or failure); if a chain stalls and
    // never calls it (e.g. a plain callback that never fires), the watchdog armed for that token
    // releases it after saveWatchdogTimeoutMs so one stuck save can't protect every other tab's
    // unrelated requests forever. Using a per-token count instead of a single boolean means one save
    // chain finishing (or timing out) can't prematurely end protection for a second, still-running
    // save chain from another tab. disconnect_cleanup() releases every outstanding token immediately,
    // since nothing can complete once the connection is gone.
    activeSaveCount:             0,
    saveWatchdogTimers:          {},
    nextSaveToken:               1,
    saveWatchdogTimeoutMs:       15000,

    last_received_timestamp:   null,
    listeners:                  [],

    JUMBO_FRAME_SIZE_LIMIT:     255,

    read: function (readInfo) {
        var data = new Uint8Array(readInfo.data);

        for (var i = 0; i < data.length; i++) {
            switch (this.state) {
            case this.decoder_states.IDLE: // sync char 1
                if (data[i] === this.symbols.BEGIN) {
                    this.state = this.decoder_states.PROTO_IDENTIFIER;
                }
                break;
            case this.decoder_states.PROTO_IDENTIFIER: // sync char 2
                switch (data[i]) {
                    case this.symbols.PROTO_V1:
                        this.state = this.decoder_states.DIRECTION_V1;
                        break;
                    case this.symbols.PROTO_V2:
                        this.state = this.decoder_states.DIRECTION_V2;
                        break;
                    default:
                        console.log(`Unknown protocol char ${String.fromCharCode(data[i])}`);
                        this.state = this.decoder_states.IDLE;
                }
                break;
            case this.decoder_states.DIRECTION_V1: // direction (should be >)
            case this.decoder_states.DIRECTION_V2:
                this.unsupported = 0;
                switch (data[i]) {
                    case this.symbols.FROM_MWC:
                        this.message_direction = 1;
                        break;
                    case this.symbols.TO_MWC:
                        this.message_direction = 0;
                        break;
                    case this.symbols.UNSUPPORTED:
                        this.unsupported = 1;
                        break;
                }
                this.state = this.state === this.decoder_states.DIRECTION_V1 ?
                        this.decoder_states.PAYLOAD_LENGTH_V1 :
                        this.decoder_states.FLAG_V2;
                break;
            case this.decoder_states.FLAG_V2:
                // Ignored for now
                this.state = this.decoder_states.CODE_V2_LOW;
                break;
            case this.decoder_states.PAYLOAD_LENGTH_V1:
                this.message_length_expected = data[i];

                if (this.message_length_expected === this.constants.JUMBO_FRAME_MIN_SIZE) {
                    this.state = this.decoder_states.CODE_JUMBO_V1;
                } else {
                    this._initialize_read_buffer();
                    this.state = this.decoder_states.CODE_V1;
                }

                break;
            case this.decoder_states.PAYLOAD_LENGTH_V2_LOW:
                this.message_length_expected = data[i];
                this.state = this.decoder_states.PAYLOAD_LENGTH_V2_HIGH;
                break;
            case this.decoder_states.PAYLOAD_LENGTH_V2_HIGH:
                this.message_length_expected |= data[i] << 8;
                this._initialize_read_buffer();
                this.state = this.message_length_expected > 0 ?
                    this.decoder_states.PAYLOAD_V2 :
                    this.decoder_states.CHECKSUM_V2;
                break;
            case this.decoder_states.CODE_V1:
            case this.decoder_states.CODE_JUMBO_V1:
                this.code = data[i];
                if (this.message_length_expected > 0) {
                    // process payload
                    if (this.state === this.decoder_states.CODE_JUMBO_V1) {
                        this.state = this.decoder_states.PAYLOAD_LENGTH_JUMBO_LOW;
                    } else {
                        this.state = this.decoder_states.PAYLOAD_V1;
                    }
                } else {
                    // no payload
                    this.state = this.decoder_states.CHECKSUM_V1;
                }
                break;
            case this.decoder_states.CODE_V2_LOW:
                this.code = data[i];
                this.state = this.decoder_states.CODE_V2_HIGH;
                break;
            case this.decoder_states.CODE_V2_HIGH:
                this.code |= data[i] << 8;
                this.state = this.decoder_states.PAYLOAD_LENGTH_V2_LOW;
                break;
            case this.decoder_states.PAYLOAD_LENGTH_JUMBO_LOW:
                this.message_length_expected = data[i];
                this.state = this.decoder_states.PAYLOAD_LENGTH_JUMBO_HIGH;
                break;
            case this.decoder_states.PAYLOAD_LENGTH_JUMBO_HIGH:
                this.message_length_expected |= data[i] << 8;
                this._initialize_read_buffer();
                this.state = this.decoder_states.PAYLOAD_V1;
                break;
            case this.decoder_states.PAYLOAD_V1:
            case this.decoder_states.PAYLOAD_V2:
                this.message_buffer_uint8_view[this.message_length_received] = data[i];
                this.message_length_received++;

                if (this.message_length_received >= this.message_length_expected) {
                    this.state = this.state === this.decoder_states.PAYLOAD_V1 ?
                        this.decoder_states.CHECKSUM_V1 :
                        this.decoder_states.CHECKSUM_V2;
                }
                break;
            case this.decoder_states.CHECKSUM_V1:
                if (this.message_length_expected >= this.constants.JUMBO_FRAME_MIN_SIZE) {
                    this.message_checksum = this.constants.JUMBO_FRAME_MIN_SIZE;
                } else {
                    this.message_checksum = this.message_length_expected;
                }
                this.message_checksum ^= this.code;
                if (this.message_length_expected >= this.constants.JUMBO_FRAME_MIN_SIZE) {
                    this.message_checksum ^= this.message_length_expected & 0xFF;
                    this.message_checksum ^= (this.message_length_expected & 0xFF00) >> 8;
                }
                for (let ii = 0; ii < this.message_length_received; ii++) {
                    this.message_checksum ^= this.message_buffer_uint8_view[ii];
                }
                this._dispatch_message(data[i]);
                break;
            case this.decoder_states.CHECKSUM_V2:
                this.message_checksum = 0;
                this.message_checksum = this.crc8_dvb_s2(this.message_checksum, 0); // flag
                this.message_checksum = this.crc8_dvb_s2(this.message_checksum, this.code & 0xFF);
                this.message_checksum = this.crc8_dvb_s2(this.message_checksum, (this.code & 0xFF00) >> 8);
                this.message_checksum = this.crc8_dvb_s2(this.message_checksum, this.message_length_expected & 0xFF);
                this.message_checksum = this.crc8_dvb_s2(this.message_checksum, (this.message_length_expected & 0xFF00) >> 8);
                for (let ii = 0; ii < this.message_length_received; ii++) {
                    this.message_checksum = this.crc8_dvb_s2(this.message_checksum, this.message_buffer_uint8_view[ii]);
                }
                this._dispatch_message(data[i]);
                break;
            default:
                console.log(`Unknown state detected: ${this.state}`);
            }
        }
        this.last_received_timestamp = Date.now();
    },
    _initialize_read_buffer: function() {
        this.message_buffer = new ArrayBuffer(this.message_length_expected);
        this.message_buffer_uint8_view = new Uint8Array(this.message_buffer);
    },
    _dispatch_message: function(expectedChecksum) {
        if (this.message_checksum === expectedChecksum) {
            // message received, store dataview
            this.dataView = new DataView(this.message_buffer, 0, this.message_length_expected);
        } else {
            console.log(`code: ${this.code} - crc failed`);
            this.packet_error++;
            this.crcError = true;
            this.dataView = new DataView(new ArrayBuffer(0));
        }
        // Reset variables
        this.message_length_received = 0;
        this.state = 0;
        this.messageIsJumboFrame = false;
        this.notify();
        this.crcError = false;
    },
    notify: function() {
        var self = this;
        this.listeners.forEach(function(listener) {
            listener(self);
        });
    },
    listen: function(listener) {
        if (this.listeners.indexOf(listener) === -1) {
            this.listeners.push(listener);
        }
    },
    clearListeners: function() {
        this.listeners = [];
    },
    crc8_dvb_s2: function(crc, ch) {
        crc ^= ch;
        for (let ii = 0; ii < 8; ii++) {
            if (crc & 0x80) {
                crc = ((crc << 1) & 0xFF) ^ 0xD5;
            } else {
                crc = (crc << 1) & 0xFF;
            }
        }
        return crc;
    },
    crc8_dvb_s2_data: function(data, start, end) {
        let crc = 0;
        for (let ii = start; ii < end; ii++) {
            crc = this.crc8_dvb_s2(crc, data[ii]);
        }
        return crc;
    },
    encode_message_v1: function(code, data) {
        let bufferOut;
        // always reserve 6 bytes for protocol overhead !
        if (data) {
            var size = data.length + 6,
                checksum = 0;

            bufferOut = new ArrayBuffer(size);
            let bufView = new Uint8Array(bufferOut);

            bufView[0] = 36; // $
            bufView[1] = 77; // M
            bufView[2] = 60; // <
            bufView[3] = data.length;
            bufView[4] = code;

            checksum = bufView[3] ^ bufView[4];

            for (var i = 0; i < data.length; i++) {
                bufView[i + 5] = data[i];

                checksum ^= bufView[i + 5];
            }

            bufView[5 + data.length] = checksum;
        } else {
            bufferOut = new ArrayBuffer(6);
            let bufView = new Uint8Array(bufferOut);

            bufView[0] = 36; // $
            bufView[1] = 77; // M
            bufView[2] = 60; // <
            bufView[3] = 0; // data length
            bufView[4] = code; // code
            bufView[5] = bufView[3] ^ bufView[4]; // checksum
        }
        return bufferOut;
    },
    encode_message_v2: function (code, data) {
        const dataLength = data ? data.length : 0;
        // 9 bytes for protocol overhead
        const bufferSize = dataLength + 9;
        const bufferOut = new ArrayBuffer(bufferSize);
        const bufView = new Uint8Array(bufferOut);
        bufView[0] = 36; // $
        bufView[1] = 88; // X
        bufView[2] = 60; // <
        bufView[3] = 0;  // flag
        bufView[4] = code & 0xFF;
        bufView[5] = (code >> 8) & 0xFF;
        bufView[6] = dataLength & 0xFF;
        bufView[7] = (dataLength >> 8) & 0xFF;
        for (let ii = 0; ii < dataLength; ii++) {
            bufView[8 + ii] = data[ii];
        }
        bufView[bufferSize - 1] = this.crc8_dvb_s2_data(bufView, 3, bufferSize - 1);
        return bufferOut;
    },
    send_message: function (code, data, callback_sent, callback_msp, doCallbackOnError) {
        if (code === undefined) {
            return;
        }
        let bufferOut;
        if (code <= 254) {
            bufferOut = this.encode_message_v1(code, data);
        } else {
            bufferOut = this.encode_message_v2(code, data);
        }

        var obj = {'code': code, 'requestBuffer': bufferOut, 'callback': callback_msp ? callback_msp : false, 'timer': false, 'callbackOnError': doCallbackOnError};

        var requestExists = false;
        for (var i = 0; i < MSP.callbacks.length; i++) {
            if (MSP.callbacks[i].code === code) {
                // request already exist, we will just attach
                requestExists = true;
                break;
            }
        }

        if (!requestExists) {
            obj.timer = setInterval(function () {
                console.log(`MSP data request timed-out: ${code}`);

                serial.send(bufferOut, false);
            }, 1000); // we should be able to define timeout in the future
        }

        MSP.callbacks.push(obj);

        // always send messages with data payload (even when there is a message already in the queue)
        if (data || !requestExists) {
            serial.send(bufferOut, function (sendInfo) {
                if (sendInfo.bytesSent === bufferOut.byteLength) {
                    if (callback_sent) {
                        callback_sent();
                    }
                }
            });
        }

        return obj;
    },

    /**
     * resolves: {command: code, data: data, length: message_length}
     * rejects: Error, if the request is abandoned by callbacks_cleanup() (e.g. tab switch or disconnect
     * before a response arrives) instead of being left to hang forever.
     */
    promise: function(code, data) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var pending = self.send_message(code, data, false, function(data) {
          resolve(data);
        });
        if (!pending) {
          reject(new Error(`MSP.promise: invalid code (${code})`));
          return;
        }
        pending.reject = reject;
      });
    },
    // Marks the start of one tab's save chain: while activeSaveCount > 0, requests issued survive a
    // tab switch instead of being abandoned (see callbacks_cleanup below). Returns a token that the
    // caller MUST pass to endProtectedSave() once its chain settles (success or failure). Arms a
    // watchdog scoped to that token so a chain that never calls endProtectedSave() (e.g. a plain
    // callback that never fires) can't leave protection stuck on forever.
    beginProtectedSave: function (timeoutMs) {
        var token = this.nextSaveToken++;
        this.activeSaveCount++;
        this._armSaveWatchdog(token, timeoutMs);
        return token;
    },
    endProtectedSave: function (token) {
        this._releaseSaveToken(token);
    },
    // Re-arms an existing token's watchdog without touching activeSaveCount, for a chain that legitimately
    // runs longer than one watchdog window (e.g. many sequential requests in a loop) — call this between
    // steps so only a stalled step expires protection, instead of the chain's total duration. No-op if the
    // token was already released (e.g. by a disconnect).
    touchProtectedSave: function (token, timeoutMs) {
        if (!Object.prototype.hasOwnProperty.call(this.saveWatchdogTimers, token)) {
            return;
        }
        clearTimeout(this.saveWatchdogTimers[token]);
        this._armSaveWatchdog(token, timeoutMs);
    },
    _armSaveWatchdog: function (token, timeoutMs) {
        var self = this;
        this.saveWatchdogTimers[token] = setTimeout(function () {
            console.log('MSP save watchdog: save token ' + token + ' did not settle within ' + (timeoutMs || self.saveWatchdogTimeoutMs) + 'ms, releasing its protection');
            self._releaseSaveToken(token);
        }, timeoutMs || this.saveWatchdogTimeoutMs);
    },
    // Shared by endProtectedSave() and the per-token watchdog; safe to call twice for the same token
    // (e.g. if both the watchdog and a late endProtectedSave() fire) since the second call is a no-op.
    _releaseSaveToken: function (token) {
        if (!Object.prototype.hasOwnProperty.call(this.saveWatchdogTimers, token)) {
            return;
        }
        clearTimeout(this.saveWatchdogTimers[token]);
        delete this.saveWatchdogTimers[token];
        this.activeSaveCount = Math.max(0, this.activeSaveCount - 1);
    },
    // force=true (used by disconnect_cleanup) also clears in-flight-save entries, since a real
    // disconnect means nothing can complete regardless. Plain tab switches leave everything alone
    // while a save is CURRENTLY active (activeSaveCount > 0, checked live here, not a flag stored on
    // the request at creation time) so an in-flight save (including EEPROM_WRITE) is not abandoned,
    // per issue #623 — but the moment the save ends, protection ends with it for everything, including
    // unrelated background polls that happened to be issued during that window. A per-request flag
    // frozen at creation time was tried first and was a real bug: a periodic poll created during any
    // save anywhere in the session would stay "protected" forever, even long after that save finished,
    // silently defeating cleanup calls other code depends on (e.g. cli.js's tab_switch_cleanup ->
    // callbacks_cleanup() flush of stale retransmit timers before its CLI-exit/reboot/reconnect
    // sequence) and leaving a retry timer stuck hammering a connection that had already moved on.
    callbacks_cleanup: function (force) {
        var protectAll = this.activeSaveCount > 0 && !force;
        for (var i = this.callbacks.length - 1; i >= 0; i--) {
            if (protectAll) {
                console.log(`MSP: preserving in-flight request ${this.callbacks[i].code} through tab switch (save in progress)`);
                continue;
            }

            clearInterval(this.callbacks[i].timer);

            if (typeof this.callbacks[i].reject === 'function') {
                this.callbacks[i].reject(new Error(`MSP request ${this.callbacks[i].code} aborted before a response arrived (tab switch or disconnect)`));
            }

            this.callbacks.splice(i, 1);
        }
    },
    disconnect_cleanup: function () {
        this.state = 0; // reset packet state for "clean" initial entry (this is only required if user hot-disconnects)
        this.packet_error = 0; // reset CRC packet error counter for next session

        // release every outstanding save token — any protected in-flight save is moot once the connection is gone
        for (var token in this.saveWatchdogTimers) {
            clearTimeout(this.saveWatchdogTimers[token]);
        }
        this.saveWatchdogTimers = {};
        this.activeSaveCount = 0;

        this.callbacks_cleanup(true);
    }
};

// window.Promise is Bluebird (see main.html), whose default handling of an unhandled rejection
// is a multi-frame "Unhandled rejection" trace dump straight to console — accurate, but alarming
// for the one case we know is expected: a background MSP read abandoned by callbacks_cleanup()/
// disconnect_cleanup() above (tab switch or real disconnect, not a bug). This hook replaces
// Bluebird's default reporter app-wide with calmer, explanatory logging for that specific case;
// anything else still logs normally so a genuine bug is never silently hidden.
(function () {
    if (!window.Promise || typeof window.Promise.onPossiblyUnhandledRejection !== 'function') {
        return;
    }

    var MSP_ABANDONED_REQUEST_PATTERN = /^MSP request (\d+) aborted before a response arrived \(tab switch or disconnect\)$/;
    var mspCodeNamesByValue = {};
    for (var mspCodeName in MSPCodes) {
        mspCodeNamesByValue[MSPCodes[mspCodeName]] = mspCodeName;
    }

    window.Promise.onPossiblyUnhandledRejection(function (error) {
        var match = error instanceof Error && MSP_ABANDONED_REQUEST_PATTERN.exec(error.message);
        if (match) {
            var code = match[1];
            console.log(`MSP: request ${mspCodeNamesByValue[code] || code} was abandoned before a response arrived (tab switch or disconnect) — expected for a non-critical background read, no data was lost.`);
        } else {
            console.error('Unhandled rejection:', error);
        }
    });
})();
