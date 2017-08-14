let Discord       = require('discord.io');
let logger        = require('winston');
let auth          = require('./auth.json');
let io            = require('net');
let child_process = require('child_process');

let socket;
let playerList;



/* Configure Logger Settings */
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';



/* Initialize Discord Bot */
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



/* Telnet Socket Connections */
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
                logger.error('Error: ECONNREFUSED');
            } else {
                logger.error(err.stack);
            }
        });
};

function _initializeSocketListeners() {
    /******************
     * Data Listeners *
     ******************/
    socket.on('data', function (data) {
        logger.info(data.toString());

        // Enter credentials
        if (data.toString().indexOf('lease enter password:') !== -1) {
            logger.info('Entering credentials...');
            socket.emit('inputPass');
        }

        // Alert wandering horde towards player
        if (data.toString().indexOf('Spawning wandering horde') !== -1) {
            sendMessage('Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1] + '.', 'warning');
        }

        // Alert scout-triggered horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('A \'Scout-Triggered\' horde has just finishing spawning mobs.', 'warning');
        }

        // Alert scout horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('A \'Scout\' horde has just finishing spawning mobs.', 'warning');
        }

        // Display # of players online
        if (data.toString().indexOf('in the game') !== -1) {
            sendMessage('There are ' + data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' player(s) online.', 'info');
            playerList = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
        }

        // Display # of players online
        if (data.toString().indexOf('Spawned supply crate') !== -1) {
            playerList = null;
            socket.emit('getPlayers');
            setTimeout(function () {
                if (playerList !== null) {
                    let playerDetails = getPlayerDetails();
                    let airDropDetails = getAirDropDetails(data.toString().match(new RegExp('crate @ ' + '(.*)' + ''))[1]);
                    sendMessage('Airdrop spawned near: ' + findClosest(playerDetails, airDropDetails).name, 'info');
                }
            }, 3500);
        }
    });


    //Spawned supply crate @ ((1801.0, 191.1, 15.6)) X | Z | Y


    /******************
     * Write commands *
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
}

function getPlayerDetails() {
    let players = playerList;
    playerList = null;
    let newPlayers = [];

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
        console.log(next.x, next.y, next.name);
    }

    return newPlayers;
}

function getAirDropDetails(data) {
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

    return details;
}

function findClosest(players, airdrop) {
    let closestPlayer = {};

    closestPlayer.distance = Math.sqrt(Math.pow(players[0].x - airdrop.x, 2) + Math.pow(players[0].y - airdrop.y, 2));
    for (let p of players) {
        console.log(p);
        let d = Math.sqrt(Math.pow(p.x - airdrop.x, 2) + Math.pow(p.y - airdrop.y, 2));
        if (d <= closestPlayer.distance) {
            closestPlayer.distance = d;
            closestPlayer.name = p.name;
            closestPlayer.x = p.x;
            closestPlayer.y = p.y;
        }
    }
    console.log(closestPlayer);
    return closestPlayer;
}

//TODO IMPLEMENT GET DIRECTION NW/SW/ETC
function getDirection(player) {

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



/* Command Input */
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
                /* Request list of commands */
                case 'help':
                    sendMessage('List of commands (proceeded by \'$\'):\nstart\nstop\nstatus\nplayers', 'info');
                    break;

                /* Request server shutdown */
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

                /* Request # of online players */
                case 'players':
                    socket.emit('getPlayers');
                    break;

                /* Request server start if not already started */
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
                                sendMessage('Starting server... (Please wait 30 seconds before giving any commands)', 'info');

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
                                    }, 8000);
                                }, 22000);
                            }
                        }, 6000);
                    }
                    break;

                /* Request status of the server */
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