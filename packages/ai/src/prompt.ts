import { menuDraftSchema, type MenuDraft } from "@lunch/shared";
import { MenuParseError } from "./types.js";

export function buildPrompt(storeNameHint?: string): string {
  return [
    "你是菜單辨識助手。請閱讀這些菜單照片，輸出一個 JSON 物件，欄位如下：",
    "- storeName: 店名（繁體中文，若照片沒有就用提示的店名或空字串）",
    "- phone: 訂餐電話（保留原格式，沒有則空字串）",
    "- address: 地址（沒有則空字串）",
    "- note: 其他重要資訊，如外送門檻、公休日（沒有則空字串）",
    "- items: 品項陣列，每項含 name（品項名稱，繁體中文）、price（整數新台幣，一個品項多種價格時拆成多項並在名稱加上規格，例如「牛肉麵 (大)」）、category（菜單上的分類標題，沒有則空字串）、confidence（0–1，對名稱與價格的信心）",
    "規則：",
    "1. 只輸出 JSON，不要加說明。",
    "2. 看不清楚的價格請仍填數字並把 confidence 設低（<0.5），不要省略品項。",
    "3. 依照菜單上的順序列出品項，不要重複。",
    storeNameHint ? `提示：使用者說這家店叫「${storeNameHint}」。` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

/** 模型回傳的 JSON schema（Gemini / OpenAI 皆可用的子集） */
export const menuJsonSchema = {
  type: "object",
  properties: {
    storeName: { type: "string" },
    phone: { type: "string" },
    address: { type: "string" },
    note: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { type: "integer" },
          category: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["name", "price", "category", "confidence"]
      }
    }
  },
  required: ["storeName", "phone", "address", "note", "items"]
} as const;

/** 把模型輸出（可能夾雜 ```json fence）轉成合法 MenuDraft */
export function coerceModelOutput(raw: string, storeNameHint?: string): MenuDraft {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new MenuParseError("AI 回傳的內容不是合法 JSON", err);
  }
  if (typeof parsed !== "object" || parsed === null) throw new MenuParseError("AI 回傳的內容不是物件");
  const obj = parsed as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const cleaned = {
    storeName: String(obj.storeName ?? "").trim() || storeNameHint || "",
    phone: String(obj.phone ?? ""),
    address: String(obj.address ?? ""),
    note: String(obj.note ?? ""),
    items: items
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        name: String(it.name ?? "").trim(),
        price: Math.max(0, Math.round(Number(it.price ?? 0)) || 0),
        category: String(it.category ?? "").trim(),
        confidence: clamp01(Number(it.confidence ?? 1))
      }))
      .filter((it) => it.name.length > 0)
  };
  if (cleaned.items.length === 0) throw new MenuParseError("AI 沒有辨識出任何品項，請換張更清楚的照片");
  const result = menuDraftSchema.safeParse({ ...cleaned, storeName: cleaned.storeName || "未命名店家" });
  if (!result.success) throw new MenuParseError("AI 輸出格式不符：" + result.error.issues.map((i) => i.message).join("、"));
  return result.data;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}
