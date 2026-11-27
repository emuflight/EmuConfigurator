describe('CliAutoComplete resource strategy', () => {
    const $textarea = $('<textarea>');
    let strategy;
    let savedConfig;
    let savedSemver;

    before(() => {
        // semver is an app-level global; the karma file list does not load it
        savedSemver = window.semver;
        if (typeof semver === 'undefined') {
            const num = v => v.split('.').map(Number);
            window.semver = { gte: (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] ? (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) > 0 : true; } };
        }
        savedConfig = window.CONFIG;
        window.CONFIG = { apiVersion: '1.55.0' };
        $('body').append($textarea);
        CliAutoComplete.$textarea = $textarea;
        CliAutoComplete.cache = { commands: [], resources: ['MOTOR', 'SERVO', 'SERIAL_TX'], resourcesCount: { MOTOR: 8, SERVO: 8, SERIAL_TX: 3 }, mixers: [], mixerCount: 0 };
        CliAutoComplete._initTextcomplete();
        strategy = CliAutoComplete.strategies.find(s => s.match.test('resource '));
    });

    after(() => {
        window.CONFIG = savedConfig;
        window.semver = savedSemver;
        $textarea.textcomplete('destroy');
        $textarea.remove();
    });

    function search(term) {
        let res;
        CliAutoComplete.forceOpen = true;
        strategy.search(term, r => { res = r; });
        CliAutoComplete.forceOpen = false;
        return res;
    }

    it('offers show and list before the owners', () => {
        expect(search('')).to.deep.equal(['show', 'list', 'MOTOR', 'SERVO', 'SERIAL_TX']);
    });

    it('narrows to show for the prefix "sh" and offers nothing for a bogus prefix', () => {
        expect(search('sh')).to.deep.equal(['show']);
        expect(search('zzz')).to.deep.equal([]);
    });

    it('does not offer show on firmware older than MSP API 1.55.0', () => {
        window.CONFIG.apiVersion = '1.54.1';
        try {
            expect(search('')).to.deep.equal(['list', 'MOTOR', 'SERVO', 'SERIAL_TX']);
            expect(search('sh')).to.deep.equal([]);
        } finally {
            window.CONFIG.apiVersion = '1.55.0';
        }
    });

    describe('Enter on a selected candidate', () => {
        // textcomplete calls onKeydown before replace(); onKeydown then reads sendOnEnter after a tick
        function pressEnterAfterSelecting(value) {
            const sent = [];
            const onKeypress = e => { if (e.which === 13) { sent.push(value); } };
            $textarea.on('keypress', onKeypress);
            strategy.replace(value);
            const onKeydown = $textarea.data('textComplete').option.onKeydown;
            onKeydown({ which: 13 });
            return new Promise(resolve => setTimeout(() => {
                $textarea.off('keypress', onKeypress);
                resolve(sent);
            }, 5));
        }

        it('submits show', async () => {
            expect(await pressEnterAfterSelecting('show')).to.deep.equal(['show']);
        });

        it('does not submit an owner that still needs a pin', async () => {
            expect(await pressEnterAfterSelecting('MOTOR')).to.deep.equal([]);
        });
    });
});

describe('CliAutoComplete firmware drain window', () => {
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        CliAutoComplete.$textarea = null;
        CliAutoComplete.fwEnterQueue = [];
    });

    afterEach(() => {
        CliAutoComplete.setFirmwareDraining(false);
        clock.restore();
    });

    function finishRequest() {
        CliAutoComplete.fw = { timer: null, result: {}, orig: '' };
        CliAutoComplete._fwDone();
    }

    it('lasts 150 ms after a request ends', () => {
        finishRequest();
        clock.tick(149);
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(true);
        clock.tick(2);
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(false);
    });

    it('a later request keeps its own full window', () => {
        finishRequest();
        clock.tick(100);
        finishRequest(); // second window starts at t=100 and ends at t=250
        clock.tick(60); // t=160: the first timer must not have ended it
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(true);
        clock.tick(100);
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(false);
    });

    it('cleanup ends the window and leaves no timer behind', () => {
        finishRequest();
        CliAutoComplete.cleanup();
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(false);
        CliAutoComplete.setFirmwareDraining(true); // a new window must not be ended by the old timer
        clock.tick(200);
        CliAutoComplete.setFirmwareDraining(false);
    });

    it('switching autocomplete off during a request waits for the request, then runs queued Enters', () => {
        const submit = sinon.stub();
        const savedActive = CONFIGURATOR.cliActive, savedValid = CONFIGURATOR.cliValid;
        CONFIGURATOR.cliActive = true;
        CONFIGURATOR.cliValid = true;
        CliAutoComplete.setCommandSubmitter(submit);
        CliAutoComplete.configEnabled = true;
        CliAutoComplete.fw = { timer: null, result: {}, orig: '' };
        CliAutoComplete.queueFirmwareEnter('status');

        CliAutoComplete.setEnabled(false);
        expect(CliAutoComplete.fw).to.not.equal(null); // request not torn down
        expect(submit).to.not.have.been.called;

        CliAutoComplete._fwDone();

        expect(submit).to.have.been.calledOnceWith(['status']);
        expect(CliAutoComplete.isFirmwareBusy()).to.equal(false);
        expect(CliAutoComplete.isFirmwareDraining()).to.equal(true); // the request echo is still dropped
        CliAutoComplete.setCommandSubmitter(null);
        CONFIGURATOR.cliActive = savedActive;
        CONFIGURATOR.cliValid = savedValid;
    });

    it('cleanup drops queued Enters (tab close)', () => {
        const submit = sinon.stub();
        CliAutoComplete.setCommandSubmitter(submit);
        CliAutoComplete.queueFirmwareEnter('status');

        CliAutoComplete.cleanup();

        expect(submit).to.not.have.been.called;
        expect(CliAutoComplete.fwEnterQueue).to.deep.equal([]);
        CliAutoComplete.setCommandSubmitter(null);
    });
});
