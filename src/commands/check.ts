import { ChatInputCommandInteraction, CacheType, Message, SlashCommandBuilder, Client, EmbedBuilder } from "discord.js";
import { checkForScamLinks } from "../helpers";

import type { Command } from "../types";

export default {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Checks a provided scam URL against the database.")
    .addStringOption((option) =>
      option.setName('text_to_check').setDescription('The domain to check.').setRequired(true)
    ),
  executeInteraction: function (interaction: ChatInputCommandInteraction<CacheType>) {
    const textToCheck = interaction.options.getString('text_to_check', true);
    const scamDomainsFound = checkForScamLinks(textToCheck);

    if (scamDomainsFound.length === 0) {
      interaction.reply({
        content: 'No scam domains found.',
        ephemeral: true
      });
    }
    interaction.reply({
      content: `Found ${scamDomainsFound.length} scam domains: ${scamDomainsFound.join(', ')}`,
    });
  },
  executeMessage: function (message: Message<boolean>, args: string[]) {
    const scamDomainsFound = checkForScamLinks(args.join(' '));

    if (scamDomainsFound.length === 0) {
      message.reply({
        content: 'No scam domains found.',
      });
    }
    message.reply({
      content: `Found ${scamDomainsFound.length} scam domains: ${scamDomainsFound.join(', ')}`,
    });
  }
} as Command;