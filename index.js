const fs = require("fs");
const { Client, REST, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv/config");
const musicBot = require("./commands/play");

const { TOKEN } = process.env;
const prefix = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

var queue = [];

client.on("ready", () => {
  console.log("The bot is ready");
});

client.on("messageCreate", (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(" ");
  const command = args.shift();

  if (command === "otaku") {
    message.reply(
      "I'm here and ready for service\nPlease don't tell Jony --- He will get mad at me if he's not around knowing I'm doing stuff :("
    );
  } else if (command === "husband") {
    message.reply("Jony is my first and only beloving husband :3");
  } else if (command === "join") {
    musicBot.join(message);
  } else if (command === "help") {
    message.reply(
      "---> !join : Join a voice chat\n---> !say [text] : Talk out loud\n---> !play [name or URL] : Play a song\n---> !skip : Skip a song\n---> !(stop/pause) : Pause the audio\n---> !(resume/unpause) : Unpause the audio\n---> !(leave/destroy/disconnect) : Destroy an audio player\n---> !(otaku/husband) : ???\n\n### Hey SUPER IMPORTANT: If a song is in progress, I can't either call out the name that joins the voice chat or do the command !say from you guys! Keep that on your head"
    );
  } else if (command === "play") {
    musicBot.play(message, args, { type: 0 }).catch("error in index play");
  } else if (command === "skip") {
    musicBot.skip(message).catch("error in index skip");
  } else if (
    command === "disconnect" ||
    command === "destroy" ||
    command === "leave"
  ) {
    musicBot.detele(message);
  } else if (command === "say") {
    musicBot.play(message, args, { type: 1 }).catch("error in index say");
  } else if (command === "pause" || command === "stop") {
    musicBot.pause(message);
  } else if (command === "resume" || command === "unpause") {
    musicBot.resume(message);
  } else {
    message.reply(
      "Shhh!!! Type !help for all my secret services --- Obviously confidential"
    );
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  // console.log(oldState.member.user.username, newState.member.user.username);
  // if (oldState.member.user.bot) return;

  if (newState.channelId === null) {
    if (oldState.member.user.bot) return;

    musicBot
      .play({}, [`${oldState.member.user.username} leaving the server`], {
        type: 2,
      })
      .catch("error in index voiceStateUpdate leaving");
  } else if (oldState.channelId === null) {
    musicBot
      .play({}, [`${oldState.member.user.username} joining the server`], {
        type: 2,
      })
      .catch("error in index voiceStateUpdate joining");
  } else {
    console.log("user moved channels", oldState.channelId, newState.channelId);
  }
});

client.login(TOKEN);
