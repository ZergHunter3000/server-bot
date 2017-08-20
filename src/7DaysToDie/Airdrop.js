module.exports = {
    Airdrop: function (data, logger) {
        this.x = 0;
        this.y = 0;

        this.getPlayerDirection = _getPlayerDirection;
        this.findClosest = _findClosest;
        this._getAirDropDetails = _getAirDropDetails;

        this.getPlayerDirection.logger = logger;
        this.findClosest.logger = logger;

        let coordinates = this._getAirDropDetails(data.toString().match(new RegExp('crate @ ' + '(.*)' + ''))[1]);

        this.x = coordinates.x;
        this.y = coordinates.y;

        logger.info('| Airdrop created with coordinates (' + this.x + ', ' + this.y + ') |')
    }
};

function _getPlayerDirection(player) {
    let direction = '';

    if (this.y > player.y) {
        direction += 'North';
    } else if (this.y < player.y) {
        direction += 'South';
    }

    if (this.x > player.x) {
        direction += ' East';
    } else if (this.x < player.x) {
        direction += ' West';
    }

    return direction;
}

function _getAirDropDetails(data) {
    let coordinates = {};
    // data.replace (/abc/g, ''); TODO Implement
    data = data.replace('(', '');
    data = data.replace('(', '');
    data = data.replace(')', '');
    data = data.replace(')', '');
    data = data.replace(',', '');
    data = data.replace(',', '');

    coordinates.x = parseInt(data.split(' ')[0]);
    coordinates.y = parseInt(data.split(' ')[2]);

    return coordinates;
}

function _findClosest(players, airdrop) {
    console.log('SUPERRRRRRRRRRRRRRRRRRRRRRRRRRRRRR\n', players, 'SUPERRRRRRRRRRRRRRRRRRRRRRRRRRRRRR\n');
    let closestPlayer = {};
    closestPlayer.distance = Math.sqrt(Math.pow(players[0].x - airdrop.x, 2) + Math.pow(players[0].y - airdrop.y, 2));

    for (let p of players) {
        let d = Math.sqrt(Math.pow(p.x - airdrop.x, 2) + Math.pow(p.y - airdrop.y, 2));
        if (d <= closestPlayer.distance) {
            closestPlayer.distance = d;
            closestPlayer.name = p.name;
            closestPlayer.x = p.x;
            closestPlayer.y = p.y;
        }
    }

    return closestPlayer;
}