import { menuDraftSchema, type MenuDraft, type MenuDraftInput } from "@lunch/shared";
import { MenuParseError } from "./types.js";

/**
 * 不經 AI 的菜單匯入格式。支援兩種：
 *
 * 1. JSON：直接貼 MenuDraft 物件
 *    { "storeName": "...", "phone": "...", "items": [{ "name": "...", "price": 50, "category": "..." }] }
 *
 * 2. 純文字：
 *    店名: 八方雲集
 *    電話: 02-1234-5678
 *    地址: 台北市...
 *    備註: 滿 300 外送
 *    [鍋貼]
 *    招牌鍋貼 7
 *    韭菜鍋貼, 7
 *    [湯]
 *    酸辣湯	35
 *
 *    - `key: value`（店名/電話/地址/備註，也接受 storeName/phone/address/note）
 *    - `[分類]` 或 `# 分類` 開頭的行是分類標題，之後的品項都歸此分類
 *    - 品項行：名稱與價格以逗號、tab 或空白分隔，價格取最後一個數字；可寫「$50」「50元」
 *    - `//` 或 `;` 開頭為註解
 */
export function parseMenuText(text: string): MenuDraft {
  const trimmed = text.trim();
  if (!trimmed) throw new MenuParseError("內容是空的");
  if (trimmed.startsWith("{")) return parseJson(trimmed);
  return parsePlainText(trimmed);
}

function parseJson(text: string): MenuDraft {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    throw new MenuParseError("JSON 格式錯誤：" + (err as Error).message, err);
  }
  const res = menuDraftSchema.safeParse(obj);
  if (!res.success) {
    throw new MenuParseError("JSON 內容不符：" + res.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("、"));
  }
  return res.data;
}

const HEADER_KEYS: Record<string, keyof Omit<MenuDraftInput, "items">> = {
  店名: "storeName",
  店家: "storeName",
  storename: "storeName",
  store: "storeName",
  name: "storeName",
  電話: "phone",
  phone: "phone",
  tel: "phone",
  地址: "address",
  address: "address",
  備註: "note",
  note: "note"
};

const PRICE_RE = /(?:nt\$|\$|NT)?\s*(?<!\d)(\d{1,6})\s*(?:元|塊)?$/i;

function parsePlainText(text: string): MenuDraft {
  const draft: MenuDraftInput = { storeName: "", phone: "", address: "", note: "", items: [] };
  let category = "";
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith(";")) return;

    const header = line.match(/^([^:：]{1,12})[:：]\s*(.*)$/);
    if (header) {
      const key = HEADER_KEYS[header[1]!.trim().toLowerCase()];
      if (key) {
        draft[key] = header[2]!.trim();
        return;
      }
    }

    const cat = line.match(/^(?:\[(.+)\]|#+\s*(.+)|【(.+)】)$/);
    if (cat) {
      category = (cat[1] ?? cat[2] ?? cat[3] ?? "").trim();
      return;
    }

    const parts = line.split(/[,，\t]|\s{1,}/).map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    const priceMatch = last.match(PRICE_RE);
    if (!priceMatch || parts.length < 2) {
      // 整行結尾可能是「牛肉麵 120元」沒有分隔符號以外的情形，再試一次整行比對
      const whole = line.match(/^(.*?)[\s,，\t]*(?:nt\$|\$|NT)?\s*(?<!\d)(\d{1,6})\s*(?:元|塊)?$/i);
      if (whole && whole[1]!.trim()) {
        draft.items.push({ name: whole[1]!.trim(), price: Number(whole[2]), category });
        return;
      }
      errors.push(`第 ${idx + 1} 行看不懂：「${line}」`);
      return;
    }
    const name = parts.slice(0, -1).join(" ").trim();
    if (!name) {
      errors.push(`第 ${idx + 1} 行缺少品項名稱：「${line}」`);
      return;
    }
    draft.items.push({ name, price: Number(priceMatch[1]), category });
  });

  if (errors.length) throw new MenuParseError(errors.slice(0, 5).join("\n"));
  if (!draft.storeName) throw new MenuParseError("缺少店名，請加一行「店名: xxx」");
  const res = menuDraftSchema.safeParse(draft);
  if (!res.success) throw new MenuParseError(res.error.issues.map((i) => i.message).join("、"));
  return res.data;
}

export const MENU_TEXT_TEMPLATE = `店名: 範例小吃店
電話: 02-1234-5678
地址: 台北市某路 1 號
備註: 滿 300 元外送

[飯類]
滷肉飯 40
雞腿飯, 95

[湯類]
貢丸湯	30
`;
