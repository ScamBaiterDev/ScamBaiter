import os from 'os'
import Discord, { ChatInputCommandInteraction, Partials } from 'discord.js'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import WebSocket from 'ws'
import config from './config.json'
import path from 'path'
import Jimp from 'jimp'
import jsQR from 'jsqr'
import type { ShardData } from './index'
import { updateDb, urlRegex } from './helpers'

export const DBPath = path.join(__dirname, '..', 'db.json')
export let db: string[] = []
let lastUpdate: Date | null = null
export const setLastUpdate = (date: Date) => {
  lastUpdate = date
}
export let lastIdPerGuild: {
    messageId: string,
    userId: string,
    guildId: string,
}[] = []
export const startup = new Date()

process.on('message', (msg: ShardData) => {
  if (!msg.type) return

  if (msg.type === 'activity') {
    console.info(msg)
    bot.user?.setPresence(msg.data)
  }
})
const revision = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString()
  .trim()
  .slice(0, 6)

const bot = new Discord.Client({
  intents: [
    'GuildMessages',
    'GuildBans',
    'GuildMembers',
    'GuildInvites',
    'Guilds',
    'MessageContent'
  ],
  partials: [Partials.Channel, Partials.User, Partials.GuildMember, Partials.Message]
})
const reportHook = new Discord.WebhookClient({ url: config.discord.reportHook })

setInterval(() => {
  updateDb()
}, 1000 * 30 * 60)

const sock = new WebSocket('wss://phish.sinking.yachts/feed', {
  headers: {
    'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
    'X-Identity': 'ScamBaiter/1.0; Chris Chrome#9158'
  }
})

sock.onopen = () => {
  console.log('Connected to WS')
}

sock.onmessage = (message) => {
  const data = JSON.parse(message.data as string)
  if (data.type === 'add') {
    // Get all the entries in "data.domains" array and push to db
    db.push(...data.domains)
  } else if (data.type === 'delete') {
    // Get all the entries in "data.domains" array and remove from db
    db = db.filter(item => !data.domains.includes(item))
  }
}

bot.once('ready', async () => {
  console.info(`Logged in as ${bot.user?.tag}`)
  await updateDb()

  const commands: Discord.RESTPostAPIApplicationCommandsJSONBody[] = []
  const everySlashiesData = [
    new Discord.SlashCommandBuilder()
      .setName('botinfo')
      .setDescription('Shows information about the bot.'),
    new Discord.SlashCommandBuilder()
      .setName('check')
      .setDescription('Checks a provided scam URL against the database.')
      .addStringOption((option) =>
        option.setName('scam_url').setDescription('The domain to check.').setRequired(true)
      ),
    new Discord.SlashCommandBuilder()
      .setName('invite')
      .setDescription('Gives the bot invite link.'),
    new Discord.SlashCommandBuilder()
      .setName('update_db')
      .setDescription('Updates database')
  ]
  everySlashiesData.forEach((slashies) => {
    commands.push(slashies.toJSON())
  })
  const rest = new REST().setToken(config.discord.token)
  rest.put(Routes.applicationCommands(config.discord.client_id), {
    body: commands
  })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error)
})

