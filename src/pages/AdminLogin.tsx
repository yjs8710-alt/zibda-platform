import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    // 1. Supabase 로그인
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    if (signInError || !signInData.user) {
      setLoading(false);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    // 2. admin 역할 확인
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signInData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("관리자 권한이 없는 계정입니다.");
      return;
    }

    setLoading(false);
    navigate("/admin");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "hsl(var(--primary))" }}
          >
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">이메일</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-pw">비밀번호</Label>
            <div className="relative">
              <Input
                id="admin-pw"
                type={showPw ? "text" : "password"}
                placeholder="비밀번호 입력"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(""); }}
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

          <Button
            className="w-full rounded-full font-semibold mt-1"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            onClick={handleLogin}
            disabled={!email || !pw || loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          관리자 전용 페이지입니다. 일반 회원은{" "}
          <button
            className="font-semibold hover:underline"
            style={{ color: "hsl(var(--accent))" }}
            onClick={() => navigate("/")}
          >
            여기
          </button>
          를 이용하세요.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
