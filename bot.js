let Discord       = require('discord.io');
let logger        = require('winston');
let auth          = require('./auth.json');
let io            = require('net');
let child_process = require('child_process');

let socket;
let playerList;
let airdropToggle = false;



/** Configure Logger Settings **/
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';



/** Initialize Discord Bot **/
let bot = new Discord.Client({
    token: auth.token,
    autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    initializeSocket();
});



/** Telnet Socket Connections **/
initializeSocket = function () {
    socket = io.connect(auth.port, auth.host, function () {
        setGameStatus(true);
        _initializeSocketListeners();
    })
        .on("error", function (err) {
            setTimeout (function () {
                setGameStatus(false);
            }, 500);

            if (err.toString().indexOf('ECONNREFUSED') !== -1) {
                logger.error('Error: [ECONNREFUSED] Can\'t connect to Telnet');
            } else {
                logger.error(err.stack);
            }
        });
};

function _initializeSocketListeners() {
    /*****************
     * Data Listener *
     *****************/
    socket.on('data', function (data) {
        logger.info(data.toString());

        // Enter credentials
        if (data.toString().indexOf('lease enter password:') !== -1) {
            logger.info('~| Entering credentials... |~');
            socket.emit('inputPass');
        }

        // Alert wandering horde towards player
        if (data.toString().indexOf('Spawning wandering horde') !== -1) {
            sendMessage('Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1], 'warning');
        }

        // Alert scout-triggered horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('A \'Scout-Triggered\' horde has just finishing spawning mobs', 'warning');
        }

        // Display # of players online
        if (data.toString().indexOf('in the game') !== -1) {
            if (airdropToggle === false) {
                sendMessage('There are ' + data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' player(s) online.', 'info');
            } else {
                playerList = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
                airdropToggle = false;
            }
        }

        // Notify airdrop spawned
        if (data.toString().indexOf('Spawned supply crate') !== -1) {
            sendMessage('Airdrop incoming; calculating nearest player...', 'info');
            playerList = null;
            airdropToggle = true;
            socket.emit('getPlayers');
            socket.emit('calculateAirdropPing', data);
        }
    });

    /******************
     * Write Commands *
     ******************/
    // Input password
    socket.on('inputPass', function () {
        socket.write(auth.telnetPass + '\r\n');
    });

    // Get player count
    socket.on('getPlayers', function () {
        socket.write('listplayers\r\n');

    });

    // Shutdown server
    socket.on('shutdown', function () {
        socket.write('shutdown\r\n');
    });

    /**************
     * Ping Pongs *
     **************/
    socket.on('calculateAirdropPing', function (data) {
        if (playerList !== null) {
            let playerDetails = getPlayerDetails();
            let airDropDetails = getAirDropDetails(data.toString().match(new RegExp('crate @ ' + '(.*)' + ''))[1]);
            let closest = findClosest(playerDetails, airDropDetails);
            sendMessage('Airdrop spawned ' + getDirection(closest, airDropDetails) + ' of ' + closest.name + '.', 'info');
        } else {
            socket.emit('calculateAirdropPong', data);
        }
    });

    socket.on('calculateAirdropPong', function (data) {
        setTimeout(function () {
            socket.emit('calculateAirdropPing', data);
        }, 1000);
    })
}



/** General Functions/Calculations **/
function getPlayerDetails() {
    logger.info('~| Calculating player details... |~');

    let players = playerList;
    let newPlayers = [];
    playerList = null;

    for (let i = 0; i < players.length; i += 2) {
        let next = {};
        let pos = players[i].match(new RegExp('pos=' + '(.*)' + ', rot'))[1];
        let name = players[i].match(new RegExp(', ' + '(.*)' + ', pos'))[1];
        pos = pos.replace(')', '');
        pos = pos.replace('(', '');
        pos = pos.replace(',', '');
        pos = pos.replace(',', '');
        next.x = parseInt(pos.split(' ')[0]);
        next.y = parseInt(pos.split(' ')[2]);
        next.name = name;
        newPlayers.push(next);
        logger.info('~| Player calculated with details: ' + next.x, next.y, next.name + ' |~');
    }

    return newPlayers;
}

