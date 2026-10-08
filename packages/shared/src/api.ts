import { z } from "zod";
import { menuDraftSchema } from "./menu.js";

export const userRoles = ["admin", "member"] as const;
export type UserRole = (typeof userRoles)[number];

export interface UserDto {
  id: number;
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  balance: number;
  createdAt: number;
}

export interface MenuItemDto {
  id: number;
  storeId: number;
  name: string;
  price: number;
  category: string;
  sortOrder: number;
  isAvailable: boolean;
}

export interface StoreDto {
  id: number;
  name: string;
  phone: string;
  address: string;
  note: string;
  menuVersion: number;
  menuUpdatedAt: number | null;
  status: "active" | "archived";
  itemCount: number;
}

export interface StoreDetailDto extends StoreDto {
  items: MenuItemDto[];
}

export interface MenuSubmissionDto {
  id: number;
  submittedBy: number;
  submitterName: string;
  storeNameHint: string;
  source: "ai" | "format" | "manual";
  imageUrls: string[];
  aiResult: unknown | null;
  editedResult: unknown | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: number | null;
  reviewedAt: number | null;
  rejectReason: string | null;
  createdAt: number;
}

export const upsertStoreBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default("")
});
export type UpsertStoreBody = z.infer<typeof upsertStoreBodySchema>;

export const replaceMenuBodySchema = z.object({
  items: menuDraftSchema.shape.items
});
export type ReplaceMenuBody = z.infer<typeof replaceMenuBodySchema>;

export const createSubmissionBodySchema = z.object({
  source: z.enum(["ai", "format", "manual"]),
  draft: menuDraftSchema,
  /** AI 原始輸出（可選，用於審核時比對） */
  aiResult: menuDraftSchema.optional(),
  /** 已上傳圖片的路徑（由 POST /api/menu-submissions/parse 回傳） */
  imagePaths: z.array(z.string()).max(10).default([])
});
export type CreateSubmissionBody = z.infer<typeof createSubmissionBodySchema>;

export const reviewSubmissionBodySchema = z.object({
  /** admin 審核時可再修改一次草稿 */
  draft: menuDraftSchema.optional()
});

export const rejectSubmissionBodySchema = z.object({
  reason: z.string().trim().max(200).default("")
});

export const formatImportBodySchema = z.object({
  text: z.string().min(1).max(200_000)
});

export const updateUserBodySchema = z.object({
  role: z.enum(userRoles)
});

export interface MeResponse {
  user: UserDto | null;
  features: { devLogin: boolean; aiProvider: string; discordBot: boolean };
}
