import type { MenuDraft, MenuItemDraft } from "@lunch/shared";

interface Props {
  draft: MenuDraft;
  onChange: (d: MenuDraft) => void;
  readOnly?: boolean;
}

const emptyItem = (): MenuItemDraft => ({ name: "", price: 0, category: "" });

/** 店家資訊 + 品項表格編輯器；AI 低信心 (<0.6) 的品項會以黃底標示 */
export function MenuDraftEditor({ draft, onChange, readOnly }: Props) {
  const setField = <K extends keyof MenuDraft>(k: K, v: MenuDraft[K]) => onChange({ ...draft, [k]: v });
  const setItem = (idx: number, patch: Partial<MenuItemDraft>) =>
    onChange({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const removeItem = (idx: number) => onChange({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  const addItem = () => onChange({ ...draft, items: [...draft.items, emptyItem()] });
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= draft.items.length) return;
    const items = [...draft.items];
    [items[idx], items[j]] = [items[j]!, items[idx]!];
    onChange({ ...draft, items });
  };

  return (
    <div className="draft-editor">
      <div className="grid-2">
        <label>
          店名 *
          <input value={draft.storeName} onChange={(e) => setField("storeName", e.target.value)} readOnly={readOnly} required />
        </label>
        <label>
          電話
          <input value={draft.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} readOnly={readOnly} inputMode="tel" />
        </label>
        <label>
          地址
          <input value={draft.address ?? ""} onChange={(e) => setField("address", e.target.value)} readOnly={readOnly} />
        </label>
        <label>
          備註
          <input value={draft.note ?? ""} onChange={(e) => setField("note", e.target.value)} readOnly={readOnly} />
        </label>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: "28%" }}>分類</th>
            <th>品項 *</th>
            <th style={{ width: 96 }}>價格 *</th>
            {!readOnly && <th style={{ width: 120 }}></th>}
          </tr>
        </thead>
        <tbody>
          {draft.items.map((it, idx) => {
            const low = it.confidence !== undefined && it.confidence < 0.6;
            return (
              <tr key={idx} className={low ? "low-confidence" : undefined} title={low ? `AI 信心度 ${(it.confidence! * 100).toFixed(0)}%，請確認` : undefined}>
                <td>
                  <input value={it.category ?? ""} onChange={(e) => setItem(idx, { category: e.target.value })} readOnly={readOnly} placeholder="（無）" />
                </td>
                <td>
                  <input value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} readOnly={readOnly} required />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={it.price}
                    onChange={(e) => setItem(idx, { price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    readOnly={readOnly}
                    required
                  />
                </td>
                {!readOnly && (
                  <td className="row-actions">
                    <button type="button" className="btn btn-icon" onClick={() => move(idx, -1)} aria-label="上移" disabled={idx === 0}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-icon" onClick={() => move(idx, 1)} aria-label="下移" disabled={idx === draft.items.length - 1}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-icon danger" onClick={() => removeItem(idx)} aria-label="刪除">
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" className="btn" onClick={addItem}>
          ＋ 新增品項
        </button>
      )}
      <p className="muted small">
        共 {draft.items.length} 個品項
        {draft.items.some((i) => i.confidence !== undefined && i.confidence < 0.6) && "，黃底為 AI 不確定的項目，請核對照片"}
      </p>
    </div>
  );
}
