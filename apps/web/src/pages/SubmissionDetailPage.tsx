import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { menuDraftSchema, type MenuDraft } from "@lunch/shared";
import { ErrorBox } from "../components/ErrorBox";
import { MenuDraftEditor } from "../components/MenuDraftEditor";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

export function SubmissionDetailPage() {
  const id = Number(useParams().id);
  const { isAdmin, me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const sub = useQuery({ queryKey: ["submission", id], queryFn: () => api.submission(id) });
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (sub.data && !draft) {
      const parsed = menuDraftSchema.safeParse(sub.data.editedResult);
      if (parsed.success) setDraft(parsed.data);
    }
  }, [sub.data, draft]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["submission", id] });
    qc.invalidateQueries({ queryKey: ["submissions"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
  };
  const save = useMutation({ mutationFn: () => api.updateSubmission(id, draft!), onSuccess: invalidate });
  const approve = useMutation({
    mutationFn: () => api.approveSubmission(id, draft ?? undefined),
    onSuccess: (r) => {
      invalidate();
      nav(`/stores/${r.storeId}`);
    }
  });
  const reject = useMutation({ mutationFn: () => api.rejectSubmission(id, reason), onSuccess: invalidate });

  if (sub.isLoading) return <p className="muted">載入中…</p>;
  if (sub.error || !sub.data || !draft) return <ErrorBox error={sub.error ?? "找不到投稿"} />;
  const s = sub.data;
  const editable = s.status === "pending" && (isAdmin || s.submittedBy === me?.id);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link to="/submissions" className="muted small">
            ← 投稿列表
          </Link>
          <h2>
            投稿 #{s.id}：{s.storeNameHint} <span className={`badge status-${s.status}`}>{s.status}</span>
          </h2>
          <div className="muted small">
            {s.submitterName} ‧ {new Date(s.createdAt).toLocaleString("zh-TW")} ‧ 來源 {s.source}
            {s.rejectReason && <span> ‧ 退回原因：{s.rejectReason}</span>}
          </div>
        </div>
      </div>
      {s.imageUrls.length > 0 && (
        <div className="card">
          <h3>原始照片</h3>
          <div className="thumbs large">
            {s.imageUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                <img src={u} alt="菜單照片" />
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="card stack">
        <MenuDraftEditor draft={draft} onChange={setDraft} readOnly={!editable} />
        {editable && (
          <div className="actions">
            {isAdmin ? (
              <>
                <button className="btn btn-primary" onClick={() => approve.mutate()} disabled={approve.isPending}>
                  核准並上架（同名店家整份取代）
                </button>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="退回原因（選填）" />
                <button className="btn danger" onClick={() => reject.mutate()} disabled={reject.isPending}>
                  退回
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                儲存修改
              </button>
            )}
          </div>
        )}
        {save.isSuccess && <p className="ok">已儲存</p>}
        <ErrorBox error={save.error ?? approve.error ?? reject.error} />
      </div>
    </div>
  );
}
