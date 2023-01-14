import { ChatInputCommandInteraction, CacheType, Message, SlashCommandBuilder } from "discord.js";
import * as config from '../../config.json';

import type { Command } from "../types";
import { scamDB, serverDB } from "..";
import { updateDatabase } from "../helpers";

export default {
  data: new SlashCommandBuilder().setName("update_db").setDescription("Updates database."),
  executeInteraction: async function (interaction: ChatInputCommandInteraction<CacheType>) {
    if (!config.owners.includes(interaction.user.id)) return;
    await interaction.reply('Updating...')
    updateDatabase(scamDB, serverDB)
      .then(() => interaction.editReply('Updated Database'))
      .catch(() => interaction.editReply('Failed to Update Database'));
  },
  executeMessage: async function (message: Message<boolean>) {
    if (!config.owners.includes(message.author.id)) return;
    const tempMSG = await message.reply('Updating...')
    updateDatabase(scamDB, serverDB)
      .then(() => tempMSG.edit('Updated Database'))
      .catch(() => tempMSG.edit('Failed to Update Database'));
  }
} as Command;