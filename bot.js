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
            sendMessage('```diff\n-Warning:  Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1] + '.\n```');
        }

        // Alert scout-triggered horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('```diff\n-Warning:  A \'Scout-Triggered\' horde has just finishing spawning mobs.\n```');
        }

        // Alert scout horde spawned
        if (data.toString().indexOf('Scout-Triggered Horde Finished') !== -1) {
            sendMessage('```diff\n-Warning:  A \'Scout\' horde has just finishing spawning mobs.\n```');
        }

        // Display # of players online
        if (data.toString().indexOf('in the game') !== -1) {

            sendMessage('```css\nThere are ' + data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' players online.\n```');
            playerList = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
            // setTimeout(function () {
            //     getPositions();
            // }, 2500);
        }
    });


    //Spawned supply crate @ ((-255.5, 206.2, 1813.0))


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
        next.y = pos.substring(1).split(' ')[2];
        next.name = name;
        newPlayers.push(next);
        console.log(next.x, next.y, next.name);
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
                sendMessage('```css\nList of commands (proceeded by \'$\'):\nstart\nstop\nstatus\nplayers\n```');
                break;

            /* Request server shutdown */
            case 'stop':
                sendMessage('```css\nShutting down server...\n```');
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
                    sendMessage('```css\nServer is already running.\n```');
                } else {
                    sendMessage('```css\nVerifying server is offline...\n```');

                    initializeSocket();

                    setTimeout(function () {
                        if (socket.readable) {
                            setGameStatus(true);
                            sendMessage('```css\nServer is already running.\n```');
                        } else {
                            setGameStatus(false);
                            sendMessage('```css\nStarting server... (Please wait 20 seconds before giving any commands)\n```');

                            child_process.exec('D:\\runserver.bat', function (error, stdout, stderr) {
                                console.log(error, stdout, stderr);
                            });

                            setTimeout(function () {
                                initializeSocket();

                                setTimeout(function () {
                                    if (socket.readable) {
                                        setGameStatus(true);
                                        sendMessage('```css\nSuccessfully started server.\n```');
                                    } else {
                                        setGameStatus(false);
                                        sendMessage('```css\nFailed to start server (type $status to verify).\n```');
                                    }
                                }, 8000);
                            }, 12000);
                        }
                    }, 6000);
                }
                break;

            /* Request status of the server */
            case 'status':
                if (socket.readable) {
                    setGameStatus(true);
                    sendMessage('```css\nServer is running.\n```');
                } else {
                    sendMessage('```css\nSocket connection closed... reestablishing connection to server.\n```');

                    initializeSocket();

                    setTimeout(function () {
                        if (socket.readable) {
                            setGameStatus(true);
                            sendMessage('```css\nServer is running.\n```');
                        } else {
                            setGameStatus(false);
                            sendMessage('```css\nServer is offline.\n```');
                        }
                    }, 2000);
                }
                break;
        }
    }
});