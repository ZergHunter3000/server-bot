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
});



initializeSocket = function () {
    socket = io.connect(auth.port, auth.host, function () {
        _initializeSocketListeners();
    })
        .on("error", function (err) {
            if (err.toString().indexOf('ECONNREFUSED') !== -1) {
                logger.error('Error: ECONNREFUSED');

            } else {
                logger.error('test', err.stack);
            }
        });

    setTimeout (function () {
        return socket.readable;
    }, 4500);
};

function _initializeSocketListeners() {
    // Login
    socket.on('data', function (data) {
        if (data.toString().indexOf('lease enter password:') !== -1) {
            console.log('Entering credentials...');
            socket.write(auth.telnetPass + '\r\n');
        }

        logger.info('~~~~~~Data Object~~~~~~');
        //
        if (data.toString().indexOf('Spawning wandering horde') !== -1) {
            sendMessage('Wandering horde spawned and moving towards: ' + data.toString().match(new RegExp('name=(.*), id'))[1] + '.');
        }
        if (data.toString().indexOf('in the game') !== -1) {

            sendMessage(data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1] + ' players online.');
            playerList = data.toString().match(new RegExp('id\\s?(.*?)\\s?ping'));
        }
        logger.info (data.toString());
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
    for (let i = 0; i < players.length; i+=2) {
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

initializeSocket();



/* Command Input */
bot.on('message', function (user, userId, channelId, message, evt) {
    if (channelId === auth.channel && message.substring(0, 1) === '$') {
        let args = message.substring(1).split(' ');
        let cmd = args[0];

        args = args.splice(1);
        //console.log(args);

        if (!socket.readable) {
            initializeSocket();
        }

        switch (cmd) {
            case 'help':
                sendMessage('List of commands (proceeded by \'$\'):\nstart\nstop\nstatus');
                break;

            case 'stop':
                socket.emit('shutdown');
                break;

            case 'players':
                socket.emit('getPlayers');
                break;

            /* Start the server if not already started */
            case 'start':
                if (socket.readable) {
                    sendMessage('Server is already running.');
                } else {
                    sendMessage('Verifying server is offline...');

                    initializeSocket();

                    setTimeout (function () {
                        if (socket.readable) {
                            sendMessage('Server is already running.');
                        } else {
                            sendMessage('Starting server... (Please wait 20 seconds before giving any commands)');

                            child_process.exec('D:\\runserver.bat', function(error, stdout, stderr) {
                                console.log(error, stdout, stderr);
                            });

                            setTimeout(function () {
                                initializeSocket();

                                setTimeout(function () {
                                    if (socket.readable) {
                                        sendMessage('Successfully started server.');
                                    } else {
                                        sendMessage('Failed to start server.');
                                    }
                                }, 10000);
                            }, 10000);
                        }
                    }, 6000);
                }

                break;

            /* Return status of the server */
            case 'status':
                if (socket.readable) {
                    sendMessage('Server is running.');
                } else {
                    sendMessage('Socket connection closed... reestablishing connection to server.');

                    initializeSocket();

                    setTimeout(function () {
                        if (socket.readable) {
                            sendMessage('Server is running.');
                        } else {
                            sendMessage('Server is offline.');
                        }
                    }, 2000);
                }

                break;
        }
    }
});