describe('CliAutoComplete resource strategy', () => {
    const $textarea = $('<textarea>');
    let strategy;

    before(() => {
        $('body').append($textarea);
        CliAutoComplete.$textarea = $textarea;
        CliAutoComplete.cache = { commands: [], resources: ['MOTOR', 'SERVO', 'SERIAL_TX'], resourcesCount: { MOTOR: 8, SERVO: 8, SERIAL_TX: 3 }, mixers: [], mixerCount: 0 };
        CliAutoComplete._initTextcomplete();
        strategy = CliAutoComplete.strategies.find(s => s.match.test('resource '));
    });

    after(() => {
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
});
