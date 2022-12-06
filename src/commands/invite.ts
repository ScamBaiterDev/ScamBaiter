import { ChatInputCommandInteraction, CacheType, Message, SlashCommandBuilder, Client, EmbedBuilder } from "discord.js";
import * as config from '../../config.json';

import type { Command } from "../types";

export default {
  data: new SlashCommandBuilder().setName("invite").setDescription("Gets the bot invite link."),
  executeInteraction: function (interaction: ChatInputCommandInteraction<CacheType>) {
    return interaction.reply(config.inviteMsg);
  },
  executeMessage: function (message: Message<boolean>) {
    return message.reply(config.inviteMsg);
  }
} as Command;