import { desc, eq } from "drizzle-orm";
import { menuDraftSchema, type CreateSubmissionBody, type MenuDraft, type MenuSubmissionDto } from "@lunch/shared";
import type { Db } from "../db/index.js";
import { menuSubmissions, users, type MenuSubmission, type User } from "../db/schema.js";
import { CoreError } from "../errors.js";
import type { CoreEventBus } from "../events.js";
import type { MenuService } from "./menu.js";

export class SubmissionService {
  constructor(
    private db: Db,
    private events: CoreEventBus,
    private menus: MenuService,
    private imageUrl: (path: string) => string
  ) {}

  create(body: CreateSubmissionBody, actor: User): MenuSubmissionDto {
    const row = this.db
      .insert(menuSubmissions)
      .values({
        submittedBy: actor.id,
        storeNameHint: body.draft.storeName,
        source: body.source,
        imagePathsJson: JSON.stringify(body.imagePaths),
        aiResultJson: body.aiResult ? JSON.stringify(body.aiResult) : null,
        editedResultJson: JSON.stringify(body.draft)
      })
      .returning()
      .get()!;
    this.events.emit("submission.created", {
      submissionId: row.id,
      submittedBy: actor.id,
      storeName: body.draft.storeName
    });
    return this.toDto(row, actor.displayName);
  }

  list(opts: { status?: MenuSubmission["status"]; actor: User }): MenuSubmissionDto[] {
    const rows = this.db
      .select({ sub: menuSubmissions, submitterName: users.displayName })
      .from(menuSubmissions)
      .innerJoin(users, eq(users.id, menuSubmissions.submittedBy))
      .where(opts.status ? eq(menuSubmissions.status, opts.status) : undefined)
      .orderBy(desc(menuSubmissions.createdAt))
      .all();
    // 成員只看得到自己的投稿
    const visible = opts.actor.role === "admin" ? rows : rows.filter((r) => r.sub.submittedBy === opts.actor.id);
    return visible.map((r) => this.toDto(r.sub, r.submitterName));
  }

  get(id: number, actor: User): MenuSubmissionDto {
    const row = this.db
      .select({ sub: menuSubmissions, submitterName: users.displayName })
      .from(menuSubmissions)
      .innerJoin(users, eq(users.id, menuSubmissions.submittedBy))
      .where(eq(menuSubmissions.id, id))
      .get();
    if (!row) throw new CoreError("NOT_FOUND", "找不到投稿");
    if (actor.role !== "admin" && row.sub.submittedBy !== actor.id) throw new CoreError("FORBIDDEN", "無法檢視他人投稿");
    return this.toDto(row.sub, row.submitterName);
  }

  /** 投稿者在 pending 狀態下可修改草稿 */
  updateDraft(id: number, draft: MenuDraft, actor: User): MenuSubmissionDto {
    const sub = this.requirePending(id);
    if (actor.role !== "admin" && sub.submittedBy !== actor.id) throw new CoreError("FORBIDDEN", "無法修改他人投稿");
    this.db
      .update(menuSubmissions)
      .set({ editedResultJson: JSON.stringify(draft), storeNameHint: draft.storeName })
      .where(eq(menuSubmissions.id, id))
      .run();
    return this.get(id, actor);
  }

  /** admin 核准：可再帶一份修正過的草稿；同名店家整份取代，否則新建 */
  approve(id: number, draftOverride: MenuDraft | undefined, actor: User): { submission: MenuSubmissionDto; storeId: number } {
    if (actor.role !== "admin") throw new CoreError("FORBIDDEN", "只有 admin 可以審核");
    const sub = this.requirePending(id);
    const draft = draftOverride ?? menuDraftSchema.parse(JSON.parse(sub.editedResultJson));
    const store = this.menus.applyDraft(draft, actor);
    this.db
      .update(menuSubmissions)
      .set({
        status: "approved",
        editedResultJson: JSON.stringify(draft),
        reviewedBy: actor.id,
        reviewedAt: Date.now()
      })
      .where(eq(menuSubmissions.id, id))
      .run();
    this.events.emit("submission.reviewed", { submissionId: id, status: "approved", storeId: store.id });
    return { submission: this.get(id, actor), storeId: store.id };
  }

  reject(id: number, reason: string, actor: User): MenuSubmissionDto {
    if (actor.role !== "admin") throw new CoreError("FORBIDDEN", "只有 admin 可以審核");
    this.requirePending(id);
    this.db
      .update(menuSubmissions)
      .set({ status: "rejected", rejectReason: reason, reviewedBy: actor.id, reviewedAt: Date.now() })
      .where(eq(menuSubmissions.id, id))
      .run();
    this.events.emit("submission.reviewed", { submissionId: id, status: "rejected" });
    return this.get(id, actor);
  }

  private requirePending(id: number): MenuSubmission {
    const sub = this.db.select().from(menuSubmissions).where(eq(menuSubmissions.id, id)).get();
    if (!sub) throw new CoreError("NOT_FOUND", "找不到投稿");
    if (sub.status !== "pending") throw new CoreError("CONFLICT", "此投稿已審核過");
    return sub;
  }

  private toDto(s: MenuSubmission, submitterName: string): MenuSubmissionDto {
    const paths = JSON.parse(s.imagePathsJson) as string[];
    return {
      id: s.id,
      submittedBy: s.submittedBy,
      submitterName,
      storeNameHint: s.storeNameHint,
      source: s.source,
      imageUrls: paths.map(this.imageUrl),
      aiResult: s.aiResultJson ? JSON.parse(s.aiResultJson) : null,
      editedResult: JSON.parse(s.editedResultJson),
      status: s.status,
      reviewedBy: s.reviewedBy,
      reviewedAt: s.reviewedAt,
      rejectReason: s.rejectReason,
      createdAt: s.createdAt
    };
  }
}
