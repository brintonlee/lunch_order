import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export function useMe() {
  const q = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: 60_000 });
  return {
    me: q.data?.user ?? null,
    features: q.data?.features ?? { devLogin: false, aiProvider: "none", discordBot: false },
    isAdmin: q.data?.user?.role === "admin",
    isLoading: q.isLoading
  };
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
