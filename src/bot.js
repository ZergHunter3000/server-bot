let Discord       = require('discord.io');
let logger        = require('winston');
let auth          = require('../auth.json');
let io            = require('net');
let child_process = require('child_process');

let Airdrop       = require('./7DaysToDie/Airdrop.js');
let Players       = require('./7DaysToDie/Players.js');
let usermap       = require('./usermap.json');

let socket;
let currentPlayerData;
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
    cycleCheckSocket();
});



/** Telnet Socket Connections **/
function initializeSocket () {
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
}

function _initializeSocketListeners() {
    /*****************
     * Data Listener *
     *****************/
    socket.on('data', function (data) {
        logger.info(data.toString());

        // Enter credentials
        if (data.toString().indexOf('lease enter password:') !== -1) {
            logger.info('| Entering credentials... |');
            socket.emit('inputPass');
        }

        // Alert wandering horde towards player
        if (data.toString().indexOf('Spawning wandering horde') !== -1) {
            sendMessage('Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1], 'warning', true);
        }

        // Alert scout-triggered horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('A \'Scout-Triggered\' horde has just finishing spawning mobs', 'warning', true);
        }

        // Display # of players online
        if (data.toString().indexOf('in the game') !== -1) {
            if (airdropToggle === false) {
                //playersData = data;
                //currentPlayers = new Players.Players(data, logger);
                sendMessage('There are ' + data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' player(s) online.', 'info');
            } else {
                currentPlayerData = data; //= data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
                airdropToggle = false;
            }
        }

        // Notify airdrop spawned
        if (data.toString().indexOf('Spawned supply crate') !== -1) {
            sendMessage('Airdrop incoming; calculating nearest player...', 'info', true);
            currentPlayerData = null;
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
    // Air Drop
    socket.on('calculateAirdropPing', function (data) {
        let tempData = currentPlayerData;
        if (tempData !== null) {
            currentPlayerData = null;
            let airdrop = new Airdrop.Airdrop(data, logger);
            let currentPlayers = new Players.Players(tempData, logger);
            let closest = airdrop.findClosest(currentPlayers.players, airdrop);
            sendMessage('Airdrop spawned ' + airdrop.getPlayerDirection(closest, airdrop) + ' of ' + closest.name + '.', 'info', true);
        } else {
            socket.emit('calculateAirdropPong', data);
        }
    });

    socket.on('calculateAirdropPong', function (data) {
        setTimeout(function () {
            socket.emit('calculateAirdropPing', data);
        }, 1000);
    });

    // // Start Server
    // socket.on('startServerPing', function (timer) {
    //     if (timer < 30) {
    //
    //     }
    //
    //
    //     if (playerList !== null) {
    //         let playerDetails = getPlayerDetails();
    //         let airDropDetails = getAirDropDetails(data.toString().match(new RegExp('crate @ ' + '(.*)' + ''))[1]);
    //         let closest = findClosest(playerDetails, airDropDetails);
    //         sendMessage('Airdrop spawned ' + getDirection(closest, airDropDetails) + ' of ' + closest.name + '.', 'info');
    //     } else {
    //         socket.emit('calculateAirdropPong', data);
    //     }
    // });
    //
    // socket.on('calculateAirdropPong', function (data) {
    //     setTimeout(function () {
    //         socket.emit('calculateAirdropPing', data);
    //     }, 1000);
    // })
}

function cycleCheckSocket() {
    setTimeout(function () {
        if (!socket.readable) {
            initializeSocket();
        }
        cycleCheckSocket();
    }, 600000);
}



/** General Functions/Calculations **/
function sendMessage (message, type, say = false) {
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

    if (say) {
        socket.write('say "' + message + '"\r\n')
    }
}

function setGameStatus(online) {
    if (online) {
        bot.setPresence({idle_since: null, game: {name: '7 Days to Die', type: 0}});
    } else {
        bot.setPresence({idle_since: 10, game: {name: '', type: 0}});
    }
}



/** Command Input **/
bot.on('message', function (user, userId, channelId, message, evt) {
    if (userId in usermap.users && channelId === auth.channel && message.substring(0, 1) === '$') {
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
                        sendMessage('Shutting down server...', 'info', true);
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

                                socket.emit('startServerPing', 0);

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