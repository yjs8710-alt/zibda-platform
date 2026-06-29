import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // 이메일 링크에서 type=recovery 확인
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Supabase auth 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!password) {
      setError("새 비밀번호를 입력해 주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || "비밀번호 변경에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setDone(true);
  };

  if (!isRecovery) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "hsl(var(--background))" }}
      >
        <header
          className="sticky top-0 z-50 border-b"
          style={{ background: "hsl(var(--header-bg))", borderColor: "hsl(var(--header-border))" }}
        >
          <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
            <div
              className="flex items-center gap-1.5 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{ background: "hsl(var(--accent))" }}
              >
                <Home className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-extrabold text-white tracking-tight">집다</span>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-md p-8 text-center flex flex-col gap-4">
            <p className="text-foreground font-semibold">유효하지 않은 접근입니다.</p>
            <p className="text-sm text-muted-foreground">비밀번호 찾기 이메일의 링크를 통해서만 접근할 수 있습니다.</p>
            <Button
              className="w-full rounded-full font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              onClick={() => navigate("/forgot-password")}
            >
              비밀번호 찾기로 이동
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div
            className="flex items-center gap-1.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: "hsl(var(--accent))" }}
            >
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-extrabold text-white tracking-tight">집다</span>
          </div>
          <span className="text-sm text-white/60">비밀번호 재설정</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm flex flex-col gap-6">

          {done ? (
            <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col items-center gap-5 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--primary) / 0.08)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">비밀번호가 변경되었습니다</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  새 비밀번호로 로그인해 주세요.
                </p>
              </div>
              <Button
                className="w-full rounded-full font-semibold"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                onClick={() => navigate("/login")}
              >
                로그인하러 가기
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-foreground">새 비밀번호 설정</h1>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    사용할 새 비밀번호를 입력해 주세요.
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-pw">새 비밀번호</Label>
                  <div className="relative">
                    <Input
                      id="new-pw"
                      type={showPw ? "text" : "password"}
                      placeholder="6자 이상 입력"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-pw">비밀번호 확인</Label>
                  <div className="relative">
                    <Input
                      id="confirm-pw"
                      type={showConfirm ? "text" : "password"}
                      placeholder="비밀번호 재입력"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-destructive -mt-1">{error}</p>
                )}

                <Button
                  className="w-full rounded-full font-semibold"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  onClick={handleSubmit}
                  disabled={!password || !confirmPassword || loading}
                >
                  {loading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
