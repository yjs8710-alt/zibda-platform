import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해 주세요.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message || "이메일 발송에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setSent(true);
  };

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
          <span className="text-sm text-white/60">비밀번호 찾기</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm flex flex-col gap-6">

          {sent ? (
            /* ── 전송 완료 ── */
            <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col items-center gap-5 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--primary) / 0.08)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">이메일을 확인해 주세요</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  <strong className="text-foreground">{email}</strong>로<br />
                  비밀번호 재설정 링크를 발송했습니다.<br />
                  이메일을 확인하고 안내에 따라 진행해 주세요.
                </p>
              </div>
              <div
                className="w-full rounded-xl p-3.5 text-xs text-center leading-relaxed"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
              >
                이메일이 오지 않는 경우 스팸 폴더를 확인하거나<br />
                아래 버튼으로 다시 전송해 주세요.
              </div>
              <div className="flex flex-col gap-2.5 w-full">
                <Button
                  className="w-full rounded-full font-semibold"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  onClick={() => { setSent(false); }}
                >
                  다시 전송하기
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => navigate("/login")}
                >
                  로그인으로 돌아가기
                </Button>
              </div>
            </div>
          ) : (
            /* ── 입력 폼 ── */
            <>
              {/* Icon + title */}
              <div className="text-center flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-foreground">비밀번호 찾기</h1>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    가입 시 사용한 이메일을 입력하면<br />
                    비밀번호 재설정 링크를 보내드립니다.
                  </p>
                </div>
              </div>

              {/* Card */}
              <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="forgot-email">가입한 이메일</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}
                </div>

                <Button
                  className="w-full rounded-full font-semibold"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  onClick={handleSubmit}
                  disabled={!email || loading}
                >
                  {loading ? "전송 중..." : "재설정 링크 전송"}
                </Button>

                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => navigate("/login")}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  로그인으로 돌아가기
                </button>
              </div>

              <div
                className="rounded-xl p-3.5 text-xs text-center leading-relaxed"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
              >
                가입한 이메일이 기억나지 않으시면<br />
                관리자에게 문의해 주세요.
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
