const ytSearch = require("youtube-search-without-api-key");

const {
  joinVoiceChannel,
  createAudioPlayer,
  NoSubscriberBehavior,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");

const discordTTS = require("discord-tts");
const play = require("play-dl");

let queue = [];
let songPlaying = { url: null, title: null };

let isLoop = false;
let isWaiting = false;
let isPlaying = false;
let isTalking = false;
let isJoin = false;
let isPause = false;

let connection;
let player;

const videoFinder = async (query) => {
  query = query.split("&")[0];
  const videoResult = await ytSearch.search(query);
  return videoResult.length ? videoResult[0] : null;
};

const startPlaying = async (message, player) => {
  if (isLoop) {
    const stream = await play.stream(songPlaying.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.play(resource);
    isPlaying = true;
    return;
  }

  if (!queue.length) {
    console.log("here123");
    player.stop();
    return;
  }

  const { url, title, text } = queue.shift();
  if (text === undefined) {
    const stream = await play.stream(url, { quality: 2 });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });
    player.play(resource);

    if (title) message.channel.send(`Now Playing --- ${title}`);
    songPlaying = { url, title };
    isPlaying = true;
  } else {
    const audioFile = discordTTS.getVoiceStream(text);
    const resource = createAudioResource(audioFile, {
      inputType: StreamType.Arbitrary,
    });

    player.play(resource);
    isTalking = true;
  }
};

let waitingPromise = () => {
  return new Promise((resolve, reject) => {
    isWaiting = true;
    let waitingTime = 21600;

    let myInterval = setInterval(() => {
      console.log(`counting... ${waitingTime}`);

      if (!waitingTime) {
        console.log("rejecting...");
        songPlaying = { url: null, title: null };
        isPlaying = false;
        isTalking = false;
        isLoop = false;
        isWaiting = false;
        isPause = false;
        clearInterval(myInterval);
        reject("timeout");
      }

      if (!isJoin) {
        clearInterval(myInterval);
        isWaiting = false;
        reject("force");
      }

      if (isLoop || queue.length) {
        console.log("resolving...");
        isWaiting = false;
        if (!isLoop) songPlaying = { url: null, title: null };
        clearInterval(myInterval);
        resolve();
      }

      waitingTime -= 1;
    }, 1000);
  });
};

module.exports = {
  name: "musicBot",
  description: "Joins and plays a video from youtube",
  async join(message) {
    console.log(queue, isWaiting, isTalking, isJoin, isPause);

    if (isJoin) {
      return message.reply("I'm already in a party. Woo hoo!!!");
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT"))
      return message.channel.send("You dont have the correct permissions");
    if (!permissions.has("SPEAK"))
      return message.channel.send("You dont have the correct permissions");

    player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    player.addListener("stateChange", (oldOne, newOne) => {
      if (newOne.status === "idle") {
        isPlaying = false;
        isTalking = false;
        waitingPromise()
          .then(
            (res) => {
              startPlaying(message, player);
            },
            (rej) => {
              console.log("here2");
              if (rej === "timeout")
                message.channel.send(
                  "It feels empty in here --- Otaku hops out"
                );

              connection.disconnect();
              songPlaying = { url: null, title: null };
              isLoop = false;
              isPlaying = false;
              isTalking = false;
              isPause = false;
              isJoin = false;
            }
          )
          .catch((e) => {
            console.log("error in player addListener");
          });
      }
    });

    player.on("error", (error) => {
      console.log(error);
      songPlaying = { url: null, title: null };
      isLoop = false;
      isPlaying = false;
      isTalking = false;
      console.error(`Error: ${error.message} with resource`);
      startPlaying(message, player).catch("error inside player error");
    });

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    connection.subscribe(player);

    isJoin = true;
  },

  async play(message, args, cond) {
    if (cond.type !== 2) {
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.channel.send(
          "You need to be in a voice channel to execute this command!"
        );
    }

    if (cond.type === 1 && isPlaying) {
      return message.reply(
        "Hey!! I'm not a god or superman or anything. I'm literally doing songs right now\nCall me when I'm done, we'll have some spicy stuff to work on until then hehe"
      );
    }
    if (cond.type === 2 && (isPlaying || !isJoin)) return;

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!args.length)
      return message.reply(
        "Ummm... I really need a link or at least just give me the name of a song so I can look up to it!"
      );

    if (cond.type === 0) {
      await videoFinder(args.join(" "))
        .then((video) => {
          if (video) {
            console.log("Pushing music...");
            if (!(!isPlaying && !queue.length))
              message.reply(
                `Song added --- ${video.title} --- Number in queue: ${
                  queue.length + 1
                }`
              );
            queue.push({
              url: video.url,
              title: video.title,
            });
          } else {
            message.reply(
              "No video found\nIf you pass a link, make sure it does not come from youtube playlist\nIf you pass a name, dang it give me a better name of the sone"
            );
          }
        })
        .catch((e) => {
          console.log("error in videoFinder");
        });
    } else if (cond.type === 1 || cond.type === 2) {
      queue.push({
        text: args.join(" "),
        type: cond.type,
      });
    }

    if (!isPlaying && queue.length && !isWaiting) {
      startPlaying(message, player).catch("error in start playing");
    }
  },

  async skip(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!isPlaying && !queue.length) {
      message.reply(
        "Whoops!! I didn't miss anything, did I? --- There is nothing left that this otaku can skip here"
      );
    }

    console.log("skipping....");
    player.stop();
    startPlaying(message, player).catch("error in skip");
  },

  async pause(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!isPlaying) {
      return message.reply(
        "Huh... Wait what!?! Hold on... What do you want me to pause"
      );
    }

    if (isPause) {
      return message.reply(
        "Hmmmm... You really want me to pause a paused song? I don't think so"
      );
    }

    isPause = true;
    player.pause();
  },

  async resume(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!isPlaying) {
      return message.reply(
        "Resuming...\nAnd do you hear something?\nYup, that's right --- the silence..."
      );
    }

    if (!isPause) {
      return message.reply(
        "Resuming a playing song\nHmmmmm... how brilliant you are haha"
      );
    }

    isPause = false;
    player.unpause();
  },

  loop(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!isPlaying) {
      return message.reply(
        "Looping unknown name song... for unknown reason... T_T"
      );
    }

    if (isLoop) {
      return message.reply(
        "You know loop inside a loop creating a new dimension of mystery, and I can't handle it sadge..."
      );
    }

    message.reply(`Looping ${songPlaying.title}`);
    isLoop = true;
  },

  unloop(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    if (!isLoop) {
      return message.reply(
        "Unloop unloop thing. Have you ever think it is already be like that?"
      );
    }

    message.reply("Unlooping... Now next song can be played!");
    isLoop = false;
  },

  detele(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to execute this command!"
      );

    if (!isJoin) {
      return message.reply(
        "Hey!! Don't count me out --- I think you should do the command !join so I can sneak in there hehe"
      );
    }

    console.log("destroying...");
    queue = [];
    songPlaying = { url: null, title: null };
    isJoin = false;
    isLoop = false;
    isWaiting = false;
    isPlaying = false;
    isTalking = false;
    isPause = false;
    connection.disconnect();
  },
};