bot.on('interactionCreate', async (interaction): Promise<any> => {
  if (interaction.type !== Discord.InteractionType.ApplicationCommand) return

  switch (interaction.commandName) {
    // eslint-disable-next-line no-lone-blocks
    case 'botinfo': {
      const guildsSize = await bot.shard?.fetchClientValues('guilds.cache.size') as number[]
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
                    Bot Name: "${bot.user?.tag}"
                    Guild Count: ${guilds}
                    Shard Count: ${bot.shard?.count}
                    Shard Latency: ${Math.round(bot.ws.ping)}ms
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

      const embed = new Discord.EmbedBuilder()
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
      break
    };
    case 'update_db':
      if (!config.owners.includes(interaction.user.id)) return
      interaction.reply('Updating...').then(() => {
        updateDb()
          .then(() => interaction.editReply('Updated Database'))
          .catch(() => interaction.editReply('Failed to Update Database'))
      })
      break
    case 'invite':
      await interaction.reply(config.inviteMsg)
      break
    case 'check': {
      const scamUrl = (interaction as ChatInputCommandInteraction).options.getString('scam_url', true)
      const matchedREgexThing = urlRegex.exec(scamUrl)
      if (matchedREgexThing) {
        const removeEndingSlash = matchedREgexThing[0].split('/')[2]
        if (removeEndingSlash === undefined) return interaction.reply('Please provide a valid URL')
        const splited = removeEndingSlash.split('.')
        const domain =
                      splited[splited.length - 2] + '.' + splited[splited.length - 1]
        await interaction.reply('Checking...').then(() =>
          interaction
            .editReply(`${domain} is ${db.includes(domain) ? '' : 'not '}a scam.`)
            .catch(() => {
              interaction.editReply(
                'An error occurred while checking that domain name!\nTry again later'
              )
            })
        )
        return
      }
      await interaction.reply('Checking...').then(() =>
        interaction
          .editReply(`${scamUrl} is ${db.includes(scamUrl) ? '' : 'not '}a scam.`)
          .catch(() => {
            interaction.editReply(
              'An error occurred while checking that domain name!\nTry again later'
            )
          })
      )
      break
    }
  }
})

