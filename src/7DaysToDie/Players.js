module.exports = {
    Players: function (data, logger) {
        this.players = [];

        this._getPlayers = _getPlayers;
        logger.info('~~~IN CASE OF CRASH, DATA = ', data.toString());
        this.players = this._getPlayers(data);

        logger.info('-| Current player list calculated as: ' + this.players + ' |-');
    }
};

function _getPlayers(data) {
    console.log('~~~IN CASE OF CRASH, DATA IN FUNCTION = ', data.toString());
    let players = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
    console.log('~~~IN CASE OF CRASH, PLAYER CALCULATE = ', players.toString());

    if (players === null) {
        console.log('~~~~~~~~~~~~~CRASH WAS GOING TO HAPPEN, ABORTED, CHECK LOGS, SEND TO CONNOR')
        return [];
    }
    let currentPlayers = [];
    let next;
    let name;
    let pos;

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