import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { FileText, ListChecks, Building2, AlertTriangle, Home, Handshake, Shield, Clock, Mail } from "lucide-react";

const ARTICLES = [
  {
    icon: FileText,
    title: "제1조 목적",
    content:
      "본 약관은 집다(ZIBDA)가 제공하는 부동산 정보 서비스의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.",
  },
  {
    icon: ListChecks,
    title: "제2조 서비스의 내용",
    content: (
      <>
        <p className="mb-2">회사는 다음의 서비스를 제공합니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>부동산 정보 제공</li>
          <li>매물 등록 서비스</li>
          <li>공실 정보 제공</li>
          <li>협력 공인중개사 연결 서비스</li>
          <li>기타 회사가 정하는 서비스</li>
        </ul>
      </>
    ),
  },
  {
    icon: Building2,
    title: "제3조 회사의 지위",
    content: (
      <div className="space-y-2 text-sm">
        <p>집다(ZIBDA)는 부동산 정보 제공 플랫폼입니다.</p>
        <p>회사는 직접 부동산 거래의 당사자가 아니며 등록된 매물 정보의 정확성, 권리관계, 거래조건 등을 보증하지 않습니다.</p>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: "제4조 이용자의 의무",
    content: (
      <>
        <p className="mb-2">이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>허위 정보 등록</li>
          <li>타인의 개인정보 도용</li>
          <li>법령 위반 행위</li>
          <li>서비스 운영 방해 행위</li>
        </ul>
      </>
    ),
  },
  {
    icon: Home,
    title: "제5조 매물 정보",
    content: (
      <div className="space-y-2 text-sm">
        <p>매물 정보는 등록자 또는 정보 제공자가 제공한 자료를 기반으로 합니다.</p>
        <p>회사는 등록된 정보의 정확성이나 최신성을 보증하지 않습니다.</p>
      </div>
    ),
  },
  {
    icon: Handshake,
    title: "제6조 협력 공인중개사 안내",
    content: (
      <div className="space-y-2 text-sm">
        <p>집다는 이용자의 편의를 위해 협력 공인중개사 연결 서비스를 제공할 수 있습니다.</p>
        <p>실제 중개행위는 공인중개사법에 따라 등록된 공인중개사가 수행합니다.</p>
      </div>
    ),
  },
  {
    icon: Shield,
    title: "제7조 책임의 제한",
    content: (
      <>
        <p className="mb-2">회사는 다음 각 호의 경우 책임을 부담하지 않습니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>이용자 간 거래로 발생한 분쟁</li>
          <li>등록 정보 오류 또는 누락</li>
          <li>천재지변 또는 불가항력</li>
          <li>이용자의 귀책사유로 인한 손해</li>
        </ul>
      </>
    ),
  },
  {
    icon: Clock,
    title: "제8조 약관의 변경",
    content:
      "회사는 관련 법령 범위 내에서 본 약관을 변경할 수 있으며 변경 시 홈페이지를 통해 공지합니다.",
  },
  {
    icon: Mail,
    title: "제9조 문의",
    content: (
      <div className="space-y-2 text-sm">
        <p><span className="font-medium">상호</span> : 집다(ZIBDA)</p>
        <p><span className="font-medium">대표자</span> : 윤재성</p>
        <p><span className="font-medium">사업자등록번호</span> : 797-77-00616</p>
        <p>
          <span className="font-medium">이메일</span> :{" "}
          <a href="mailto:zibda77@naver.com" className="hover:underline" style={{ color: "hsl(var(--primary))" }}>
            zibda77@naver.com
          </a>
        </p>
        <p><span className="font-medium">시행일</span> : 2026년 06월 19일</p>
      </div>
    ),
  },
];

const TermsOfService = () => {
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
            <FileText className="w-10 h-10 mx-auto mb-4 text-white/70" />
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">이용약관</h1>
            <p className="text-lg md:text-xl text-white/80 font-medium">
              집다(ZIBDA) 서비스 이용을 위한 약관입니다.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16 space-y-8">
          {ARTICLES.map((article) => (
            <div
              key={article.title}
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
                  <article.icon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold" style={{ color: "hsl(var(--primary))" }}>
                  {article.title}
                </h2>
              </div>
              <div className="pl-11 text-sm leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                {article.content}
              </div>
            </div>
          ))}
        </section>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

    </div>
  );
};

export default TermsOfService;
