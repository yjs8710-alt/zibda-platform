import { useNavigate } from "react-router-dom";

import Footer from "@/components/Footer";
import { Headphones, Mail, MessageSquare, AlertCircle, Building2, HelpCircle, FileQuestion } from "lucide-react";

const INQUIRY_TYPES = [
  "매물 등록 문의",
  "광고 문의",
  "협력 공인중개사 제휴 문의",
  "서비스 이용 문의",
  "오류 신고",
  "기타 문의",
];

const CustomerService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col pb-36 md:pb-0" style={{ background: "hsl(var(--background))" }}>
      <main className="flex-1">
        {/* Hero */}
        <section
          className="relative py-16 md:py-24 px-4 text-center"
          style={{ background: "hsl(var(--header-bg))" }}
        >
          <div className="max-w-3xl mx-auto">
            <Headphones className="w-10 h-10 mx-auto mb-4 text-white/70" />
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              고객센터
            </h1>
            <p className="text-lg md:text-xl text-white/80 font-medium">
              집다(ZIBDA) 이용 중 문의사항이 있으시면 아래 연락처로 문의해 주시기 바랍니다.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16 space-y-8">
          {/* Email */}
          <div
            className="rounded-lg p-5 md:p-6 space-y-4"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(var(--primary))" }}
              >
                <Mail className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold" style={{ color: "hsl(var(--primary))" }}>
                이메일
              </h2>
            </div>
            <div className="pl-11">
              <a
                href="mailto:zibda77@naver.com"
                className="text-sm hover:underline"
                style={{ color: "hsl(var(--primary))" }}
              >
                zibda77@naver.com
              </a>
            </div>
          </div>

          {/* Inquiry Types */}
          <div
            className="rounded-lg p-5 md:p-6 space-y-4"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(var(--primary))" }}
              >
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold" style={{ color: "hsl(var(--primary))" }}>
                문의 내용
              </h2>
            </div>
            <div className="pl-11">
              <ul className="list-disc list-inside text-sm space-y-1" style={{ color: "hsl(var(--foreground))" }}>
                {INQUIRY_TYPES.map((type) => (
                  <li key={type}>{type}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Notice */}
          <div
            className="rounded-lg p-5 md:p-6 space-y-4"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(var(--primary))" }}
              >
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold" style={{ color: "hsl(var(--primary))" }}>
                안내사항
              </h2>
            </div>
            <p className="pl-11 text-sm" style={{ color: "hsl(var(--foreground))" }}>
              접수된 문의는 순차적으로 답변드리고 있습니다.
            </p>
          </div>
        </section>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

    </div>
  );
};

export default CustomerService;
