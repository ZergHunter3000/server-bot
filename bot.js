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
            setGameStatus(false);
            if (err.toString().indexOf('ECONNREFUSED') !== -1) {
                logger.error('Error: ECONNREFUSED');

            } else {
                logger.error('test', err.stack);
            }
        });
};

function _initializeSocketListeners() {
    // Login
    socket.on('data', function (data) {
        /******************
         * Data Listeners *
         ******************/
        // Enter credentials
        if (data.toString().indexOf('lease enter password:') !== -1) {
            console.log('Entering credentials...');
            socket.write(auth.telnetPass + '\r\n');
        }

        // Alert wandering horde
        if (data.toString().indexOf('Spawning wandering horde') !== -1) {
            sendMessage('Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1] + '.');
        }

        // Display # of players online
        if (data.toString().indexOf('in the game') !== -1) {
            sendMessage(data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' players online.');
            playerList = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
        }
    });

    /******************
     * Write commands *
     ******************/
    // Get player count
    socket.on('getPlayers', function () {
        socket.write('listplayers\n');
    });

    // Shutdown server
    socket.on('shutdown', function () {
        socket.write('shutdown\n');
    });
}

function getPositions() {
    let players = playerList;
    let newPlayers = [];

    console.log('TESTERRRR');
    for (let i = 0; i < players.length; i += 2) {
        let next = {};
        let pos = players[i].match(new RegExp('pos=' + '(.*)' + ', rot'))[1];
        let name = players[i].match(new RegExp(', ' + '(.*)' + ', pos'))[1];
        pos = pos.replace(')', '');
        pos = pos.replace('(', '');
        pos = pos.replace(',', '');
        pos = pos.replace(',', '');
        next.x = pos.substring(1).split(' ')[0];
        next.z = pos.substring(1).split(' ')[2];
        next.name = name;
        newPlayers.push(next);
        console.log(next.x, next.z, next.name);
    }
}


function sendMessage (message) {
    bot.sendMessage({
        to: auth.channel,
        message: message
    });
}

function setGameStatus (online) {
    if (online) {
        bot.setPresence(
            {
                status: 'online',
                game: { name: '7 Days to Die' }
            });
    } else {
        bot.setPresence(
            {
                status: 'online',
                game: { name: '' }
            });
    }
}



/* Command Input */
bot.on('message', function (user, userId, channelId, message, evt) {
    if (channelId === auth.channel && message.substring(0, 1) === '$') {
        let args = message.substring(1).split(' ');
        let cmd = args[0];

        args = args.splice(1);

        if (!socket.readable) {
            initializeSocket();
        }

        switch (cmd) {
            /* Request list of commands */
            case 'help':
                sendMessage('List of commands (proceeded by \'$\'):\nstart\nstop\nstatus\nplayers');
                break;

            /* Request server shutdown */
            case 'stop':
                sendMessage('Shutting down server...');
                socket.emit('shutdown');
                setGameStatus(true);
                break;

            /* Request # of online players */
            case 'players':
                socket.emit('getPlayers');
                break;

            /* Request server start if not already started */
            case 'start':
                if (socket.readable) {
                    setGameStatus(true);
                    sendMessage('Server is already running.');
                } else {
                    sendMessage('Verifying server is offline...');

                    initializeSocket();

                    setTimeout(function () {
                        if (socket.readable) {
                            setGameStatus(true);
                            sendMessage('Server is already running.');
                        } else {
                            setGameStatus(false);
                            sendMessage('Starting server... (Please wait 20 seconds before giving any commands)');

                            child_process.exec('D:\\runserver.bat', function (error, stdout, stderr) {
                                console.log(error, stdout, stderr);
                            });

                            setTimeout(function () {
                                initializeSocket();

                                setTimeout(function () {
                                    if (socket.readable) {
                                        setGameStatus(true);
                                        sendMessage('Successfully started server.');
                                    } else {
                                        setGameStatus(false);
                                        sendMessage('Failed to start server (type $status to verify).');
                                    }
                                }, 10000);
                            }, 10000);
                        }
                    }, 6000);
                }
                break;

            /* Request status of the server */
            case 'status':
                if (socket.readable) {
                    setGameStatus(true);
                    sendMessage('Server is running.');
                } else {
                    sendMessage('Socket connection closed... reestablishing connection to server.');

                    initializeSocket();

                    setTimeout(function () {
                        if (socket.readable) {
                            setGameStatus(true);
                            sendMessage('Server is running.');
                        } else {
                            setGameStatus(false);
                            sendMessage('Server is offline.');
                        }
                    }, 2000);
                }
                break;
        }
    }
});