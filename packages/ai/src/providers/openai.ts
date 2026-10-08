import OpenAI from "openai";
import type { MenuDraft } from "@lunch/shared";
import { buildPrompt, coerceModelOutput, menuJsonSchema } from "../prompt.js";
import { MenuParseError, type MenuImage, type MenuParser, type ParseMenuOptions } from "../types.js";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIMenuParser implements MenuParser {
  readonly name: string;
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string = OPENAI_DEFAULT_MODEL,
    baseURL?: string
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.name = `openai:${model}`;
  }

  async parseMenuImages(images: MenuImage[], opts: ParseMenuOptions = {}): Promise<MenuDraft> {
    let text: string | null | undefined;
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: { name: "menu", schema: menuJsonSchema as unknown as Record<string, unknown> }
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(opts.storeNameHint) },
              ...images.map((img) => ({
                type: "image_url" as const,
                image_url: { url: `data:${img.mimeType};base64,${img.data.toString("base64")}` }
              }))
            ]
          }
        ]
      });
      text = res.choices[0]?.message.content;
    } catch (err) {
      throw new MenuParseError(`OpenAI 呼叫失敗：${(err as Error).message}`, err);
    }
    if (!text) throw new MenuParseError("OpenAI 沒有回傳內容");
    return coerceModelOutput(text, opts.storeNameHint);
  }
}
