import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useMe } from "./lib/useMe";
import { HomePage } from "./pages/HomePage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewPage } from "./pages/ReviewPage";
import { StoreDetailPage } from "./pages/StoreDetailPage";
import { StoresPage } from "./pages/StoresPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { SubmitPage } from "./pages/SubmitPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  const { me, isLoading, isAdmin } = useMe();
  if (isLoading) return <div className="center muted">載入中…</div>;
  if (!me) return <LoginPage />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/stores/:id" element={<StoreDetailPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/submissions" element={<ReviewPage />} />
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="/users" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
