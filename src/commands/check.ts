import { ChatInputCommandInteraction, CacheType, Message, SlashCommandBuilder, Client, EmbedBuilder } from "discord.js";
import * as config from '../../config.json';
import { scamDB } from "../bot";
import { urlRegex } from "../helpers";

import type { Command } from "../types";

const checkForScamLinks = (urls: string): string[] => {
  const matches = urls.match(urlRegex);
  if (matches === null) return [];

  // Remove duplicates from urlRegexResults
  const uniqueUrls = [...new Set(matches)];
  return uniqueUrls.map((url) => {
    const removeEndingSlash = url.split('/')[2];
    if (removeEndingSlash === undefined) return;
    const splited = removeEndingSlash.split('.');
    const domain =
      splited[splited.length - 2] + '.' + splited[splited.length - 1];
    if (scamDB.includes(domain)) return domain;
  }).filter((domain) => domain !== undefined) as string[];
};

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