bot.on('messageCreate', async (message): Promise<any> => {
  if (message.author.id === bot.user?.id || message.guild === undefined) return

  const prefix = '$'
  const args = message.content.slice(prefix.length).trim().split(/ +/g)
  const cmd = args.shift()?.toLowerCase()
  // QR Stuff

  const scamUrls = urlRegex.exec(message.content)
  let isScam = false
  let scamDomain = ''
  if (scamUrls !== null && cmd !== 'check') {
    for (const potscamurl of scamUrls) {
      // Somtimes potscamurl would be undefined causing a crash
      if (potscamurl === undefined) break
      // remove everything after the third slash
      const removeEndingSlash = potscamurl.split('/')[2]
      if (removeEndingSlash === undefined) continue
      const splited = removeEndingSlash.split('.')
      const domain =
                splited[splited.length - 2] + '.' + splited[splited.length - 1]

      // check if domain is in db
      if (db.includes(domain) || db.includes(removeEndingSlash)) {
        isScam = true
        scamDomain = domain
        break
      }
    }
  }
  if (isScam) {
    if (message.deletable) await message.delete()

    // Check if any of the elements in lastIdPerGuild matches the message id and guild id
    if (
      lastIdPerGuild.find(
        (data) =>
          data.userId === message.member?.id && data.guildId === message.guild?.id
      )
    ) {
      // Remove the element from the array
      lastIdPerGuild = lastIdPerGuild.filter((data) => data.messageId !== message.id)
      return
    } else {
      // If the message is not in the array, add it
      lastIdPerGuild.push({
        messageId: message.id,
        userId: message.author?.id,
        guildId: message.guild?.id!
      })
    }

    const embed = new Discord.EmbedBuilder()
      .setTimestamp()
      .setAuthor({
        name: message.author?.tag,
        iconURL: message.author?.avatarURL() ?? ''
      })
      .setThumbnail(message.author?.avatarURL() ?? '')
      .setFooter({
        text: `${message.id}${message.member?.bannable &&
                    !message.member.permissions.has('KickMembers')
                    ? ' | Softbanned'
                    : ' | Not Softbanned'
                    }`
      })
      .setFields(
        {
          name: 'User',
          value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`
        },
        {
          name: 'Message',
          value: message.content
        },
        {
          name: 'URL',
          value: scamDomain
        })

    await reportHook.send({
      embeds: [embed]
    }) /* .then((reportMsg) => {
            if (config.discord.reportCrosspost) {
                reportMsg.crosspost();
                // bot.channels.cache.get(config.discord.reportChannel).crosspost()
            }
        });
        */

    if (
      message.member?.bannable &&
            !message.member?.permissions.has('KickMembers')
    ) {
      try {
        await message.author.send(
          config.discord.banMsg.replace('{guild}', message.guild!.name)
        )
        await message.member.ban({
          reason: 'Scam detected',
          deleteMessageDays: 1
        })
        await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban')
        return
      } catch (e) {
        console.error(e)
      }
    }
  }

  message.attachments.forEach((att) => {
    if (att.contentType?.startsWith('image')) {
      Jimp.read(att.url).then((image) => {
        // use jsQR to read the QR code
        const code = jsQR(image.bitmap.data as any, image.bitmap.width, image.bitmap.height)
        if (code !== null) {
          if (code.data.startsWith('https://discord.com/ra/') || code.data.startsWith('https://discordapp.com/ra/')) {
            try {
              message.reply({
                embeds: [{
                  description: ':warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account'
                }]
              })
            } catch (error) {
              if (error) message.delete()
            }
          }
        }
      })
    }
  })

  // This is broken af right now, if someone knows what I'm doing wrong feel free to open a PR!
  /* message.embeds.forEach(embed => {
          if (() => {
                  Jimp.read(embed.thumbnail.url).then(img => {
                      code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
                      if (code) {
                          if (code.data.startsWith("https://discord.com/ra/")) return true;
                      }
                  })
                  Jimp.read(embed.image.url).then(img => {
                      code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
                      if (code) {
                          if (code.data.startsWith("https://discord.com/ra/")) return true;
                      }
                  })
                  Jimp.read(embed.footer.iconURL).then(img => {
                      code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
                      if (code) {
                          if (code.data.startsWith("https://discord.com/ra/")) return true;
                      }
                  })
                  Jimp.read(embed.author.iconURL).then(img => {
                      code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
                      if (code) {
                          if (code.data.startsWith("https://discord.com/ra/")) return true;
                      }
                  })
                  return false;
              }) {
              try {
                  message.reply({
                      "embeds": [{
                          "description": ":warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account",
                          "color": null
                      }]
                  })
              } catch (error) {
                  if(error) message.delete();
              }
          }
      }) */

  // Funky debug commands
  if (message.content.toLowerCase().startsWith(prefix)) {
    switch (cmd) {
      case 'botinfo':
        // eslint-disable-next-line no-lone-blocks
        {
          const guildsSize = await bot.shard?.fetchClientValues('guilds.cache.size') as number[]
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
                    Bot Name: "${bot.user?.tag}"
                    Guild Count: ${guilds}
                    Shard Count: ${bot.shard?.count}
                    Shard Latency: ${Math.round(bot.ws.ping)}ms
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

          const embed = new Discord.EmbedBuilder()
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
        };
        break
      case 'update':
        if (!config.owners.includes(message.author.id)) return
        message.channel.send('Updating...').then((msg1) => {
          updateDb()
            .then(() => msg1.edit('Updated Database'))
            .catch(() => msg1.edit('Failed to Update Database'))
        })
        break
      case 'invite':
        await message.reply(config.inviteMsg)
        break
      case 'check': {
        const urls = args[0]
        if (!urls) {
          return message.reply(
                        `Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``
          )
        }

        const matchedREgexThing = urlRegex.exec(urls)
        if (matchedREgexThing) {
          const removeEndingSlash = matchedREgexThing[0].split('/')[2]
          if (removeEndingSlash === undefined) return message.reply('Please provide a valid URL')
          const splited = removeEndingSlash.split('.')
          const domain =
                        splited[splited.length - 2] + '.' + splited[splited.length - 1]
          await message.reply('Checking...').then(() =>
            message
              .edit(`${domain} is ${db.includes(domain) ? '' : 'not '}a scam.`)
              .catch(() => {
                message.edit(
                  'An error occurred while checking that domain name!\nTry again later'
                )
              })
          )
          return
        }
        await message.reply('Checking...').then((msg1) =>
          msg1
            .edit(`${urls} is ${db.includes(urls) ? '' : 'not '}a scam.`)
            .catch(() => {
              msg1.edit(
                'An error occurred while checking that domain name!\nTry again later'
              )
            })
        )
        break
      }
    }
  }
})

bot.login(config.discord.token)
