import { ChatInputCommandInteraction, CacheType, Message, SlashCommandBuilder, Client, EmbedBuilder } from "discord.js";
import * as config from '../../config.json';
import os from 'node:os';

import type { Command } from "../types";
import { scamDB, serverDB, startup } from "../bot";
import { revision } from '../helpers';


const botInfoTemplate = (client: Client, guildCacheSize: number[]) => `
Bot Name: '${client.user?.tag}'
Guild Count: ${guildCacheSize.reduce((a, b) => a + b, 0)}
Shard Count: ${client.shard?.count}
Shard Latency: ${Math.round(client.ws.ping)}ms
Startup Time: <t:${Math.floor(
  startup.getTime() / 1000
)}:D> <t:${Math.floor(
  startup.getTime() / 1000
)}:T>
Current Link DB size: ${scamDB.length}
Current Server DB size ${serverDB.length}
)}:R>
`;

const systemInformationTemplate = (hostname: string) => `
			Hostname: ${hostname}
			CPU: ${os.cpus()[0].model}
			Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
			Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
			Uptime: <t:${Math.floor(
  Date.now() / 1000 - os.uptime()
)}:R>
			`;

const embed = (client: Client, guildCacheSize: number[], hostname: string) => new EmbedBuilder()
  .setTitle('Bot Information')
  .setTimestamp(new Date())
  .setFields([{
    'name': 'System Information',
    'value': systemInformationTemplate(hostname)
  },
  {
    'name': 'Bot Info',
    'value': botInfoTemplate(client, guildCacheSize)
  }
  ])
  .setFooter({
    text: `Commit: ${revision}`
  });

export default {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("Get information about the client."),
  executeInteraction: async function (interaction: ChatInputCommandInteraction<CacheType>) {
    const client = interaction.client;
    const guildCacheSize = await client.shard?.fetchClientValues("guilds.cache.size") as number[] | undefined
    if (guildCacheSize === undefined) throw new Error('Failed to fetch guild cache sizes');
    const hostname = config.owners.includes(interaction.user.id) === true ? os.hostname() : os.hostname().replace(/./g, '•');

    interaction.reply({
      embeds: [embed(client, guildCacheSize, hostname)]
    });
  },
  executeMessage: async function (message: Message<boolean>) {
    const client = message.client;
    const guildCacheSize = await client.shard?.fetchClientValues("guilds.cache.size") as number[] | undefined
    if (guildCacheSize === undefined) throw new Error('Failed to fetch guild cache sizes');
    const hostname = config.owners.includes(message.author.id) === true ? os.hostname() : os.hostname().replace(/./g, '•');

    message.reply({
      embeds: [embed(client, guildCacheSize, hostname)]
    });
  }
} as Command;