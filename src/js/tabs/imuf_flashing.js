'use strict';

// Substitution table from the IMUF9001 bootloader firmware itself (not app-chosen).
// caesarThing[i] === decodedByte; encoding a plain byte means finding its index i.
// See AI/EFC/feat/imuf-flashing-tab/CONTEXT_imuf-flashing-tab.md for the wire-protocol writeup.
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
};

TABS.imuf_flashing.initialize = function (callback) {
    const self = this;

    if (GUI.active_tab !== 'imuf_flashing') {
        GUI.active_tab = 'imuf_flashing';
    }

    self.selectedBinary = null;
    self.flashInProgress = false;

    function onDocumentLoad() {
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
                        .appendTo(select_e);
                });
        }

        self.releaseChecker.loadReleaseData(populateReleases);

        $('select[name="imuf_version"]').change(function (evt) {
            $('a.load_remote_file_imuf').toggleClass('disabled', evt.target.value === '0');
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

// Enters CLI mode the same way the CLI tab does (cli.js: send raw 0x23 '#'), but polls
// CONFIGURATOR.cliValid directly instead of driving the interactive CLI tab UI, since this
// tab's own DOM is active, not the CLI tab's.
TABS.imuf_flashing.enterCliMode = function (callback) {
    TABS.cli.outputHistory = '';
    TABS.cli.cliBuffer = '';
    CONFIGURATOR.cliValid = false;
    CONFIGURATOR.cliActive = true;

    const bufferOut = new ArrayBuffer(1);
    new Uint8Array(bufferOut)[0] = 0x23; // '#'
    serial.send(bufferOut);

    let waited = 0;
    const pollId = setInterval(() => {
        waited += 100;
        if (CONFIGURATOR.cliValid) {
            clearInterval(pollId);
            callback(true);
        } else if (waited >= 5000) {
            clearInterval(pollId);
            callback(false);
        }
    }, 100);
};

// Sends one CLI command (reusing TABS.cli's send/receive machinery) and waits for one of
// expectSubstrings to appear in the response, up to timeoutMs.
TABS.imuf_flashing.sendCliCommandExpect = function (command, expectSubstrings, timeoutMs, callback) {
    const startLen = TABS.cli.outputHistory.length;
    TABS.cli.sendLine(command, () => {
        let waited = 0;
        const pollId = setInterval(() => {
            waited += 20;
            const newText = TABS.cli.outputHistory.slice(startLen);
            const matched = expectSubstrings.find((s) => newText.indexOf(s) !== -1);
            if (matched) {
                clearInterval(pollId);
                callback(true, matched);
            } else if (waited >= timeoutMs) {
                clearInterval(pollId);
                callback(false, null);
            }
        }, 20);
    });
};

TABS.imuf_flashing.sendChunks = function (wireBytes, offset, callback) {
    const self = this;
    if (offset >= wireBytes.length) {
        callback(true);
        return;
    }

    const chunkLen = Math.min(IMUF_CHUNK_SIZE, wireBytes.length - offset);
    const command = `imufloadbin l${imufU32ToLeHex(chunkLen)}${imufBytesToHex(wireBytes, offset, chunkLen)}`;

    self.sendCliCommandExpect(command, ['LOADED', 'WOAH!', 'CRAP!', 'PFFFT!'], 2000, (ok, matched) => {
        if (!ok || matched !== 'LOADED') {
            self.flashFailed('imufFlashingLoadChunkFailed');
            callback(false);
            return;
        }

        // Reserve the last 5% of the progress bar for the commit (imufflashbin) step.
        self.flashProgress(Math.round(((offset + chunkLen) / wireBytes.length) * 95));
        self.sendChunks(wireBytes, offset + chunkLen, callback);
    });
};

TABS.imuf_flashing.flash = function () {
    const self = this;
    if (self.flashInProgress || !self.selectedBinary) {
        return;
    }

    const bytes = self.selectedBinary;
    const wireBytes = imufBinaryNeedsCaesarEncode(bytes) ? imufCaesarEncode(bytes) : bytes;

    self.flashInProgress = true;
    self.enableFlashing(false);
    self.flashProgress(0);
    self.flashingMessage(i18n.getMessage('imufFlashingEnteringCli'), self.FLASH_MESSAGE_TYPES.ACTION);

    self.enterCliMode((entered) => {
        if (!entered) {
            self.flashFailed('imufFlashingCliEntryFailed');
            return;
        }

        self.flashingMessage(i18n.getMessage('imufFlashingEnteringBootloader'), self.FLASH_MESSAGE_TYPES.ACTION);
        self.sendCliCommandExpect('imufbootloader', ['BOOTLOADER', 'FAIL'], 5000, (ok, matched) => {
            if (!ok || matched !== 'BOOTLOADER') {
                self.flashFailed('imufFlashingBootloaderFailed');
                return;
            }

            self.sendCliCommandExpect('imufloadbin !', ['SUCCESS'], 2000, (armed) => {
                if (!armed) {
                    self.flashFailed('imufFlashingArmFailed');
                    return;
                }

                self.flashingMessage(i18n.getMessage('imufFlashingLoading'), self.FLASH_MESSAGE_TYPES.ACTION);
                self.sendChunks(wireBytes, 0, (loaded) => {
                    if (!loaded) {
                        return; // sendChunks already reported the specific failure
                    }

                    self.flashingMessage(i18n.getMessage('imufFlashingCommitting'), self.FLASH_MESSAGE_TYPES.ACTION);
                    // cli.c's cliImufFlashBin prints nothing on failure (no "FAIL" branch exists) —
                    // a failed commit is only detectable by this timing out.
                    self.sendCliCommandExpect('imufflashbin', ['SUCCESS'], 8000, (committed, matched3) => {
                        if (!committed || matched3 !== 'SUCCESS') {
                            self.flashFailed('imufFlashingCommitFailed');
                            return;
                        }

                        self.flashProgress(100);
                        self.flashingMessage(i18n.getMessage('imufFlashingSuccess'), self.FLASH_MESSAGE_TYPES.VALID);
                        self.flashInProgress = false;
                        // Firmware reboots on its own after printing SUCCESS (cli.c: cliImufFlashBin ->
                        // cliReboot()); TABS.cli.read's existing 'Rebooting' detection (cli.js) already
                        // handles reconnection from here — nothing further to do.
                    });
                });
            });
        });
    });
};

// Leaves CLI mode via TABS.cli's own cleanup (sends 'exit', waits for the FC to fully
// reconnect in MSP mode) rather than just flipping CONFIGURATOR.cliActive locally — the FC
// itself doesn't know the flash attempt was abandoned unless told to exit CLI.
TABS.imuf_flashing.flashFailed = function (messageKey) {
    const self = this;
    self.flashInProgress = false;
    TABS.cli.cleanup(() => {
        self.enableFlashing(true);
        self.flashingMessage(i18n.getMessage(messageKey), self.FLASH_MESSAGE_TYPES.INVALID);
    });
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
    if (this.flashInProgress) {
        GUI.log(i18n.getMessage('imufFlashingAbortedTabSwitch'));
        this.flashInProgress = false;
        TABS.cli.cleanup(callback);
        return;
    }

    if (callback) {
        callback();
    }
};
