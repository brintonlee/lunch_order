import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuDraft } from "@lunch/shared";
import { ErrorBox } from "../components/ErrorBox";
import { MenuDraftEditor } from "../components/MenuDraftEditor";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

/** 成員推薦菜單：上傳照片 → AI 草稿 → 修正 → 送審（admin 可直接上架） */
export function SubmitPage() {
  const { isAdmin, features } = useMe();
  const nav = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [aiResult, setAiResult] = useState<MenuDraft | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [provider, setProvider] = useState("");

  const parse = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("storeNameHint", hint);
      files.forEach((f) => form.append("images", f));
      return api.parseImages(form);
    },
    onSuccess: (r) => {
      setDraft(r.draft);
      setAiResult(r.draft);
      setImagePaths(r.imagePaths);
      setProvider(r.provider);
    }
  });
  const submit = useMutation({
    mutationFn: () => api.createSubmission({ source: "ai", draft: draft!, aiResult: aiResult ?? undefined, imagePaths }),
    onSuccess: (s) => nav(`/submissions/${s.id}`)
  });
  const applyNow = useMutation({
    mutationFn: () => api.applyDraft(draft!),
    onSuccess: (s) => nav(`/stores/${s.id}`)
  });

  const aiDisabled = features.aiProvider === "none";

  return (
    <div className="stack">
      <h2>推薦菜單</h2>
      {!draft && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            parse.mutate();
          }}
        >
          {aiDisabled && <div className="error-box">尚未設定 AI 供應商，請改用「格式匯入」。</div>}
          <label>
            店名（選填，幫 AI 對焦）
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="例如 八方雲集" />
          </label>
          <label>
            菜單照片（可多張，JPG / PNG / WebP）
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} required />
          </label>
          {files.length > 0 && (
            <div className="thumbs">
              {files.map((f) => (
                <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} />
              ))}
            </div>
          )}
          <button className="btn btn-primary" disabled={parse.isPending || aiDisabled || files.length === 0}>
            {parse.isPending ? "AI 解析中（約 10–30 秒）…" : "用 AI 解析菜單"}
          </button>
          <ErrorBox error={parse.error} />
        </form>
      )}
      {draft && (
        <div className="card stack">
          <p className="muted small">由 {provider} 解析，請核對店名、電話與價格後送出。</p>
          <MenuDraftEditor draft={draft} onChange={setDraft} />
          <div className="actions">
            <button className="btn btn-primary" onClick={() => submit.mutate()} disabled={submit.isPending}>
              送出給 admin 審核
            </button>
            {isAdmin && (
              <button className="btn" onClick={() => applyNow.mutate()} disabled={applyNow.isPending}>
                直接上架（同名店家整份取代）
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              重新上傳
            </button>
          </div>
          <ErrorBox error={submit.error ?? applyNow.error} />
        </div>
      )}
    </div>
  );
}