function getAirDropDetails(data) {
    logger.info('~| Calculating airdrop details... |~');
    let details = {};
    // data.replace (/abc/g, ''); TODO IMPLEMENT
    data = data.replace('(', '');
    data = data.replace('(', '');
    data = data.replace(')', '');
    data = data.replace(')', '');
    data = data.replace(',', '');
    data = data.replace(',', '');

    details.x = parseInt(data.split(' ')[0]);
    details.y = parseInt(data.split(' ')[2]);

    logger.info('~| Airdrop calculated with details: ' + details.x, details.y + ' |~');

    return details;
}

function findClosest(players, airdrop) {
    logger.info('~| Calculating closest player... |~');

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

    logger.info('~| Calculated closest player with details: ' + closestPlayer.name, closestPlayer.x, closestPlayer.y, closestPlayer.distance + ' |~');

    return closestPlayer;
}

//TODO Improve calculation
function getDirection(player, airdrop) {
    let direction = '';

    if (airdrop.y > player.y) {
        direction += 'North';
    } else {
        direction += 'South';
    }

    if (airdrop.x > player.x) {
        direction += 'East';
    } else {
        direction += 'West';
    }

    return direction;
}

function sendMessage (message, type) {
    if (type === 'info') {
        bot.sendMessage({
            to: auth.channel,
            message: '```css\n' + message + '\n```'
        });
    } else if (type === 'warning') {
        bot.sendMessage({
            to: auth.channel,
            message: '```diff\n-Warning:  ' + message + '\n```'
        });
    }
}

function setGameStatus(online) {
    if (online) {
        bot.setPresence(
            {
                status: 'online',
                game: {name: '7 Days to Die'}
            });
    } else {
        bot.setPresence(
            {
                status: 'online',
                game: {name: ''}
            });
    }
}



/** Command Input **/
bot.on('message', function (user, userId, channelId, message, evt) {
    if (channelId === auth.channel && message.substring(0, 1) === '$') {
        let args = message.substring(1).split(' ');
        let cmd = args[0];
        let delay = 0;

        args = args.splice(1);

        if (!socket.readable) {
            delay = 1500;
            initializeSocket();
        }

        setTimeout(function () {
            switch (cmd) {
                // Request list of commands
                case 'help':
                    sendMessage('List of commands (proceeded by \'$\'):\nstart\nstop\nstatus\nplayers', 'info');
                    break;

                // Request server shutdown
                case 'stop':
                    if (socket.readable) {
                        sendMessage('Shutting down server...', 'info');
                        socket.emit('shutdown');
                        setGameStatus(false);
                    } else {
                        sendMessage('Server is already offline.', 'info');
                        setGameStatus(false);
                    }
                    break;

                // Request # of online players
                case 'players':
                    socket.emit('getPlayers');
                    break;

                // Request server start if not already started
                case 'start':
                    if (socket.readable) {
                        setGameStatus(true);
                        sendMessage('Server is already running.', 'info');
                    } else {
                        sendMessage('Verifying server is offline...', 'info');

                        initializeSocket();

                        setTimeout(function () {
                            if (socket.readable) {
                                setGameStatus(true);
                                sendMessage('Server is already running.', 'info');
                            } else {
                                setGameStatus(false);
                                sendMessage('Starting server... (Please wait 35 seconds before giving any commands)', 'info');

                                child_process.exec('D:\\runserver.bat', function (error, stdout, stderr) {
                                    console.log(error, stdout, stderr);
                                });

                                setTimeout(function () {
                                    initializeSocket();

                                    setTimeout(function () {
                                        if (socket.readable) {
                                            setGameStatus(true);
                                            sendMessage('Successfully started server.', 'info');
                                        } else {
                                            setGameStatus(false);
                                            sendMessage('Failed to start server (type $status to verify).', 'info');
                                        }
                                    }, 7000);
                                }, 28000);
                            }
                        }, 6000);
                    }
                    break;

                // Request status of the server
                case 'status':
                    if (socket.readable) {
                        setGameStatus(true);
                        sendMessage('Server is running.', 'info');
                    } else {
                        sendMessage('Socket connection closed... reestablishing connection to server.', 'info');

                        initializeSocket();

                        setTimeout(function () {
                            if (socket.readable) {
                                setGameStatus(true);
                                sendMessage('Server is running.', 'info');
                            } else {
                                setGameStatus(false);
                                sendMessage('Server is offline.', 'info');
                            }
                        }, 2000);
                    }
                    break;
            }
        }, delay);
    }
});