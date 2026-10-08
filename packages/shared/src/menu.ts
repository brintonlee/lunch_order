import { z } from "zod";

/** 單一品項草稿（AI 解析、格式匯入、人工編輯共用） */
export const menuItemDraftSchema = z.object({
  name: z.string().trim().min(1, "品項名稱不可為空").max(80),
  price: z.number().int("價格必須是整數").min(0, "價格不可為負"),
  category: z.string().trim().max(40).optional().default(""),
  /** AI 解析時的信心度 0–1；人工輸入為 undefined */
  confidence: z.number().min(0).max(1).optional()
});
export type MenuItemDraft = z.infer<typeof menuItemDraftSchema>;

/** 一份完整菜單草稿 */
export const menuDraftSchema = z.object({
  storeName: z.string().trim().min(1, "店名不可為空").max(60),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  items: z.array(menuItemDraftSchema).min(1, "至少要有一個品項").max(500)
});
export type MenuDraft = z.infer<typeof menuDraftSchema>;
export type MenuDraftInput = z.input<typeof menuDraftSchema>;

/** 店名比對用：去除所有空白、全形轉半形、小寫 */
export function normalizeStoreName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const submissionStatuses = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const submissionSources = ["ai", "format", "manual"] as const;
export type SubmissionSource = (typeof submissionSources)[number];
