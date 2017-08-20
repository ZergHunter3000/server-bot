module.exports = {
    Players: function (data, logger) {
        this.players = [];

        this._getPlayers = _getPlayers;
        this.players = this._getPlayers(data);

        logger.info('-| Current player list calculated as: ' + this.players + ' |-');
    }
};

function _getPlayers(data) {
    let players = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
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