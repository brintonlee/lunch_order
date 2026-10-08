import { useState } from "react";
import { api } from "../lib/api";
import { useInvalidateMe, useMe } from "../lib/useMe";
import { ErrorBox } from "../components/ErrorBox";

export function LoginPage() {
  const { features } = useMe();
  const invalidate = useInvalidateMe();
  const [discordId, setDiscordId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<unknown>(null);

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.devLogin(discordId.trim(), displayName.trim() || "測試用戶");
      await invalidate();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="center">
      <div className="card login-card">
        <h1>🍱 午餐團購</h1>
        <p className="muted">用 Discord 帳號登入，點餐與帳本都會對到同一個人。</p>
        <a className="btn btn-primary btn-block" href="/api/auth/discord">
          使用 Discord 登入
        </a>
        {features.devLogin && (
          <form onSubmit={devLogin} className="dev-login">
            <h3>開發登入（DEV_LOGIN=1）</h3>
            <label>
              Discord ID
              <input value={discordId} onChange={(e) => setDiscordId(e.target.value)} required placeholder="例如 123456789" />
            </label>
            <label>
              顯示名稱
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="測試用戶" />
            </label>
            <button className="btn btn-block" type="submit">
              以此身分登入
            </button>
            <ErrorBox error={error} />
          </form>
        )}
      </div>
    </div>
  );
}
