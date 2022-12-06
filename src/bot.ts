export const startup = new Date();

import * as Discord from 'discord.js';
import * as config from '../config.json';
import { loadCommands, updateDatabase, DiscordInviteLinkRegex, urlRegex, checkForScamLinks } from './helpers';

import type { Command, MessageData, ScamWSData, serverDBData } from './types';
import { EmbedBuilder } from 'discord.js';

process.on("message", (msg: MessageData) => {
  if (!msg.type) return false;

  if (msg.type === "activity") {
    console.info(msg);
    bot.user?.setPresence(msg.data);
  }
});

export let scamDB: string[] = [];
export let serverDB: serverDBData = [];
let lastIdPerGuild: {
  messageID: string;
  userID: string;
  guildID: string;
}[] = [];
let commands: Command[] = [];

const bot = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.GuildBans,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.MessageContent
  ],
  partials: [
    Discord.Partials.GuildMember,
    Discord.Partials.Message,
    Discord.Partials.Channel,
    Discord.Partials.User
  ]
});

const reportHook = new Discord.WebhookClient({ url: config.discord.reportHook })

const scamSocket = new WebSocket(config.scams.scamSocket);

scamSocket.onopen = () => {
  console.log("Connected to scam socket.");
};

scamSocket.onmessage = (msg) => {
  const data = JSON.parse(msg.data) as ScamWSData;
  if (data.type === "add") {
    // Get all the entries in "data.domains" array and push to db
    scamDB.push(...data.domains);
  } else if (data.type === "delete") {
    // Get all the entries in "data.domains" array and remove from db
    scamDB = scamDB.filter(item => !data.domains.includes(item));
  }
};

bot.once('ready', async () => {
  console.log(`Logged in as ${bot.user?.tag}!`);

  commands = await loadCommands()
  await updateDatabase(scamDB, serverDB);
});

bot.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Check if command exists
  const command = commands.find(cmd => cmd.data.name === interaction.commandName);
  if (!command) return;
  command.executeInteraction(interaction);
});

bot.on('messageCreate', async message => {
  if (message.author.id == bot.user?.id) return;

  const prefix = "$";
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = args.shift()?.toLowerCase();


  const inviteMatches = message.content.match(DiscordInviteLinkRegex);
  if (inviteMatches !== null && inviteMatches.length > 0 && cmd !== 'check') {
    const inviteCode = inviteMatches.groups?.code;
    const serverID = await bot.fetchInvite(inviteCode ?? '').then((invite) => invite.guild?.id);

    serverDB.filter(server => server.serverID === serverID);
    if (serverDB.length > 0) {
      if (message.deletable) message.delete();

      const embed = new EmbedBuilder()
        .setAuthor({
          name: message.guild?.name ?? '',
          iconURL: message.guild?.iconURL() ?? ''
        })
        .setThumbnail(message.author.avatarURL())
        .setFooter({
          text: `${message.id}${message.member?.bannable &&
            !message.member.permissions.has('KickMembers')
            ? ' | Softbanned'
            : ' | Not Softbanned'
            }`
        })
        .setFields([{
          name: 'User',
          value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
        },
        {
          name: 'Message',
          value: message.content,
        },
        {
          name: 'Invite',
          value: inviteMatches[0],
        }])
        .setTimestamp(new Date());

      await reportHook.send({ embeds: [embed] });

      if (
        message.member?.bannable &&
        !message.member.permissions.has('KickMembers')
      ) {
        await message.author.send(
          config.discord.banMsg.replace('{guild}', message.guild?.name ?? '')
        );
        await message.member.ban({
          reason: 'Scam detected',
          deleteMessageDays: 1
        });
        await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
        return;
      }
    }
  }

  const scamURLMatches = message.content.match(urlRegex);
  if (scamURLMatches !== null && scamURLMatches.length > 0 && cmd !== 'check') {
    const foundScamLinks = checkForScamLinks(message.content);
    if (foundScamLinks.length > 0) {
      if (message.deletable) message.delete();

      if (
        lastIdPerGuild.find(
          (data) =>
            data.userID === message.member?.id && data.guildID === message.guild?.id
        )
      ) {
        // Remove the element from the array
        lastIdPerGuild = lastIdPerGuild.filter((data) => data.messageID !== message.id);
        return;
      } else {
        // If the message is not in the array, add it
        lastIdPerGuild.push({
          messageID: message.id,
          userID: message.author.id,
          guildID: message.guild?.id ?? '',
        });
      }

      const embed = new Discord.EmbedBuilder()
        .setTimestamp(new Date())
        .setAuthor({
          name: message.guild?.name ?? '',
          iconURL: message.guild?.iconURL() ?? ''
        })
        .setThumbnail(message.author.avatarURL())
        .setFooter({
          text: `${message.id}${message.member?.bannable &&
            !message.member.permissions.has('KickMembers')
            ? ' | Softbanned'
            : ' | Not Softbanned'
            }`
        })
        .setFields([{
          name: 'User',
          value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
        },
        {
          name: 'Message',
          value: message.content,
        },
        {
          name: 'URL',
          value: foundScamLinks.join(', '),
        }]);


      await reportHook.send({
        embeds: [embed]
      });

      if (
        message.member?.bannable &&
        !message.member.permissions.has('KickMembers')
      ) {
        await message.author.send(
          config.discord.banMsg.replace('{guild}', message.guild?.name ?? '')
        );
        await message.member.ban({
          reason: 'Scam detected',
          deleteMessageDays: 1
        });
        await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
        return;
      }
    }
  }

  // Check if command exists
  const command = commands.find(command => command.data.name === cmd);
  if (!command) return;
  command.executeMessage(message, args);
});

bot.login(config.discord.token);