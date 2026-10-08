import type { MenuDraft } from "@lunch/shared";

export interface MenuImage {
  mimeType: string;
  data: Buffer;
}

export interface ParseMenuOptions {
  /** 使用者提示的店名，幫模型對焦 */
  storeNameHint?: string;
}

export interface MenuParser {
  readonly name: string;
  parseMenuImages(images: MenuImage[], opts?: ParseMenuOptions): Promise<MenuDraft>;
}

export class MenuParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MenuParseError";
  }
}
