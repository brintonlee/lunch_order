import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

export function HomePage() {
  const { me, isAdmin, features } = useMe();
  const stores = useQuery({ queryKey: ["stores"], queryFn: () => api.stores() });
  const pending = useQuery({ queryKey: ["submissions", "pending"], queryFn: () => api.submissions("pending"), enabled: isAdmin });

  return (
    <div className="stack">
      <section className="card">
        <h2>進行中的點餐</h2>
        <p className="muted">目前沒有進行中的團。開團 / 點餐 / 結單功能在下一階段加入（Discord `/new-order`）。</p>
      </section>
      <section className="cards-3">
        <Link to="/stores" className="card stat">
          <div className="stat-value">{stores.data?.length ?? "–"}</div>
          <div className="stat-label">已上架店家</div>
        </Link>
        {isAdmin && (
          <Link to="/submissions" className="card stat">
            <div className="stat-value">{pending.data?.length ?? "–"}</div>
            <div className="stat-label">待審核投稿</div>
          </Link>
        )}
        <div className="card stat">
          <div className="stat-value">${me?.balance ?? 0}</div>
          <div className="stat-label">我的餘額</div>
        </div>
      </section>
      <section className="card">
        <h3>系統狀態</h3>
        <ul className="plain">
          <li>AI 菜單解析：{features.aiProvider === "none" ? "未設定（可用格式匯入）" : features.aiProvider}</li>
          <li>Discord Bot：{features.discordBot ? "已啟動" : "未啟動"}</li>
        </ul>
      </section>
    </div>
  );
}
