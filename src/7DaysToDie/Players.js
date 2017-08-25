module.exports = {
    Players: function (data) {
        this.players = [];

        this._getPlayers = _getPlayers;
        console.log('~~~IN CASE OF CRASH, DATA = ', data.toString());
        this.players = this._getPlayers(data);

        console.log('-| Current player list calculated as: ' + this.players + ' |-');
    }
};

function _getPlayers(data) {
    let players = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));

    if (players == null) {
        console.log('\n~~~~~~~~~~~~~~~~~~~~~~~CRASH WAS GOING TO HAPPEN, ABORTED, SEND BELOW TO CONNOR~~~~~~~~~~~~~~~~~~~~~~~');
        console.log('~~~~~~~~~~~~~FUNCTION DATA~~~~~~~~~~~~~\n', data.toString());
        console.log('~~~~~~~~~~~~~PLAYERS~~~~~~~~~~~~~\n', players);
        console.log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        return [];
    }
    let currentPlayers = [];
    let next;
    let name;
    let pos;

    console.log('THIS IS THE PLAYER DETAILS: ', players);

    for (let i = 0; i < players.length; i += 2) {
        next = {};
        name = players[i].match(new RegExp(', ' + '(.*)' + ', pos'))[1];
        pos = players[i].match(new RegExp('pos=' + '(.*)' + ', rot'))[1];
        pos = pos.replace(')', '');
        pos = pos.replace('(', '');
        pos = pos.replace(',', '');
        pos = pos.replace(',', '');

        next.x = parseInt(pos.split(' ')[0]);
        next.y = parseInt(pos.split(' ')[2]);
        next.name = name;

        currentPlayers.push(next);
    }

    return currentPlayers;
}