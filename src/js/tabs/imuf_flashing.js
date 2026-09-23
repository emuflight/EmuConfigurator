'use strict';

// Substitution table from the IMUF9001 bootloader firmware itself (not app-chosen).
// caesarThing[i] === decodedByte. Encoding a plain byte means finding its index i.
const IMUF_CAESAR_TABLE = [
    155, 225, 248, 242, 93, 127, 22, 172, 177, 201, 108, 8, 132, 254, 197, 49,
    216, 169, 32, 151, 217, 202, 122, 227, 86, 17, 165, 226, 222, 82, 252, 168,
    212, 95, 25, 239, 113, 88, 0, 100, 215, 71, 115, 80, 149, 3, 39, 193,
    180, 57, 195, 145, 77, 27, 48, 157, 247, 118, 16, 159, 33, 51, 220, 111,
    253, 154, 147, 166, 229, 85, 150, 187, 5, 56, 137, 199, 241, 34, 156, 218,
    65, 14, 249, 181, 54, 66, 203, 12, 4, 143, 142, 13, 234, 191, 255, 130,
    41, 246, 171, 102, 152, 84, 179, 63, 103, 35, 74, 104, 114, 112, 237, 91,
    134, 213, 167, 178, 126, 23, 141, 182, 90, 174, 211, 129, 121, 117, 232, 99,
    176, 7, 205, 94, 38, 24, 161, 10, 120, 59, 18, 58, 98, 244, 245, 238,
    45, 55, 209, 101, 47, 208, 230, 163, 107, 72, 175, 148, 144, 186, 11, 123,
    46, 192, 36, 128, 40, 250, 140, 105, 125, 43, 164, 81, 78, 233, 68, 44,
    133, 42, 109, 139, 87, 119, 15, 106, 31, 69, 194, 231, 236, 153, 240, 184,
    116, 73, 96, 70, 223, 97, 251, 228, 52, 75, 224, 50, 190, 19, 210, 160,
    30, 26, 131, 221, 170, 92, 110, 89, 198, 79, 76, 1, 196, 21, 62, 67,
    136, 146, 135, 53, 189, 28, 158, 83, 214, 138, 188, 162, 60, 183, 200, 6,
    124, 20, 185, 64, 207, 173, 9, 204, 235, 37, 243, 206, 219, 29, 2, 61,
];

// Inverse of IMUF_CAESAR_TABLE, precomputed once: encodeByte[plainByte] = wireByte.
const IMUF_CAESAR_ENCODE_TABLE = (function buildImufCaesarEncodeTable() {
    const table = new Uint8Array(256);
    for (let i = 0; i < IMUF_CAESAR_TABLE.length; i++) {
        table[IMUF_CAESAR_TABLE[i]] = i;
    }
    return table;
})();

// Little-endian bytes of the Cortex-M initial-SP (0x20004000) — a normal, un-ciphered
// vector table. Its absence means the binary is already in ciphered (legacy HelioRC) form.
const IMUF_PLAIN_SIGNATURE = [0x00, 0x40, 0x00, 0x20];

const IMUF_CHUNK_SIZE = 100; // bytes/chunk; matches CLI_IN_BUFFER_SIZE=256 headroom firmware-side
const IMUF_MAX_BINARY_SIZE = 26000; // firmware's IMUF_CUSTOM_BUFF_LENGTH

function imufBinaryNeedsCaesarEncode(bytes) {
    for (let i = 0; i < IMUF_PLAIN_SIGNATURE.length; i++) {
        if (bytes[i] !== IMUF_PLAIN_SIGNATURE[i]) {
            return false;
        }
    }
    return true;
}

function imufCaesarEncode(bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        out[i] = IMUF_CAESAR_ENCODE_TABLE[bytes[i]];
    }
    return out;
}

