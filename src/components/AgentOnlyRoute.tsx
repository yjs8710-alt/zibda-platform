import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * 중개사 전용 라우트.
 * - 게스트(비로그인) → 로그인 페이지로 이동
 * - 일반회원 → 홈으로 이동 (중개사 화면 접근 차단)
 * - 관리자 / 중개사 유형(대표·소속·중개보조원) → 통과
 */
const AgentOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, isAuthorized, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthorized) return <Navigate to="/login" replace />;
  if (user?.memberType === "일반회원") return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default AgentOnlyRoute;
