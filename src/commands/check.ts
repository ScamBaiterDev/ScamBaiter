import { SlashCommandBuilder, Message, CommandInteraction } from 'discord.js'
import { db, prefix } from '../bot'
import { urlRegex } from '../helpers'
import type { Command } from '../types'

export default class PingCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('check')
    .setDescription('Checks a provided scam URL against the database.')
    .addStringOption((option) =>
      option.setName('scam_url').setDescription('The domain to check.').setRequired(true)
    )

  chatInputRun = async (interaction: CommandInteraction) => {
    // @ts-ignore THIS IS VALID
    const scamUrl = interaction.options.getString('scam_url', true)
    const regexResult = urlRegex.exec(scamUrl)
    if (regexResult) {
      const removeEndingSlash = regexResult[0].split('/')[2]
      if (removeEndingSlash === undefined) return interaction.reply('Please provide a valid URL')
      const splited = removeEndingSlash.split('.')
      const domain =
                    splited[splited.length - 2] + '.' + splited[splited.length - 1]
      await interaction.reply('Checking...')
      try {
        return interaction
          .editReply(`${domain} is ${db.includes(domain) ? '' : 'not '}a scam.`)
      } catch {
        return interaction.editReply(
          'An error occurred while checking that domain name!\nTry again later'
        )
      }
    }
    await interaction.reply('Checking...')
    try {
      return interaction
        .editReply(`${scamUrl} is ${db.includes(scamUrl) ? '' : 'not '}a scam.`)
    } catch {
      return interaction.editReply(
        'An error occurred while checking that domain name!\nTry again later'
      )
    }
  }

  messageRun = (message: Message<boolean>, args: string[]) => {
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
      return message.reply('Checking...').then(() =>
        message
          .edit(`${domain} is ${db.includes(domain) ? '' : 'not '}a scam.`)
          .catch(() => {
            message.edit(
              'An error occurred while checking that domain name!\nTry again later'
            )
          })
      )
    }
    return message.reply('Checking...').then((msg1) =>
      msg1
        .edit(`${urls} is ${db.includes(urls) ? '' : 'not '}a scam.`)
        .catch(() => {
          msg1.edit(
            'An error occurred while checking that domain name!\nTry again later'
          )
        })
    )
  }
}
