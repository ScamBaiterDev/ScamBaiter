export const startup = new Date();

import Discord from 'discord.js';
import config from '../config.json';
import { loadCommands, updateDatabase } from './helpers';
import { checkAttachments, checkMessageContent } from './helpers/checkers';
import WebSocket from 'ws';
import type { Command, ScamWSData, serverDBData } from './types';

export let scamDB: string[] = [];
export let serverDB: serverDBData = [];
export let lastIdPerGuild: {
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

const scamSocket = new WebSocket(config.scams.scamSocket, {
  headers: {
    "User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
    "X-Identity": "ScamBaiter/1.0; Chris Chrome#9158",
  }
});

scamSocket.onopen = () => {
  console.log("Connected to scam socket.");
};

scamSocket.onmessage = (msg) => {
  const data = JSON.parse(msg.data as string) as ScamWSData;
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

  bot.user?.setPresence({
    status: config.discord.status.status as Discord.PresenceStatusData,
    activities: config.discord.status.activities as unknown as Discord.ActivitiesOptions[]
  });
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

  try {
    if (cmd !== 'check') {
      const contentCheckResult = await checkMessageContent(message);
      const attachmentCheckResult = await checkAttachments(message);
      if (contentCheckResult || attachmentCheckResult) return;
    }
  } catch (err) {
    console.error("Error while checking message content: ", err);
  }

  // Check if command exists
  const command = commands.find(command => command.data.name === cmd);
  if (!command) return;
  command.executeMessage(message, args);
});

bot.login(config.discord.token);