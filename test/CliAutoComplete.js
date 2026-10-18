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
