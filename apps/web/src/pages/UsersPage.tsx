import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorBox } from "../components/ErrorBox";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";

export function UsersPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "admin" | "member" }) => api.setRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
  });
  return (
    <div className="stack">
      <h2>成員</h2>
      <p className="muted small">加值與帳本功能在階段 03 加入；這裡先管理角色。</p>
      <ErrorBox error={users.error ?? setRole.error} />
      <table className="card table">
        <thead>
          <tr>
            <th>名稱</th>
            <th>Discord ID</th>
            <th>角色</th>
            <th>餘額</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.data?.map((u) => (
            <tr key={u.id}>
              <td>
                {u.avatarUrl && <img src={u.avatarUrl} className="avatar" alt="" />} {u.displayName}
              </td>
              <td className="mono small">{u.discordId}</td>
              <td>{u.role}</td>
              <td className={u.balance < 0 ? "neg" : ""}>${u.balance}</td>
              <td>
                {u.id !== me?.id && (
                  <button className="btn small" onClick={() => setRole.mutate({ id: u.id, role: u.role === "admin" ? "member" : "admin" })}>
                    {u.role === "admin" ? "降為成員" : "設為 admin"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
