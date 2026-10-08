import type {
  CreateSubmissionBody,
  MeResponse,
  MenuDraft,
  MenuSubmissionDto,
  StoreDetailDto,
  StoreDto,
  UpsertStoreBody,
  UserDto
} from "@lunch/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    ...init
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = data as { error?: string; code?: string } | null;
    throw new ApiError(res.status, e?.error ?? `HTTP ${res.status}`, e?.code);
  }
  return data as T;
}

export const api = {
  me: () => request<MeResponse>("GET", "/me"),
  logout: () => request<{ ok: true }>("POST", "/logout"),
  devLogin: (discordId: string, displayName: string) => request<{ user: UserDto }>("POST", "/auth/dev", { discordId, displayName }),

  stores: (includeArchived = false) => request<StoreDto[]>("GET", `/stores?includeArchived=${includeArchived}`),
  store: (id: number) => request<StoreDetailDto>("GET", `/stores/${id}`),
  createStore: (body: UpsertStoreBody) => request<StoreDetailDto>("POST", "/stores", body),
  updateStore: (id: number, body: Partial<UpsertStoreBody> & { status?: "active" | "archived" }) =>
    request<StoreDetailDto>("PUT", `/stores/${id}`, body),
  replaceMenu: (id: number, items: MenuDraft["items"]) => request<StoreDetailDto>("PUT", `/stores/${id}/menu`, { items }),
  deleteStore: (id: number) => request<void>("DELETE", `/stores/${id}`),
  setItemAvailability: (id: number, isAvailable: boolean) => request("PATCH", `/menu-items/${id}`, { isAvailable }),

  parseImages: (form: FormData) => request<{ draft: MenuDraft; imagePaths: string[]; provider: string }>("POST", "/menu-submissions/parse", form),
  parseText: (text: string) => request<{ draft: MenuDraft }>("POST", "/menu-submissions/parse-text", { text }),
  template: () => request<{ text: string }>("GET", "/menu-submissions/template"),
  createSubmission: (body: CreateSubmissionBody) => request<MenuSubmissionDto>("POST", "/menu-submissions", body),
  submissions: (status?: string) => request<MenuSubmissionDto[]>("GET", `/menu-submissions${status ? `?status=${status}` : ""}`),
  submission: (id: number) => request<MenuSubmissionDto>("GET", `/menu-submissions/${id}`),
  updateSubmission: (id: number, draft: MenuDraft) => request<MenuSubmissionDto>("PUT", `/menu-submissions/${id}`, { draft }),
  approveSubmission: (id: number, draft?: MenuDraft) =>
    request<{ submission: MenuSubmissionDto; storeId: number }>("POST", `/menu-submissions/${id}/approve`, { draft }),
  rejectSubmission: (id: number, reason: string) => request<MenuSubmissionDto>("POST", `/menu-submissions/${id}/reject`, { reason }),
  applyDraft: (draft: MenuDraft) => request<StoreDetailDto>("POST", "/menus/apply", { draft }),

  users: () => request<UserDto[]>("GET", "/users"),
  setRole: (id: number, role: "admin" | "member") => request<UserDto>("PATCH", `/users/${id}`, { role })
};
