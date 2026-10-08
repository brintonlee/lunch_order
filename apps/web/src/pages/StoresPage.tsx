import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorBox } from "../components/ErrorBox";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

export function StoresPage() {
  const { isAdmin } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const stores = useQuery({ queryKey: ["stores", showArchived], queryFn: () => api.stores(showArchived) });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.createStore({ name: name.trim(), phone: "", address: "", note: "" }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      nav(`/stores/${s.id}`);
    }
  });

  return (
    <div className="stack">
      <div className="page-head">
        <h2>店家與菜單</h2>
        {isAdmin && (
          <label className="inline">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> 顯示已下架
          </label>
        )}
      </div>
      {isAdmin && (
        <form
          className="card row"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新店家名稱" required />
          <button className="btn btn-primary" disabled={create.isPending}>
            新增店家
          </button>
          <ErrorBox error={create.error} />
        </form>
      )}
      <ErrorBox error={stores.error} />
      <div className="store-list">
        {stores.data?.map((s) => (
          <Link key={s.id} to={`/stores/${s.id}`} className={`card store-card ${s.status === "archived" ? "archived" : ""}`}>
            <div className="store-name">
              {s.name} {s.status === "archived" && <span className="badge">已下架</span>}
            </div>
            <div className="muted small">
              {s.phone || "（無電話）"} ‧ {s.itemCount} 個品項 ‧ v{s.menuVersion}
            </div>
          </Link>
        ))}
        {stores.data?.length === 0 && <p className="muted">還沒有店家。{isAdmin ? "在上方新增，或到「格式匯入」/「推薦菜單」上架。" : "請到「推薦菜單」投稿。"}</p>}
      </div>
    </div>
  );
}
