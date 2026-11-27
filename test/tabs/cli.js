describe('TABS.cli', () => {

    function toArrayBuffer(string) {
        var bufferOut = new ArrayBuffer(string.length);
        var bufView = new Uint8Array(bufferOut);

        for (var i = 0; i < string.length; i++) {
            bufView[i] = string.charCodeAt(i);
        }

        return bufferOut;
    }

    describe('output', () => {
        const cliTab = $('<div>').addClass('tab-cli');
        const cliOutput = $('<div>').addClass('wrapper')
        const cliPrompt = $('<textarea name="commands">');

        cliTab.append($('<div>').addClass('window').append(cliOutput));
        cliTab.append(cliPrompt);

        CliAutoComplete.setEnabled(false); // not testing the client-side autocomplete

        before(() => {
            $('body')
                .append(cliTab);

            CONFIGURATOR.cliValid = true;
        });

        after(() => cliTab.remove());

        beforeEach(() => {
            cliOutput.empty();
            cliPrompt.val('');
            TABS.cli.cliBuffer = "";
            TABS.cli.nativeCompletePending = true; // these reads are replies to a native Tab request
        });

        it('ambiguous auto-complete results', () => {
            TABS.cli.cliBuffer = 'se';

            TABS.cli.read({
                data: toArrayBuffer('\r\x1B[Kserialpassthrough\tservo\r\n# ser')
            });

            // Ambigous auto-complete from firmware is preceded with an \r carriage return
            // which only renders a line break on Mac
            const expectedValue = GUI.operating_system !== "Windows" ?
                'se<br>serialpassthrough\tservo<br>' :
                'seserialpassthrough\tservo<br>';
            expect(cliOutput.html()).to.equal(expectedValue);
            expect(cliPrompt.val()).to.equal('ser');
        });

        it('unambiguous auto-complete result', () => {
            TABS.cli.read({
                data: toArrayBuffer('serialpassthrough')
            });

            expect(cliOutput.html()).to.equal('');
            expect(cliPrompt.val()).to.equal('serialpassthrough');
        });

        it('unambiguous auto-complete result with partial buffer', () => {
            TABS.cli.cliBuffer = 'serial';

            TABS.cli.read({
                data: toArrayBuffer('passthrough')
            });

            expect(cliOutput.html()).to.equal('');
            expect(cliPrompt.val()).to.equal('serialpassthrough');
        });

        it("escape characters (i.e. \\x1B[K) are skipped", () => {
            TABS.cli.read({
                data: toArrayBuffer('\x1B[K')
            });

            expect(cliOutput.html()).to.equal('');
            expect(cliPrompt.val()).to.equal('');
        });

        it('output without a Tab request keeps what the user types', () => {
            TABS.cli.nativeCompletePending = false;
            cliPrompt.val('stat');

            TABS.cli.read({ data: toArrayBuffer('set foo = 1\r\n# ') });

            expect(cliPrompt.val()).to.equal('stat');
        });
    });

    describe('CLI entry marker', () => {
        const cliTab = $('<div>').addClass('tab-cli');
        const cliOutput = $('<div>').addClass('wrapper');
        cliTab.append($('<div>').addClass('window').append(cliOutput));
        let savedValid;

        before(() => {
            $('body').append(cliTab);
            savedValid = CONFIGURATOR.cliValid;
        });

        after(() => {
            cliTab.remove();
            CONFIGURATOR.cliValid = savedValid;
        });

        beforeEach(() => {
            CONFIGURATOR.cliValid = false;
            TABS.cli.validateText = "";
            cliOutput.empty();
            sinon.stub(CliAutoComplete, 'isEnabled').returns(false);
            sinon.stub(i18n, 'getMessage').returns('');
            sinon.stub(GUI, 'log');
        });

        afterEach(() => {
            CliAutoComplete.isEnabled.restore();
            i18n.getMessage.restore();
            GUI.log.restore();
        });

        it('is detected when the serial link splits it inside the word CLI', () => {
            TABS.cli.read({ data: toArrayBuffer('\r\nEntering C') });
            expect(CONFIGURATOR.cliValid).to.equal(false);

            TABS.cli.read({ data: toArrayBuffer("LI Mode, type 'exit' to return\r\n\r\n# ") });

            expect(CONFIGURATOR.cliValid).to.equal(true);
            expect(cliOutput.html()).to.contain("Entering CLI Mode, type 'exit' to return");
            expect(TABS.cli.validateText).to.equal('');
        });

        it('is detected when one read holds the whole marker', () => {
            TABS.cli.read({ data: toArrayBuffer("\r\nEntering CLI Mode\r\n# ") });

            expect(CONFIGURATOR.cliValid).to.equal(true);
        });

        it('is not detected without the marker', () => {
            TABS.cli.read({ data: toArrayBuffer('\x24M>\x00') });
            TABS.cli.read({ data: toArrayBuffer('C') });

            expect(CONFIGURATOR.cliValid).to.equal(false);
        });
    });

    function triggerEnterKey(input) {
        const enterKeycode = 13;
        const event = $.Event("keypress");
        event.which = enterKeycode;
        input.trigger(event);
    }

    function triggerTabKey(input) {
        const tabKeycode = 9;
        const event = $.Event("keydown");
        event.which = tabKeycode;
        input.trigger(event);
    }

    const backspaceCode = String.fromCharCode(127);

    // Enter submits through an async command queue; wait for the first send before asserting.
    function afterSend(done, assertions) {
        const started = Date.now();
        (function poll() {
            if (TABS.cli.send.called || Date.now() - started > 1000) {
                try {
                    assertions();
                    done();
                } catch (e) {
                    done(e);
                }
            } else {
                setTimeout(poll, 5);
            }
        })();
    }

    describe('input', () => {
        const content = $('<div>').attr('id', 'content');
        const cliTab = $('<div>').addClass('tab-cli');
        const cliPrompt = $('<textarea name="commands">');
        cliTab.append(cliPrompt);

        let savedFlags;

        beforeEach(() => {
            savedFlags = { cliValid: CONFIGURATOR.cliValid, connectionValid: CONFIGURATOR.connectionValid };
            $('body')
                .append(content);

            // Stub loading of template.
            sinon.stub($.fn, 'load').callsFake((file, callback) => {
                content.append(cliTab);
                callback();
            });
            sinon.stub(TABS.cli, 'send');
            sinon.stub(GUI, 'timeout_add').withArgs('CLI_send_slowly')
                .callsFake((name, cb) => {
                    cb();
                });

            TABS.cli.cliBuffer = "";
        });

        afterEach(() => {
            CliAutoComplete.fw = null;
            CliAutoComplete.fwCandidates = null;
            Object.assign(CONFIGURATOR, savedFlags);
            content.remove();
            $.fn.load.restore();
            TABS.cli.send.restore();
            GUI.timeout_add.restore();
            delete window.MSP;
        });

        beforeEach(() => {
            cliPrompt.val('');
            content.empty();
        });

        it('tab key triggers serial message with appended tab char', done => {
            TABS.cli.initialize(() => {
                cliPrompt.val('serial');

                triggerTabKey(cliPrompt);

                expect(TABS.cli.send).to.have.been.calledOnce;
                expect(TABS.cli.send).to.have.been.calledWith('serial\t');
                done()
            });
        });

        it('second auto complete in row', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# ser';

                cliPrompt.val('seri');

                triggerTabKey(cliPrompt);

                expect(TABS.cli.send).to.have.been.calledOnce;
                expect(TABS.cli.send).to.have.been.calledWith('i\t');
                done();
            });
        });

        it('auto-complete command with trailing space', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# get ';

                cliPrompt.val('get r');

                triggerTabKey(cliPrompt);

                expect(TABS.cli.send).to.have.been.calledOnce;
                expect(TABS.cli.send).to.have.been.calledWith('r\t');
                done();
            });
        });

        it('auto-complete after delete characters', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# serial';

                cliPrompt.val('ser');

                triggerTabKey(cliPrompt);

                expect(TABS.cli.send).to.have.been.calledOnce;
                expect(TABS.cli.send).to.have.been.calledWith(backspaceCode.repeat(3) + '\t');
                done();
            });
        });

        it('enter after autocomplete', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# servo';

                cliPrompt.val('servo');

                triggerEnterKey(cliPrompt);

                afterSend(done, () => {
                    expect(TABS.cli.send).to.have.been.calledOnce;
                    expect(TABS.cli.send).to.have.been.calledWith('\n');
                });
            });
        });

        it('enter after autocomplete', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# ser';

                cliPrompt.val('servo');

                triggerEnterKey(cliPrompt);

                afterSend(done, () => {
                    expect(TABS.cli.send).to.have.been.calledOnce;
                    expect(TABS.cli.send).to.have.been.calledWith('vo\n');
                });
            });
        });

        it('enter after deleting characters', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# serial';

                cliPrompt.val('ser');

                triggerEnterKey(cliPrompt);

                afterSend(done, () => {
                    expect(TABS.cli.send).to.have.been.calledOnce;
                    expect(TABS.cli.send).to.have.been.calledWith(backspaceCode.repeat(3) + '\n');
                });
            });
        });

        // The board's partial output line is raw text; it can hold characters that are special in a RegExp.
        it('enter while output with a bracket is in flight still sends the line', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = 'set mixer = (';

                cliPrompt.val('status');

                triggerEnterKey(cliPrompt);

                afterSend(done, () => {
                    expect(TABS.cli.send).to.have.been.calledOnce;
                });
            });
        });

        it('tab with a bracket in the board buffer does not throw', done => {
            TABS.cli.initialize(() => {
                TABS.cli.cliBuffer = '# gyro_lpf[';

                cliPrompt.val('gyro_lpf[');

                expect(() => triggerTabKey(cliPrompt)).to.not.throw();
                done();
            });
        });

        it('a line that fails to send does not block later submissions', done => {
            TABS.cli.send.onFirstCall().throws(new Error('send failed'));
            sinon.stub(console, 'error');

            TABS.cli.initialize(() => {
                cliPrompt.val('first');
                triggerEnterKey(cliPrompt);
                TABS.cli.send.callsFake((line, callback) => { if (callback) { callback(); } });

                cliPrompt.val('second');
                triggerEnterKey(cliPrompt);

                const started = Date.now();
                (function poll() {
                    if (TABS.cli.send.calledWith('second\n') || Date.now() - started > 1000) {
                        console.error.restore();
                        try {
                            expect(TABS.cli.send).to.have.been.calledWith('second\n');
                            expect(TABS.cli.pendingCommandLines).to.equal(0);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    } else {
                        setTimeout(poll, 5);
                    }
                })();
            });
        });

        it('a line that fails to send skips the unsent lines of its batch', done => {
            TABS.cli.send.callsFake((line, callback) => {
                if (line === 'set foo = 1\n') { throw new Error('send failed'); }
                if (callback) { callback(); }
            });
            sinon.stub(console, 'error');

            TABS.cli.initialize(() => {
                cliPrompt.val('set foo = 1\nsave');
                triggerEnterKey(cliPrompt);

                const started = Date.now();
                (function poll() {
                    if (TABS.cli.pendingCommandLines === 0 || Date.now() - started > 1000) {
                        console.error.restore();
                        try {
                            expect(TABS.cli.send).to.have.been.calledWith('set foo = 1\n');
                            expect(TABS.cli.send).to.not.have.been.calledWith('save\n');
                            expect(TABS.cli.pendingCommandLines).to.equal(0);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    } else {
                        setTimeout(poll, 5);
                    }
                })();
            });
        });

        it('a line settles once when its send callback runs and the send then throws', done => {
            sinon.stub(console, 'error');
            let pendingWhenSecondSends = null;
            TABS.cli.send.callsFake((line, callback) => {
                if (line === 'b\n') { pendingWhenSecondSends = TABS.cli.pendingCommandLines; }
                callback();
                throw new Error('late');
            });

            TABS.cli.initialize(() => {
                cliPrompt.val('a');
                triggerEnterKey(cliPrompt);
                cliPrompt.val('b');
                triggerEnterKey(cliPrompt);

                setTimeout(() => {
                    console.error.restore();
                    try {
                        expect(pendingWhenSecondSends).to.equal(1); // only line b is still unsent
                        expect(TABS.cli.pendingCommandLines).to.equal(0);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, 300);
            });
        });

        it('history recall drops the firmware candidates of the replaced line', done => {
            TABS.cli.initialize(() => {
                TABS.cli.history.add('dma UART_TX 1');
                CliAutoComplete.fwCandidates = { base: 'dma ', words: ['UART_TX', 'UART_RX'] };

                const event = $.Event('keyup');
                event.keyCode = 38;
                cliPrompt.trigger(event);

                expect(cliPrompt.val()).to.equal('dma UART_TX 1');
                expect(CliAutoComplete.fwCandidates).to.equal(null);
                done();
            });
        });

        it('output after a native Tab reply does not replace text typed since', done => {
            TABS.cli.initialize(() => {
                CONFIGURATOR.cliValid = true;
                TABS.cli.cliBuffer = '# s';
                cliPrompt.val('se');
                triggerTabKey(cliPrompt); // sends "e" + Tab

                TABS.cli.read({ data: new Uint8Array([101, 114, 105]).buffer }); // board echoes "eri"
                expect(cliPrompt.val()).to.equal('seri');

                cliPrompt.val('seria').trigger('input'); // user types on
                TABS.cli.read({ data: new Uint8Array([10, 13]).buffer });
                expect(cliPrompt.val()).to.equal('seria');
                done();
            });
        });

        it('queued Enter runs when autocomplete is switched off mid-request', done => {
            TABS.cli.initialize(() => {
                CONFIGURATOR.cliValid = true;
                CliAutoComplete.configEnabled = true;
                CliAutoComplete.fw = { timer: null, phase: 'clear', line: '', orig: '', result: {}, sendRaw: () => {} };
                CliAutoComplete.queueFirmwareEnter('status');

                CliAutoComplete.setEnabled(false);
                CliAutoComplete._fwDone();

                afterSend(done, () => {
                    expect(TABS.cli.send).to.have.been.calledWith('status\n');
                });
            });
        });

        it('queued Enter is dropped when the CLI tab closes', done => {
            TABS.cli.initialize(() => {
                CONFIGURATOR.connectionValid = false;
                CliAutoComplete.fw = { timer: null, phase: 'clear', line: '', sendRaw: () => {} };
                CliAutoComplete.queueFirmwareEnter('status');

                TABS.cli.cleanup();

                setTimeout(() => {
                    expect(TABS.cli.send).to.not.have.been.called;
                    done();
                }, 100);
            });
        });

        it('cliBuffer is cleared on startup', done => {
            TABS.cli.cliBuffer = '# serial';

            TABS.cli.initialize(() => {
                expect(TABS.cli.cliBuffer).to.equal('');
                done();
            });
        });

        it('exit upon cleanup clears cliBuffer first', done => {
            CONFIGURATOR.connectionValid = true;
            TABS.cli.cliValid = true;
            window.MSP = { callbacks_cleanup: sinon.stub() };

            TABS.cli.initialize(() => {
                const commandInBuffer = 'resource';

                TABS.cli.cliBuffer = `# ${commandInBuffer}`;

                TABS.cli.cleanup();

                expect(TABS.cli.send).to.have.been.calledOnce;
                expect(TABS.cli.send).to.have.been.calledWith(backspaceCode.repeat(commandInBuffer.length) + 'exit\r');
                done();
            });
        });
    });
});
