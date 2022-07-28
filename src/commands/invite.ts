import { SlashCommandBuilder, CommandInteraction, CacheType, Message } from 'discord.js'
import config from '../config.json'
import type { Command } from '../types'

export class InviteCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Gives the bot invite link.')

  chatInputRun = (interaction: CommandInteraction<CacheType>) => {
    return interaction.reply(config.inviteMsg)
  }

  messageRun = (message: Message<boolean>) => {
    return message.reply(config.inviteMsg)
  }
}
