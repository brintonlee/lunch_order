import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { CoreError } from "@lunch/core";
import { menu } from "./commands/menu.js";
import { ping } from "./commands/ping.js";
import type { BotCommand, BotContext } from "./types.js";

export interface DiscordBotOptions {
  token: string;
  clientId: string;
  /** 指定則註冊為該伺服器指令（立即生效），否則註冊全域 */
  guildId?: string;
}

export interface DiscordBot {
  client: Client;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const commands: BotCommand[] = [ping, menu];

export function createDiscordBot(opts: DiscordBotOptions, ctx: BotContext): DiscordBot {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const byName = new Map(commands.map((c) => [c.data.name, c]));

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = byName.get(interaction.commandName);
        if (!cmd) return;
        // 任何互動都確保使用者存在（成員自動建立）
        ctx.core.users.upsertFromDiscord({
          discordId: interaction.user.id,
          displayName: interaction.user.globalName ?? interaction.user.username,
          avatarUrl: interaction.user.displayAvatarURL()
        });
        await cmd.execute(interaction, ctx);
      } else if (interaction.isAutocomplete()) {
        const cmd = byName.get(interaction.commandName);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction, ctx);
      }
    } catch (err) {
      ctx.log.error("interaction failed", err);
      if (interaction.isRepliable()) {
        const content = err instanceof CoreError ? err.message : "發生錯誤，請稍後再試";
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content, ephemeral: true }).catch(() => {});
        else await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  });

  async function registerCommands(): Promise<void> {
    const rest = new REST().setToken(opts.token);
    const body = commands.map((c) => c.data.toJSON());
    if (opts.guildId) {
      await rest.put(Routes.applicationGuildCommands(opts.clientId, opts.guildId), { body });
      ctx.log.info(`Discord: registered ${body.length} guild commands in ${opts.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(opts.clientId), { body });
      ctx.log.info(`Discord: registered ${body.length} global commands`);
    }
  }

  return {
    client,
    async start() {
      await registerCommands();
      client.once(Events.ClientReady, (c) => ctx.log.info(`Discord: logged in as ${c.user.tag}`));
      await client.login(opts.token);
    },
    async stop() {
      await client.destroy();
    }
  };
}

export { buildMenuEmbed } from "./commands/menu.js";
export type { BotCommand, BotContext } from "./types.js";
