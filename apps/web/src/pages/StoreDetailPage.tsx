import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { menuDraftSchema, type MenuDraft } from "@lunch/shared";
import { ErrorBox } from "../components/ErrorBox";
import { MenuDraftEditor } from "../components/MenuDraftEditor";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

export function StoreDetailPage() {
  const id = Number(useParams().id);
  const { isAdmin } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const store = useQuery({ queryKey: ["store", id], queryFn: () => api.store(id) });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MenuDraft | null>(null);

  useEffect(() => {
    if (store.data && editing && !draft) {
      setDraft({
        storeName: store.data.name,
        phone: store.data.phone,
        address: store.data.address,
        note: store.data.note,
        items: store.data.items.map((i) => ({ name: i.name, price: i.price, category: i.category, isAvailable: i.isAvailable }))
      });
    }
  }, [store.data, editing, draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const parsed = menuDraftSchema.safeParse(draft);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("、"));
      const d = parsed.data;
      await api.replaceMenu(id, d.items);
      return api.updateStore(id, { name: d.storeName, phone: d.phone, address: d.address, note: d.note });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", id] });
      qc.invalidateQueries({ queryKey: ["stores"] });
      setEditing(false);
      setDraft(null);
    }
  });
  const toggleArchive = useMutation({
    mutationFn: () => api.updateStore(id, { status: store.data?.status === "archived" ? "active" : "archived" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", id] });
      qc.invalidateQueries({ queryKey: ["stores"] });
    }
  });
  const remove = useMutation({
    mutationFn: () => api.deleteStore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      nav("/stores");
    }
  });
  const toggleItem = useMutation({
    mutationFn: ({ itemId, v }: { itemId: number; v: boolean }) => api.setItemAvailability(itemId, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store", id] })
  });

  if (store.isLoading) return <p className="muted">載入中…</p>;
  if (store.error || !store.data) return <ErrorBox error={store.error ?? "找不到店家"} />;
  const s = store.data;

  if (editing && draft) {
    return (
      <div className="stack">
        <div className="page-head">
          <h2>編輯：{s.name}</h2>
        </div>
        <div className="card">
          <MenuDraftEditor draft={draft} onChange={setDraft} />
          <div className="actions">
            <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
              儲存（整份取代菜單，v{s.menuVersion} → v{s.menuVersion + 1}）
            </button>
            <button
              className="btn"
              onClick={() => {
                setEditing(false);
                setDraft(null);
              }}
            >
              取消
            </button>
          </div>
          <ErrorBox error={save.error} />
        </div>
      </div>
    );
  }

  const groups = new Map<string, typeof s.items>();
  for (const it of s.items) groups.set(it.category || "其他", [...(groups.get(it.category || "其他") ?? []), it]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link to="/stores" className="muted small">
            ← 店家列表
          </Link>
          <h2>
            {s.name} {s.status === "archived" && <span className="badge">已下架</span>}
          </h2>
          <div className="muted">
            {s.phone && <span>☎️ {s.phone} · </span>}
            {s.address && <span>📍 {s.address} · </span>}
            <span>菜單 v{s.menuVersion}</span>
            {s.menuUpdatedAt && <span>，更新於 {new Date(s.menuUpdatedAt).toLocaleString("zh-TW")}</span>}
          </div>
          {s.note && <p className="note">{s.note}</p>}
        </div>
        {isAdmin && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              編輯菜單
            </button>
            <button className="btn" onClick={() => toggleArchive.mutate()}>
              {s.status === "archived" ? "重新上架" : "下架"}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm(`確定刪除「${s.name}」與所有品項？`)) remove.mutate();
              }}
            >
              刪除
            </button>
          </div>
        )}
      </div>
      <ErrorBox error={toggleArchive.error ?? remove.error ?? toggleItem.error} />
      {s.items.length === 0 && <p className="muted card">尚無品項。{isAdmin && "按「編輯菜單」或用格式匯入加入品項。"}</p>}
      {[...groups.entries()].map(([cat, items]) => (
        <section key={cat} className="card">
          <h3>{cat}</h3>
          <ul className="menu-list">
            {items.map((it) => (
              <li key={it.id} className={it.isAvailable ? "" : "unavailable"}>
                <span className="item-name">{it.name}</span>
                <span className="item-price">${it.price}</span>
                {isAdmin && (
                  <button className="btn btn-ghost small" onClick={() => toggleItem.mutate({ itemId: it.id, v: !it.isAvailable })}>
                    {it.isAvailable ? "暫停供應" : "恢復供應"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
