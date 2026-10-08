import { GoogleGenAI } from "@google/genai";
import type { MenuDraft } from "@lunch/shared";
import { buildPrompt, coerceModelOutput, menuJsonSchema } from "../prompt.js";
import { MenuParseError, type MenuImage, type MenuParser, type ParseMenuOptions } from "../types.js";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiMenuParser implements MenuParser {
  readonly name: string;
  private client: GoogleGenAI;

  constructor(
    apiKey: string,
    private model: string = GEMINI_DEFAULT_MODEL
  ) {
    this.client = new GoogleGenAI({ apiKey });
    this.name = `gemini:${model}`;
  }

  async parseMenuImages(images: MenuImage[], opts: ParseMenuOptions = {}): Promise<MenuDraft> {
    let text: string | undefined;
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              { text: buildPrompt(opts.storeNameHint) },
              ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data.toString("base64") } }))
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: menuJsonSchema,
          temperature: 0.1
        }
      });
      text = res.text;
    } catch (err) {
      throw new MenuParseError(`Gemini 呼叫失敗：${(err as Error).message}`, err);
    }
    if (!text) throw new MenuParseError("Gemini 沒有回傳內容");
    return coerceModelOutput(text, opts.storeNameHint);
  }
}
