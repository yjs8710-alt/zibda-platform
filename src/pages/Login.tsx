import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Eye, EyeOff, Clock, XCircle, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo-zibda-active-20260427-v4.png";
import houseIcon from "@/assets/logo-zibda-house.png";

type ApprovalStatus = "approved" | "pending" | "rejected" | null;

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");

    // 1. 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      setLoading(false);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    // 2. 관리자 여부 먼저 확인 (관리자는 agent_profiles 없어도 로그인 허용)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      setLoading(false);
      navigate("/admin");
      return;
    }

    // 3. 일반 중개사: agent_profiles 에서 승인 상태 + 접속 차단 여부 확인
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("status, is_active")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    setLoading(false);

    if (!profile) {
      await supabase.auth.signOut();
      setError("가입 신청 정보를 찾을 수 없습니다. 회원가입을 먼저 완료해 주세요.");
      return;
    }

    // 접속 차단된 계정
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      setError("관리자에 의해 접속이 차단된 계정입니다. 관리자에게 문의해 주세요.");
      return;
    }

    if (profile.status === "approved") {
      navigate("/residential");
    } else {
      await supabase.auth.signOut();
      setApprovalStatus(profile.status as ApprovalStatus);
    }
  };

  // ── 심사 대기 / 거절 안내 화면 ─────────────────────────────────────────────
  if (approvalStatus === "pending" || approvalStatus === "rejected") {
    const isPending = approvalStatus === "pending";
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "hsl(var(--background))" }}
      >
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          {/* Icon */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
            style={{
              background: isPending
                ? "hsl(var(--chart-4) / 0.12)"
                : "hsl(var(--destructive) / 0.10)",
            }}
          >
            {isPending
              ? <Clock className="w-10 h-10" style={{ color: "hsl(var(--chart-4))" }} />
              : <XCircle className="w-10 h-10" style={{ color: "hsl(var(--destructive))" }} />
            }
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-extrabold text-foreground">
              {isPending ? "심사 대기 중" : "가입이 거절되었습니다"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isPending
                ? <>
                    가입 신청이 접수되었습니다.<br />
                    관리자 심사 후 이메일로 승인 결과를 안내해 드립니다.<br />
                    <span className="font-semibold text-foreground">영업일 기준 1~3일</span> 소요될 수 있습니다.
                  </>
                : <>
                    가입 신청이 승인되지 않았습니다.<br />
                    자세한 사유는 가입 시 등록한 이메일을 확인하거나,<br />
                    고객센터로 문의해 주세요.
                  </>
              }
            </p>
          </div>

          {/* Info card */}
          <div
            className="w-full rounded-2xl p-5 flex flex-col gap-3 text-left"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            {isPending ? (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--chart-2))" }} />
                  <span className="text-sm text-foreground">가입 신청서 접수 완료</span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--chart-4))" }} />
                  <span className="text-sm text-muted-foreground">관리자 서류 검토 중</span>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                  <span className="text-sm text-muted-foreground">이메일로 승인 결과 안내 예정</span>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-sm text-muted-foreground">
                  문의: <strong className="text-foreground">support@jipda.kr</strong>
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 w-full">
            <Button
              className="w-full rounded-full font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              onClick={() => setApprovalStatus(null)}
            >
              로그인으로 돌아가기
            </Button>
            {approvalStatus === "rejected" && (
              <button
                className="text-sm font-semibold hover:underline"
                style={{ color: "hsl(var(--accent))" }}
                onClick={() => navigate("/signup")}
              >
                재신청하기
              </button>
            )}
            <button
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => navigate("/")}
            >
              메인으로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 기본 로그인 폼 ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "hsl(var(--header-bg))", borderColor: "hsl(var(--header-border))" }}
      >
        <div className="w-full pl-0 pr-3 sm:pr-5 md:pr-0">
          <div className="flex items-center h-12">
            <div
              className="flex items-center cursor-pointer select-none flex-shrink-0 -ml-4 sm:-ml-2"
              onClick={() => navigate("/")}
            >
              <img src={logoImg} alt="집다 로고" className="h-24 md:h-20 w-auto object-contain object-left block mt-2" />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* Logo area */}
          <div className="text-center flex flex-col items-center gap-3">
            <img src={houseIcon} alt="집다" className="w-16 h-16 object-contain" />
            <h1 className="text-xl font-extrabold text-foreground">로그인</h1>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">이메일</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-pw">비밀번호</Label>
                <button
                  className="text-xs hover:underline"
                  style={{ color: "hsl(var(--primary))" }}
                  onClick={() => navigate("/forgot-password")}
                  type="button"
                >
                  비밀번호 찾기
                </button>
              </div>
              <div className="relative">
                <Input
                  id="login-pw"
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive -mt-1">{error}</p>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(c) => setRemember(!!c)}
              />
              <label
                htmlFor="remember"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                로그인 상태 유지
              </label>
            </div>

            <Button
              className="w-full rounded-full font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              onClick={handleLogin}
              disabled={!email || !password || loading}
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>

          </div>

          {/* Footer links */}
          <div className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <button
              className="font-semibold hover:underline"
              style={{ color: "#000000" }}
              onClick={() => navigate("/signup")}
            >
              회원가입 신청
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