function imufBytesToHex(bytes, start, length) {
    let hex = '';
    const end = start + length;
    for (let i = start; i < end; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

// Little-endian 4-byte length prefix, matching the firmware's per-byte-pair hex2byte parsing
// of the 'imufloadbin l<8 hex chars>' command (cli.c: cliImufLoadBin).
function imufU32ToLeHex(value) {
    const bytes = [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

TABS.imuf_flashing = {
    releaseChecker: new ReleaseChecker('imuf', 'https://api.github.com/repos/emuflight/imu-f/releases'),
    selectedBinary: null, // Uint8Array
    flashInProgress: false,
    _rxBuffer: '', // raw text received during this tab's own CLI session (self-contained, not TABS.cli's)
    _inCliMode: false,
    _pendingAfterReconnectTimeout: null,
    _lastResult: null, // {success, messageKey} -- shown once by initialize() after a reboot round-trip
};

TABS.imuf_flashing.initialize = function (callback) {
    const self = this;

    if (GUI.active_tab !== 'imuf_flashing') {
        GUI.active_tab = 'imuf_flashing';
    }

    self.selectedBinary = null;
    self.flashInProgress = false;

    function onDocumentLoad() {
        // translate to user-selected language
        i18n.localizePage();

        // Shows the outcome of a flash attempt from before a reboot/reconnect (see
        // _awaitReconnect). This re-init is that round-trip's continuation.
        if (self._lastResult) {
            const result = self._lastResult;
            self._lastResult = null;
            self.flashingMessage(
                result.success ? i18n.getMessage('imufFlashingSuccess') : i18n.getMessage(result.messageKey),
                result.success ? self.FLASH_MESSAGE_TYPES.VALID : self.FLASH_MESSAGE_TYPES.INVALID
            );
        }

        // Already fetched at connect time (serial_backend.js, same MSP_IMUF_INFO gate:
        // apiVersion >= 1.51.0 on a HESP/SX10/FLUX board) -- no need to request it again here.
        const installedVersion = IMUF_FILTER_CONFIG.imufCurrentVersion;
        if (installedVersion !== undefined) {
            const key = installedVersion === 9999 ? 'imufFlashingInstalledVersionUnknown' : 'imufFlashingInstalledVersion';
            $('.imuf_installed_version .value').text(i18n.getMessage(key, [installedVersion]));
            $('.imuf_installed_version').show();
        }

        function populateReleases(releaseData) {
            const select_e = $('select[name="imuf_version"]');
            select_e.empty().append(`<option value="0">${i18n.getMessage('imufFlashingSelectVersion')}</option>`);

            if (!releaseData || !releaseData.length) {
                $('a.load_remote_file_imuf').addClass('disabled');
                return;
            }

            releaseData
                .filter((release) => release.assets && release.assets.some((asset) => asset.name.endsWith('.bin')))
                .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
                .forEach((release) => {
                    const asset = release.assets.find((a) => a.name.endsWith('.bin'));
                    $('<option></option>')
                        .attr('value', release.tag_name)
                        .text(`${release.name || release.tag_name} (${asset.name})`)
                        .data('asset', asset)
                        .data('release', release)
                        .appendTo(select_e);
                });
        }

        self.releaseChecker.loadReleaseData(populateReleases);

        $('select[name="imuf_version"]').change(function (evt) {
            const disabled = evt.target.value === '0';
            $('a.load_remote_file_imuf').toggleClass('disabled', disabled);

            const release = $('option:selected', evt.target).data('release');
            if (disabled || !release) {
                $('.imuf_release_info').slideUp();
                return;
            }

            $('.imuf_release_info .name').text(release.name || release.tag_name).prop('href', release.html_url);
            $('.imuf_release_info .date').text(new Date(release.published_at).toLocaleDateString());
            $('.imuf_release_info .notes').html(release.body ? marked.parse(release.body) : '');
            $('.imuf_release_info').slideDown();
        });

        $('a.load_remote_file_imuf').click(function () {
            if ($(this).hasClass('disabled')) {
                return;
            }
            const asset = $('select[name="imuf_version"] option:selected').data('asset');
            if (!asset) {
                return;
            }

            self.enableFlashing(false);
            self.flashingMessage(i18n.getMessage('imufFlashingDownloading'), self.FLASH_MESSAGE_TYPES.ACTION);

            fetch(asset.browser_download_url)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then((buffer) => self.onBinaryLoaded(new Uint8Array(buffer), asset.name))
                .catch((err) => {
                    console.error('IMUF release download failed:', err);
                    self.flashingMessage(i18n.getMessage('imufFlashingDownloadFailed'), self.FLASH_MESSAGE_TYPES.INVALID);
                });
        });

        $('a.load_file_imuf').click(function () {
            self.enableFlashing(false);
            chrome.fileSystem.chooseEntry({
                type: 'openFile',
                dialogId: 'imuf_firmware',
                accepts: [{description: 'IMU-F binary files', extensions: ['bin']}],
            }, function (fileEntry) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    return;
                }
                if (!fileEntry) {
                    return;
                }

                fileEntry.file(function (file) {
                    const reader = new FileReader();
                    reader.onloadend = function (e) {
                        if (e.total !== 0 && e.total === e.loaded) {
                            self.onBinaryLoaded(new Uint8Array(e.target.result), file.name);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                });
            });
        });

        $('a.flash_imuf').click(function () {
            if (!$(this).hasClass('disabled')) {
                self.flash();
            }
        });

        GUI.content_ready(callback);
    }

    $('#content').load('./tabs/imuf_flashing.html', onDocumentLoad);
};

TABS.imuf_flashing.onBinaryLoaded = function (bytes, filename) {
    const self = this;

    if (bytes.length < IMUF_PLAIN_SIGNATURE.length || bytes.length >= IMUF_MAX_BINARY_SIZE) {
        self.selectedBinary = null;
        self.enableFlashing(false);
        self.flashingMessage(i18n.getMessage('imufFlashingBinaryInvalidSize', [bytes.length]), self.FLASH_MESSAGE_TYPES.INVALID);
        return;
    }

    self.selectedBinary = bytes;

    const needsEncode = imufBinaryNeedsCaesarEncode(bytes);
    $('.imuf_binary_summary .file').text(filename);
    $('.imuf_binary_summary .size').text(`${bytes.length} bytes`);
    $('.imuf_binary_summary .cipher').text(i18n.getMessage(needsEncode ? 'imufFlashingCipherWillEncode' : 'imufFlashingCipherAlreadyEncoded'));
    $('.imuf_binary_summary').slideDown();

    self.flashingMessage(i18n.getMessage('imufFlashingBinaryLoaded', [bytes.length]), self.FLASH_MESSAGE_TYPES.NEUTRAL);
    self.enableFlashing(true);
};

// Registered as CONFIGURATOR.cliActiveReader (serial_backend.js's read_serial()) instead of
// routing through TABS.cli.read. That function also drives CliAutoComplete and interactive
// terminal-emulation state this tab never initializes, and throws if invoked without
// TABS.cli.initialize() having run first. This tab only needs a flat text buffer to match on.
TABS.imuf_flashing.read = function (readInfo) {
    const data = new Uint8Array(readInfo.data);
    let chunk = '';
    for (let i = 0; i < data.length; i++) {
        chunk += String.fromCharCode(data[i]);
    }
    this._rxBuffer += chunk;
    if (!this._inCliMode && this._rxBuffer.indexOf('CLI') !== -1) {
        this._inCliMode = true;
    }
};

TABS.imuf_flashing.send = function (line, callback) {
    const bufferOut = new ArrayBuffer(line.length);
    const bufView = new Uint8Array(bufferOut);
    for (let i = 0; i < line.length; i++) {
        bufView[i] = line.charCodeAt(i);
    }
    serial.send(bufferOut, callback);
};

TABS.imuf_flashing.sendLine = function (line, callback) {
    this.send(`${line}\n`, callback);
};

// Enters CLI mode the same way the CLI tab does (send raw 0x23 '#'), but drives it through
// this tab's own read()/send() rather than TABS.cli's.
TABS.imuf_flashing.enterCliMode = function (callback) {
    const self = this;
    self._rxBuffer = '';
    self._inCliMode = false;
    CONFIGURATOR.cliActive = true;
    CONFIGURATOR.cliActiveReader = self;

    // Flushes any MSP request already in flight and its retry timer. Otherwise it keeps
    // resending binary MSP frames into the CLI text stream for up to 1000ms more, the same
    // collision CONFIGURATOR.cliActive guards against (update_live_status() in serial_backend.js).
    MSP.callbacks_cleanup();

    const bufferOut = new ArrayBuffer(1);
    new Uint8Array(bufferOut)[0] = 0x23; // '#'
    serial.send(bufferOut);

    let waited = 0;
    const pollId = setInterval(() => {
        waited += 100;
        if (self._inCliMode) {
            clearInterval(pollId);
            callback(true);
        } else if (waited >= 5000) {
            clearInterval(pollId);
            callback(false);
        }
    }, 100);
};

// Waits up to timeoutMs for one of expectSubstrings. callback gets (ok, matched, raw).
TABS.imuf_flashing.sendCliCommandExpect = function (command, expectSubstrings, timeoutMs, callback) {
    const self = this;
    const startLen = self._rxBuffer.length;
    self.sendLine(command, () => {
        let waited = 0;
        const pollId = setInterval(() => {
            waited += 20;
            const newText = self._rxBuffer.slice(startLen);
            const matched = expectSubstrings.find((s) => newText.indexOf(s) !== -1);
            if (matched) {
                clearInterval(pollId);
                callback(true, matched, newText);
            } else if (waited >= timeoutMs) {
                clearInterval(pollId);
                callback(false, null, newText);
            }
        }, 20);
    });
};

// Chip erase plus one SPI write per 32 bytes (imufUpdate(), accgyro_imuf9001.c) can exceed a
// short timeout on real hardware. Per that same function, only a successful commit reboots the
// FC -- a failure returns silently, CLI session still alive. So a disconnect here is also a
// valid success signal, not just something to time out on.
//
// The disconnect branch is cheap insurance, not a proven need: it is unverified on real
// hardware, and can't tell a normal reboot apart from an unrelated crash/watchdog reset.
TABS.imuf_flashing.awaitCommitResult = function (timeoutMs, callback) {
    const self = this;
    const startLen = self._rxBuffer.length;
    console.log('[imuf-flashing] sending imufflashbin (commit step)');
    self.sendLine('imufflashbin', () => {
        let waited = 0;
        const pollId = setInterval(() => {
            waited += 100;
            const newText = self._rxBuffer.slice(startLen);
            if (newText.indexOf('SUCCESS') !== -1) {
                clearInterval(pollId);
                console.log('[imuf-flashing] commit: SUCCESS text seen after', waited, 'ms');
                callback(true, 'success-text', newText);
                return;
            }
            if (!CONFIGURATOR.connectionValid) {
                clearInterval(pollId);
                console.log('[imuf-flashing] commit: connection dropped after', waited, 'ms -- treating as success (only a completed flash reboots)');
                callback(true, 'disconnected', newText);
                return;
            }
            if (waited >= timeoutMs) {
                clearInterval(pollId);
                console.log('[imuf-flashing] commit: timed out after', waited, 'ms, no SUCCESS and still connected -- real failure');
                callback(false, 'timeout', newText);
            }
        }, 100);
    });
};

// Sets GUI.pendingAfterReconnect (the hook TABS.cli.cleanup() also uses) so the reconnect
// routes back to this tab instead of finishOpen()'s default tab selection. callback fires once
// the new connection's handshake completes, or after a 15s watchdog otherwise.
TABS.imuf_flashing._awaitReconnect = function (callback) {
    const self = this;
    CONFIGURATOR.cliActive = false;
    CONFIGURATOR.cliActiveReader = null;
    self._inCliMode = false;

    GUI.pendingAfterReconnect = callback;
    if (self._pendingAfterReconnectTimeout) {
        clearTimeout(self._pendingAfterReconnectTimeout);
    }
    self._pendingAfterReconnectTimeout = setTimeout(() => {
        if (GUI.pendingAfterReconnect === callback) {
            GUI.pendingAfterReconnect = null;
        }
        self._pendingAfterReconnectTimeout = null;
    }, 15000);
};

TABS.imuf_flashing.sendChunks = function (wireBytes, offset, callback) {
    const self = this;
    if (offset >= wireBytes.length) {
        callback(true);
        return;
    }

    const chunkLen = Math.min(IMUF_CHUNK_SIZE, wireBytes.length - offset);
    const command = `imufloadbin l${imufU32ToLeHex(chunkLen)}${imufBytesToHex(wireBytes, offset, chunkLen)}`;

    self.sendCliCommandExpect(command, ['LOADED', 'WOAH!', 'CRAP!', 'PFFFT!'], 2000, (ok, matched, raw) => {
        if (!ok || matched !== 'LOADED') {
            console.log('[imuf-flashing] chunk at offset', offset, 'failed:', matched, JSON.stringify(raw));
            GUI.log(i18n.getMessage('imufFlashingLogChunkFailed', [offset]));
            self.flashFailed('imufFlashingLoadChunkFailed');
            callback(false);
            return;
        }

        const nextOffset = offset + chunkLen;
        // console.debug, not .log -- full per-chunk detail, hidden unless Verbose is enabled
        // in the DevTools console filter.
        console.debug('[imuf-flashing] chunk loaded, offset', offset, '->', nextOffset, 'of', wireBytes.length);
        // Reserve the last 5% of the progress bar for the commit (imufflashbin) step.
        self.flashProgress(Math.round((nextOffset / wireBytes.length) * 95));
        self.sendChunks(wireBytes, nextOffset, callback);
    });
};

TABS.imuf_flashing.flash = function () {
    const self = this;
    if (self.flashInProgress || !self.selectedBinary) {
        return;
    }

    const bytes = self.selectedBinary;
    const wireBytes = imufBinaryNeedsCaesarEncode(bytes) ? imufCaesarEncode(bytes) : bytes;

    console.log('[imuf-flashing] flash() start,', bytes.length, 'bytes, caesar-encode:', wireBytes !== bytes);
    GUI.log(i18n.getMessage('imufFlashingLogStart', [bytes.length]));

    self.flashInProgress = true;
    GUI.connect_lock = true;
    self.enableFlashing(false);
    self.flashProgress(0);
    self.flashingMessage(i18n.getMessage('imufFlashingEnteringCli'), self.FLASH_MESSAGE_TYPES.ACTION);

    self.enterCliMode((entered) => {
        console.log('[imuf-flashing] enterCliMode ->', entered);
        if (!entered) {
            self.flashFailed('imufFlashingCliEntryFailed');
            return;
        }
        GUI.log(i18n.getMessage('imufFlashingLogCliEntered'));

        self.flashingMessage(i18n.getMessage('imufFlashingEnteringBootloader'), self.FLASH_MESSAGE_TYPES.ACTION);
        self.sendCliCommandExpect('imufbootloader', ['BOOTLOADER', 'FAIL'], 5000, (ok, matched, raw) => {
            console.log('[imuf-flashing] imufbootloader ->', ok, matched, JSON.stringify(raw));
            if (!ok || matched !== 'BOOTLOADER') {
                GUI.log(i18n.getMessage('imufFlashingLogBootloaderFailed'));
                self.flashFailed('imufFlashingBootloaderFailed');
                return;
            }
            GUI.log(i18n.getMessage('imufFlashingLogBootloaderEntered'));

            self.sendCliCommandExpect('imufloadbin !', ['SUCCESS'], 2000, (armed, armedMatched, armedRaw) => {
                console.log('[imuf-flashing] imufloadbin ! (arm) ->', armed, JSON.stringify(armedRaw));
                if (!armed) {
                    GUI.log(i18n.getMessage('imufFlashingLogArmFailed'));
                    self.flashFailed('imufFlashingArmFailed');
                    return;
                }

                self.flashingMessage(i18n.getMessage('imufFlashingLoading'), self.FLASH_MESSAGE_TYPES.ACTION);
                GUI.log(i18n.getMessage('imufFlashingLogLoading'));
                self.sendChunks(wireBytes, 0, (loaded) => {
                    console.log('[imuf-flashing] sendChunks ->', loaded);
                    if (!loaded) {
                        return; // sendChunks already reported the specific failure
                    }
                    GUI.log(i18n.getMessage('imufFlashingLogLoaded'));

                    self.flashingMessage(i18n.getMessage('imufFlashingCommitting'), self.FLASH_MESSAGE_TYPES.ACTION);
                    // 30s backstop for a genuine failure -- see awaitCommitResult for why.
                    self.awaitCommitResult(30000, (committed, reason, raw3) => {
                        console.log('[imuf-flashing] imufflashbin (commit) ->', committed, reason, JSON.stringify(raw3));
                        if (!committed) {
                            GUI.log(i18n.getMessage('imufFlashingLogCommitFailed'));
                            self.flashFailed('imufFlashingCommitFailed');
                            return;
                        }
                        GUI.log(i18n.getMessage(reason === 'disconnected' ? 'imufFlashingLogCommitReconnected' : 'imufFlashingLogCommitConfirmed'));

                        self.flashProgress(100);
                        self.flashingMessage(i18n.getMessage('imufFlashingSuccess'), self.FLASH_MESSAGE_TYPES.VALID);
                        AudioFeedback.playFlashVerified();
                        self.flashInProgress = false;
                        GUI.connect_lock = false;
                        self._lastResult = {success: true};
                        console.log('[imuf-flashing] flash succeeded, awaiting reconnect');
                        // Firmware reboots on its own ~5s after printing SUCCESS (cliImufFlashBin -> cliReboot()).
                        self._awaitReconnect(() => {
                            console.log('[imuf-flashing] reconnected, re-initializing tab');
                            TABS.imuf_flashing.initialize(function () {});
                        });
                    });
                });
            });
        });
    });
};

// If CLI was entered, sends 'exit' (reboots the FC) and waits for reconnect before showing the
// failure. Otherwise there's no reboot coming, so the failure shows immediately.
TABS.imuf_flashing.flashFailed = function (messageKey) {
    const self = this;
    self.flashInProgress = false;
    GUI.connect_lock = false;

    if (self._inCliMode && CONFIGURATOR.connectionValid) {
        self._lastResult = {success: false, messageKey};
        self.sendLine('exit', () => {
            self._awaitReconnect(() => {
                TABS.imuf_flashing.initialize(function () {});
            });
        });
        return;
    }

    CONFIGURATOR.cliActive = false;
    CONFIGURATOR.cliActiveReader = null;
    self.enableFlashing(true);
    self.flashingMessage(i18n.getMessage(messageKey), self.FLASH_MESSAGE_TYPES.INVALID);
};

TABS.imuf_flashing.enableFlashing = function (enabled) {
    if (enabled) {
        $('a.flash_imuf').removeClass('disabled');
    } else {
        $('a.flash_imuf').addClass('disabled');
    }
};

TABS.imuf_flashing.FLASH_MESSAGE_TYPES = {NEUTRAL: 'NEUTRAL', VALID: 'VALID', INVALID: 'INVALID', ACTION: 'ACTION'};

TABS.imuf_flashing.flashingMessage = function (message, type) {
    const self = this;
    const progressLabel_e = $('span.progressLabel');

    switch (type) {
        case self.FLASH_MESSAGE_TYPES.VALID:
            progressLabel_e.removeClass('invalid actionRequired').addClass('valid');
            break;
        case self.FLASH_MESSAGE_TYPES.INVALID:
            progressLabel_e.removeClass('valid actionRequired').addClass('invalid');
            break;
        case self.FLASH_MESSAGE_TYPES.ACTION:
            progressLabel_e.removeClass('valid invalid').addClass('actionRequired');
            break;
        case self.FLASH_MESSAGE_TYPES.NEUTRAL:
        default:
            progressLabel_e.removeClass('valid invalid actionRequired');
            break;
    }

    progressLabel_e.removeAttr('i18n').html(message);

    return self;
};

TABS.imuf_flashing.flashProgress = function (value) {
    $('.tab-imuf_flashing .progress').val(value);
    return this;
};

TABS.imuf_flashing.cleanup = function (callback) {
    const self = this;

    if (self.flashInProgress) {
        GUI.log(i18n.getMessage('imufFlashingAbortedTabSwitch'));
        self.flashInProgress = false;
        self._lastResult = null; // navigating away -- nothing to re-show later

        if (self._inCliMode && CONFIGURATOR.connectionValid) {
            self.sendLine('exit', () => {
                self._awaitReconnect(callback);
            });
            return;
        }

        CONFIGURATOR.cliActive = false;
        CONFIGURATOR.cliActiveReader = null;
    }

    if (callback) {
        callback();
    }
};
