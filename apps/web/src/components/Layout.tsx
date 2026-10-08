import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../lib/api";
import { useInvalidateMe, useMe } from "../lib/useMe";

export function Layout({ children }: { children: ReactNode }) {
  const { me, isAdmin } = useMe();
  const invalidate = useInvalidateMe();
  const logout = async () => {
    await api.logout();
    await invalidate();
  };
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          🍱 午餐團購
        </NavLink>
        <nav className="nav">
          <NavLink to="/">進行中</NavLink>
          <NavLink to="/stores">店家</NavLink>
          <NavLink to="/submit">推薦菜單</NavLink>
          <NavLink to="/import">格式匯入</NavLink>
          <NavLink to="/submissions">{isAdmin ? "待審核" : "我的投稿"}</NavLink>
          {isAdmin && <NavLink to="/users">成員</NavLink>}
        </nav>
        <div className="user">
          {me?.avatarUrl && <img src={me.avatarUrl} alt="" className="avatar" />}
          <span>
            {me?.displayName}
            {isAdmin && <span className="badge">admin</span>}
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            登出
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
