export const startup = new Date();

import * as Discord from 'discord.js';
import * as config from '../config.json';
import { loadCommands, updateDatabase, DiscordInviteLinkRegex, urlRegex, checkForScamLinks } from './helpers';
import Jimp from 'jimp';
import { EmbedBuilder } from 'discord.js';

import type { Command, MessageData, ScamWSData, serverDBData } from './types';
import jsQR from 'jsqr';
import { checkAttachments, checkMessageContent } from './helpers/checkers';

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

  if (cmd !== 'check') {
    const contentCheckResult = await checkMessageContent(message);
    const attachmentCheckResult = await checkAttachments(message);
    if (contentCheckResult || attachmentCheckResult) return;
  }

  // Check if command exists
  const command = commands.find(command => command.data.name === cmd);
  if (!command) return;
  command.executeMessage(message, args);
});

bot.login(config.discord.token);