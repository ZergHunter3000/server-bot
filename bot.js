let Discord       = require('discord.io');
let logger        = require('winston');
let auth          = require('./auth.json');
let io            = require('net');
let child_process = require('child_process');

let socket;


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
        exports.socket = socket;
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
        if (data.toString().indexOf('in the game') !== -1) {
            console.log('test');
            sendMessage(data.toString().match(new RegExp('Total of ' + '(.*)' + ' in the game'))[1], "");
        }
        logger.info (data.toString());
    });

    // Write commands
    socket.on('getPlayers', function () {
        socket.write('listplayers\n');
    });
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
        console.log(args);
        sendMessage(channelId);

        switch (cmd) {
            case 'help':
                sendMessage('List of commands (proceeded by \'$\'):\nstart\nstatus');
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