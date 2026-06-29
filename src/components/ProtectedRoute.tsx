// 게스트(비로그인) 사용자도 모든 페이지에 접근 가능하도록 패스스루로 변경
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default ProtectedRoute;
