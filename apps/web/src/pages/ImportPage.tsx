import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuDraft } from "@lunch/shared";
import { ErrorBox } from "../components/ErrorBox";
import { MenuDraftEditor } from "../components/MenuDraftEditor";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

/** 不經 AI：貼上純文字或 JSON → 草稿 → 送審 / 直接上架 */
export function ImportPage() {
  const { isAdmin } = useMe();
  const nav = useNavigate();
  const template = useQuery({ queryKey: ["template"], queryFn: api.template });
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<MenuDraft | null>(null);

  const parse = useMutation({ mutationFn: () => api.parseText(text), onSuccess: (r) => setDraft(r.draft) });
  const submit = useMutation({
    mutationFn: () => api.createSubmission({ source: "format", draft: draft!, imagePaths: [] }),
    onSuccess: (s) => nav(`/submissions/${s.id}`)
  });
  const applyNow = useMutation({ mutationFn: () => api.applyDraft(draft!), onSuccess: (s) => nav(`/stores/${s.id}`) });

  return (
    <div className="stack">
      <h2>格式匯入</h2>
      {!draft && (
        <div className="card stack">
          <p className="muted small">
            每行一個品項「名稱 價格」，用 <code>[分類]</code> 分組，開頭可寫「店名:」「電話:」「地址:」「備註:」；也可直接貼 JSON。
          </p>
          <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={template.data?.text} spellCheck={false} />
          <div className="actions">
            <button className="btn btn-primary" onClick={() => parse.mutate()} disabled={!text.trim() || parse.isPending}>
              解析
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => template.data && setText(template.data.text)}>
              填入範本
            </button>
          </div>
          <ErrorBox error={parse.error} />
        </div>
      )}
      {draft && (
        <div className="card stack">
          <MenuDraftEditor draft={draft} onChange={setDraft} />
          <div className="actions">
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => applyNow.mutate()} disabled={applyNow.isPending}>
                直接上架（同名店家整份取代）
              </button>
            )}
            <button className={`btn ${isAdmin ? "" : "btn-primary"}`} onClick={() => submit.mutate()} disabled={submit.isPending}>
              送出給 admin 審核
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              回到文字
            </button>
          </div>
          <ErrorBox error={submit.error ?? applyNow.error} />
        </div>
      )}
    </div>
  );
}
