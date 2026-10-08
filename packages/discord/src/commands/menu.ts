import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { MenuItem } from "@lunch/core";
import type { BotCommand } from "../types.js";

/** 把品項依分類整理成 embed 欄位；超過 Discord 限制時截斷並附網頁連結 */
export function buildMenuEmbed(
  store: { id: number; name: string; phone: string; note: string },
  items: MenuItem[],
  publicUrl: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${store.name}`)
    .setDescription([store.phone ? `☎️ ${store.phone}` : "", store.note].filter(Boolean).join("\n") || null)
    .setURL(`${publicUrl}/stores/${store.id}`)
    .setColor(0xf59e0b);

  const groups = new Map<string, MenuItem[]>();
  for (const it of items.filter((i) => i.isAvailable)) {
    const key = it.category || "其他";
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  let fields = 0;
  for (const [cat, list] of groups) {
    if (fields >= 24) {
      embed.addFields({ name: "…", value: `品項太多，完整菜單請看 ${publicUrl}/stores/${store.id}` });
      break;
    }
    const lines = list.map((i) => `${i.name} ‧ $${i.price}`);
    let value = lines.join("\n");
    if (value.length > 1000) value = value.slice(0, 990) + "\n…";
    embed.addFields({ name: cat, value: value || "—" });
    fields++;
  }
  if (items.length === 0) embed.addFields({ name: "尚無品項", value: "請先在後台上架菜單" });
  return embed;
}

export const menu: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("查看店家菜單")
    .addStringOption((o) => o.setName("店家").setDescription("店名（可自動補全）").setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction, ctx) {
    const focused = interaction.options.getFocused();
    const stores = ctx.core.menus.searchStores(focused, 25);
    await interaction.respond(stores.map((s) => ({ name: s.name.slice(0, 100), value: String(s.id) })));
  },
  async execute(interaction, ctx) {
    const raw = interaction.options.getString("店家", true);
    const store = /^\d+$/.test(raw) ? safeGet(ctx, Number(raw)) : ctx.core.menus.findStoreByName(raw);
    if (!store) {
      await interaction.reply({ content: `找不到店家「${raw}」`, ephemeral: true });
      return;
    }
    const items = ctx.core.menus.listItems(store.id);
    await interaction.reply({ embeds: [buildMenuEmbed(store, items, ctx.publicUrl)], ephemeral: true });
  }
};

function safeGet(ctx: Parameters<NonNullable<BotCommand["execute"]>>[1], id: number) {
  try {
    const s = ctx.core.menus.getStore(id);
    return { id: s.id, name: s.name, phone: s.phone, note: s.note };
  } catch {
    return undefined;
  }
}
