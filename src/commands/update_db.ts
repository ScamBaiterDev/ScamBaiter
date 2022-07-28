import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js'
import config from '../config.json'
import { updateDb } from '../helpers'
import type { Command } from '../types'

export default class UpdateDBCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('update_db')
    .setDescription('Updates database')

  chatInputRun = (interaction: ChatInputCommandInteraction) => {
    if (!config.owners.includes(interaction.user.id)) return
    interaction.reply('Updating...').then(() => {
      updateDb()
        .then(() => interaction.editReply('Updated Database'))
        .catch(() => interaction.editReply('Failed to Update Database'))
    })
  }

  messageRun = (message: Message<boolean>) => {
    if (!config.owners.includes(message.author.id)) return
    message.reply('Updating...').then((msg) => {
      updateDb()
        .then(() => msg.edit('Updated Database'))
        .catch(() => msg.edit('Failed to Update Database'))
    })
  }
}
