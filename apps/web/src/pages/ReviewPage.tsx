import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBox } from "../components/ErrorBox";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

const STATUS_LABEL = { pending: "待審核", approved: "已核准", rejected: "已退回" } as const;
const SOURCE_LABEL = { ai: "AI 照片", format: "格式匯入", manual: "手動" } as const;

export function ReviewPage() {
  const { isAdmin } = useMe();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const subs = useQuery({ queryKey: ["submissions", status], queryFn: () => api.submissions(status || undefined) });

  return (
    <div className="stack">
      <div className="page-head">
        <h2>{isAdmin ? "菜單投稿審核" : "我的投稿"}</h2>
        <div className="tabs">
          {(["pending", "approved", "rejected", ""] as const).map((s) => (
            <button key={s} className={`tab ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
              {s ? STATUS_LABEL[s] : "全部"}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={subs.error} />
      {subs.data?.length === 0 && <p className="muted card">沒有投稿。</p>}
      <div className="store-list">
        {subs.data?.map((s) => (
          <Link key={s.id} to={`/submissions/${s.id}`} className="card store-card">
            <div className="store-name">
              {s.storeNameHint || "（未命名）"} <span className={`badge status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
            </div>
            <div className="muted small">
              {SOURCE_LABEL[s.source]} ‧ {s.submitterName} ‧ {new Date(s.createdAt).toLocaleString("zh-TW")}
              {" ‧ "}
              {(s.editedResult as { items?: unknown[] } | null)?.items?.length ?? 0} 個品項
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
