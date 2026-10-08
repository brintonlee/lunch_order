import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types.js";

export const ping: BotCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("確認 Bot 有在線上"),
  async execute(interaction) {
    await interaction.reply({ content: `pong！延遲 ${Date.now() - interaction.createdTimestamp} ms`, ephemeral: true });
  }
};
