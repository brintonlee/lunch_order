import { GEMINI_DEFAULT_MODEL, GeminiMenuParser } from "./providers/gemini.js";
import { OPENAI_DEFAULT_MODEL, OpenAIMenuParser } from "./providers/openai.js";
import type { MenuParser } from "./types.js";

export type AiProviderName = "gemini" | "openai" | "none";

export interface AiConfig {
  provider: AiProviderName;
  apiKey?: string;
  model?: string;
  /** OpenAI 相容端點（例如自架 / 其他供應商）可覆寫 */
  baseUrl?: string;
}

/** 依環境設定建立菜單解析器；provider=none 或缺 API key 時回傳 null，網站僅提供格式匯入 */
export function createMenuParser(cfg: AiConfig): MenuParser | null {
  if (cfg.provider === "none") return null;
  if (!cfg.apiKey) return null;
  switch (cfg.provider) {
    case "gemini":
      return new GeminiMenuParser(cfg.apiKey, cfg.model || GEMINI_DEFAULT_MODEL);
    case "openai":
      return new OpenAIMenuParser(cfg.apiKey, cfg.model || OPENAI_DEFAULT_MODEL, cfg.baseUrl);
    default:
      return null;
  }
}

export { MENU_TEXT_TEMPLATE, parseMenuText } from "./format.js";
export { coerceModelOutput } from "./prompt.js";
export { GeminiMenuParser } from "./providers/gemini.js";
export { OpenAIMenuParser } from "./providers/openai.js";
export { MenuParseError, type MenuImage, type MenuParser, type ParseMenuOptions } from "./types.js";
