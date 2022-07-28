import { SlashCommandBuilder, Message, CommandInteraction, CacheType, EmbedBuilder } from 'discord.js'
import { db, lastUpdate, startup } from '../bot'
import os from 'node:os'
import config from '../config.json'
import type { Command } from '../types'

const revision = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString()
  .trim()
  .slice(0, 6)

export default class BotInfoCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Shows information about the bot.')

  chatInputRun = async (interaction: CommandInteraction<CacheType>) => {
    const guildsSize = await interaction.client.shard?.fetchClientValues('guilds.cache.size') as number[]
    const guilds = guildsSize.reduce((a, b) => a + b, 0)

    const hostname = config.owners.includes(interaction.user.id) === true ? os.hostname() : os.hostname().replace(/./g, '•')
    const systemInformationButReadable = `
                    Hostname: ${hostname}
                    CPU: ${os.cpus()[0].model}
                    Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
                    Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
                    Uptime: <t:${Math.floor(
                new Date().getTime() / 1000 - os.uptime()
            )}:R>
                    `

    const botInfoButReadable = `
                    Bot Name: "${interaction.client.user?.tag}"
                    Guild Count: ${guilds}
                    Shard Count: ${interaction.client.shard?.count}
                    Shard Latency: ${Math.round(interaction.client.ws.ping)}ms
                    Startup Time: <t:${Math.floor(
                startup.getTime() / 1000
            )}:D> <t:${Math.floor(
                startup.getTime() / 1000
            )}:T>
                    Current DB size: ${db.length.toString()}
                    Last Database Update: <t:${Math.floor(
                lastUpdate?.getTime() ?? 0 / 1000
            )}:R>
                    `

    const embed = new EmbedBuilder()
      .setTitle('Bot Information')
      .setFields({
        name: 'System Information',
        value: systemInformationButReadable
      },
      {
        name: 'Bot Info',
        value: botInfoButReadable
      })
      .setFooter({
        text: `Commit ${revision}`
      })
    interaction
      .reply({
        embeds: [embed]
      })
      .catch((err) => {
        console.error(err)
      })
  }

  messageRun = async (message: Message<boolean>) => {
    const guildsSize = await message.client.shard?.fetchClientValues('guilds.cache.size') as number[]
    const guilds = guildsSize.reduce((a, b) => a + b, 0)

    const hostname = config.owners.includes(message.author.id) === true ? os.hostname() : os.hostname().replace(/./g, '•')
    const systemInformationButReadable = `
                    Hostname: ${hostname}
                    CPU: ${os.cpus()[0].model}
                    Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
                    Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
                    Uptime: <t:${Math.floor(
                        new Date().getTime() / 1000 - os.uptime()
                    )}:R>
                    `

    const botInfoButReadable = `
                    Bot Name: "${message.client.user?.tag}"
                    Guild Count: ${guilds}
                    Shard Count: ${message.client.shard?.count}
                    Shard Latency: ${Math.round(message.client.ws.ping)}ms
                    Startup Time: <t:${Math.floor(
                        startup.getTime() / 1000
                    )}:D> <t:${Math.floor(
                        startup.getTime() / 1000
                    )}:T>
                    Current DB size: ${db.length.toString()}
                    Last Database Update: <t:${Math.floor(
                        lastUpdate?.getTime() ?? 0 / 1000
                    )}:R>
                    `

    const embed = new EmbedBuilder()
      .setTitle('Bot Information')
      .setFields({
        name: 'System Information',
        value: systemInformationButReadable
      },
      {
        name: 'Bot Info',
        value: botInfoButReadable
      })
      .setFooter({
        text: `Commit ${revision}`
      })
    message.channel
      .send({
        embeds: [embed]
      })
      .catch((err) => {
        console.error(err)
      })
  }
}
