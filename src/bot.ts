import Discord, { Partials } from 'discord.js'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import WebSocket from 'ws'
import config from './config.json'
import path from 'path'
import Jimp from 'jimp'
import jsQR from 'jsqr'
import type { ShardData } from './index'
import { updateDb, urlRegex, walk } from './helpers'
import type { Command } from './types'

export const DBPath = path.join(__dirname, '..', 'db.json')
export let db: string[] = []
export let lastUpdate: Date | null = null
export const setLastUpdate = (date: Date) => {
  lastUpdate = date
}
export let lastIdPerGuild: {
    messageId: string,
    userId: string,
    guildId: string,
}[] = []
export const startup = new Date()
export const prefix = '$'

process.on('message', (msg: ShardData) => {
  if (!msg.type) return

  if (msg.type === 'activity') {
    console.info(msg)
    bot.user?.setPresence(msg.data)
  }
})

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

const commands = new Discord.Collection<string, Command>()

bot.once('ready', async () => {
  console.info(`Logged in as ${bot.user?.tag}`)
  await updateDb()

  const commandFiles = await walk(`${process.cwd()}/dist/commands`, /\.js$/)
  const dataToSubmitToDiscord: Discord.RESTPostAPIApplicationCommandsJSONBody[] = []
  for await (const file of commandFiles) {
    const Command = (await import(file)).default
    const CommandInstace: Command = new Command()

    commands.set(CommandInstace.data.name, Command)
    dataToSubmitToDiscord.push(CommandInstace.data.toJSON())
  }

  const rest = new REST().setToken(config.discord.token)
  rest.put(Routes.applicationCommands(config.discord.client_id), {
    body: dataToSubmitToDiscord
  })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error)
})

bot.on('interactionCreate', async (interaction): Promise<any> => {
  if (!interaction.isChatInputCommand()) return
  if (commands.has(interaction.commandName)) return await commands.get(interaction.commandName)?.chatInputRun(interaction)
})

bot.on('messageCreate', async (message): Promise<any> => {
  if (message.author.id === bot.user?.id || message.guild === undefined) return

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
    if (commands.has(cmd!)) return await commands.get(cmd!)?.messageRun(message, args)
  }
})

bot.login(config.discord.token)
