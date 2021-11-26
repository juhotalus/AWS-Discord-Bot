var awsCli = require('aws-cli-js');
var Options = awsCli.Options;
var Aws = awsCli.Aws;

const { ACCESSKEY } = require('../config.json');
const { SECRETKEY } = require('../config.json');
const { SESSIONTOKEN } = require('../config.json');
const { INSTANCES } = require('../config.json');
const { MESSAGELOGGING } = require('../config.json');
var verboseLog = (MESSAGELOGGING === 'T');
const StartCommand = 'ec2 start-instances --instance-ids ';
const StopCommand = 'ec2 stop-instances --instance-ids ';
const StatusCommand = 'ec2 describe-instances';

let options = new Options(
  /* accessKey    */ ACCESSKEY,
  /* secretKey    */ SECRETKEY,
  /* sessionToken */ SESSIONTOKEN,
  /* currentWorkingDirectory */ null
);

const aws = new Aws(options);

const eris = require('eris');
const { BOT_TOKEN } = require('../config.json');
const { ROLEID } = require('../config.json');
const { CHANNELID } = require('../config.json');

const PREFIX = '!aws';
const HelpDocs =
  '\n Help Docs: \n `start`: Starts the server \n `stop`: Stops the server \n `status`: Returns the server status  ';


// Create a Client instance with our bot token.
const bot = new eris.Client(BOT_TOKEN);

// When the bot is connected and ready, log to console.
bot.on('ready', () => {
  console.log('Connected and ready.');
});

const commandHandlerForCommandName = {};
commandHandlerForCommandName['start'] = (msg, args) => {
  startStop(true, msg, args);
};

commandHandlerForCommandName['stop'] = (msg, args) => {
  startStop(false, msg, args);
};

commandHandlerForCommandName['help'] = (msg, args) => {
  return msg.channel.createMessage(HelpDocs);
};

function startStop(isStart, msg, args) {
  var cmd = isStart ? StartCommand : StopCommand;
  cmd = cmd + INSTANCES[args.commandArg];
  var word = isStart ? 'Starting' : 'Stopping';
  console.warn(`${word} the server`);
  try {
    aws.command(cmd)
      .then(function (data) {
        console.warn('data = ', data);
        return msg.channel.createMessage(`<@${msg.author.id}> ${word} the ${args.commandArg} server`);
      })
      .catch(function (e) {
        if (verboseLog) {
          msg.channel.createMessage(`<@${msg.author.id}> Error ${word} the ${args.commandArg} server,  ${e}`);
        } else {
          msg.channel.createMessage(`<@${msg.author.id}> Error ${word} the ${args.commandArg} server`);
        }
      });

  } catch (err) {
    msg.channel.createMessage(`<@${msg.author.id}> Error ${word} the ${args.commandArg} server`);
    return msg.channel.createMessage(err);
  }
}

commandHandlerForCommandName['status'] = (msg, args) => {
  console.warn("Getting server status");
  try {
    aws.command(StatusCommand + (args.commandArg ? ` --instance-id ${INSTANCES[args.commandArg]}` : ''))
      .then(function (data) {
        data.object.Reservations.forEach(reservation => {
          return msg.channel.createMessage(`*Status: \n **Name**: ${reservation.Instances[0].Tags[0].Value} \n **State**: ${reservation.Instances[0].State.Name} \n **IP Address**: ${reservation.Instances[0].PublicIpAddress} \n **Last Startup**: ${reservation.Instances[0].LaunchTime}*`);
        });
      })
      .catch(function (e) {
        if (verboseLog) {
          msg.channel.createMessage(`<@${msg.author.id}> Error getting status,  ${e}`);
        } else {
          msg.channel.createMessage(`<@${msg.author.id}> Error getting status`);
        }
        console.warn(e);
      });

  } catch (err) {
    console.warn(err);
    msg.channel.createMessage(`<@${msg.author.id}> Error getting status`);
    return msg.channel.createMessage(err);
  }
};

// Every time a message is sent anywhere the bot is present,
// this event will fire and we will check if the bot was mentioned.
// If it was, the bot will attempt to respond with "Present".
bot.on('messageCreate', async (msg) => {
  const content = msg.content;
  const botWasMentioned = msg.mentions.find(
    mentionedUser => mentionedUser.id === bot.user.id,
  );

  //make sure it's in the right channel
  if (!(msg.channel.id === CHANNELID)) {
    return;
  }

  //if the message is sent by a bot, ignore it
  if (msg.author.bot) {
    return;
  }

  if (!msg.member.roles.includes(ROLEID)) {
    await msg.channel.createMessage(`<@${msg.author.id}> You do not have the required roles`);
    return;
  }

  if (botWasMentioned) {
    await msg.channel.createMessage('Brewing the coffee and ready to go!');
  }

  //ignore dms, guild messages only
  if (!msg.channel.guild) {
    console.warn('Received a dm, ignoring');
    return;
  }

  // Ignore any message that doesn't start with the correct prefix.
  if (!content.startsWith(PREFIX)) {
    return;
  }
  // Extract the parts of the command and the command name
  const command = content.split(PREFIX)[1].trim().split(' ');
  const commandName = command[0] ? command[0].trim() : undefined;
  const commandArg = command[1] ? command[1].trim() : undefined;

  // Get the appropriate handler for the command, if there is one.
  const commandHandler = commandHandlerForCommandName[commandName];
  if (!commandHandler) {
    await msg.channel.createMessage('Unkown command, try `$aws help` for a list of commands');
    return;
  }

  if (commandName !== 'status') {
    if (!commandArg) {
      await msg.channel.createMessage('Please specify the instance as an argument.');
      return;
    }

    if (!INSTANCES[commandArg]) {
      await msg.channel.createMessage('Unknown instance.');
      return;
    }
  }

  // Separate the command arguments from the command prefix and command name.

  try {
    // Execute the command.
    await commandHandler(msg, { commandName, commandArg });
  } catch (err) {
    console.warn('Error handling command');
    console.warn(err);
  }
});

bot.on('error', err => {
  console.warn(err);
});

bot.connect();
