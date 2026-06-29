import { useNavigate } from "react-router-dom";

import Footer from "@/components/Footer";
import { Shield, User, MessageSquare, Clock, Share2, Trash2, Eye, Mail, FileText } from "lucide-react";

const SECTIONS = [
  {
    icon: User,
    title: "제1조 수집하는 개인정보 항목",
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: "hsl(var(--primary))" }}>회원가입 시</h4>
          <ul className="list-disc list-inside text-sm space-y-1" style={{ color: "hsl(var(--foreground))" }}>
            <li>이름</li>
            <li>휴대전화번호</li>
            <li>이메일 주소</li>
            <li>아이디</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: "hsl(var(--primary))" }}>매물 문의 시</h4>
          <ul className="list-disc list-inside text-sm space-y-1" style={{ color: "hsl(var(--foreground))" }}>
            <li>이름</li>
            <li>연락처</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: "hsl(var(--primary))" }}>서비스 이용 과정에서 자동 수집되는 정보</h4>
          <ul className="list-disc list-inside text-sm space-y-1" style={{ color: "hsl(var(--foreground))" }}>
            <li>IP 주소</li>
            <li>쿠키</li>
            <li>접속 로그</li>
            <li>기기 정보</li>
            <li>브라우저 정보</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    icon: FileText,
    title: "제2조 개인정보 수집 및 이용목적",
    content: (
      <ul className="list-disc list-inside text-sm space-y-1" style={{ color: "hsl(var(--foreground))" }}>
        <li>회원 관리</li>
        <li>본인 확인</li>
        <li>고객 문의 응대</li>
        <li>서비스 제공</li>
        <li>협력 공인중개사 연결</li>
        <li>서비스 개선</li>
        <li>부정 이용 방지</li>
      </ul>
    ),
  },
  {
    icon: Clock,
    title: "제3조 개인정보 보유 및 이용기간",
    content: (
      <div className="space-y-3 text-sm" style={{ color: "hsl(var(--foreground))" }}>
        <p>회사는 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
        <p>다만 관련 법령에 따라 다음과 같이 보관할 수 있습니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>계약 또는 청약철회 등에 관한 기록 : 5년</li>
          <li>소비자 불만 또는 분쟁처리에 관한 기록 : 3년</li>
          <li>접속기록 : 3개월</li>
        </ul>
      </div>
    ),
  },
  {
    icon: Share2,
    title: "제4조 개인정보의 제3자 제공",
    content: (
      <div className="space-y-3 text-sm" style={{ color: "hsl(var(--foreground))" }}>
        <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
        <p>다만 이용자가 부동산 문의 또는 상담 요청 시 협력 공인중개사에게 상담을 위한 최소한의 정보가 제공될 수 있습니다.</p>
      </div>
    ),
  },
  {
    icon: Trash2,
    title: "제5조 개인정보의 파기",
    content: (
      <p className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
        개인정보 보유기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 정보를 파기합니다.
      </p>
    ),
  },
  {
    icon: Eye,
    title: "제6조 이용자의 권리",
    content: (
      <p className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
        이용자는 언제든지 개인정보 열람, 정정, 삭제 및 처리정지를 요청할 수 있습니다.
      </p>
    ),
  },
];

const PrivacyPolicy = () => {
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
            <Shield className="w-10 h-10 mx-auto mb-4 text-white/70" />
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              개인정보처리방침
            </h1>
            <p className="text-lg md:text-xl text-white/80 font-medium">
              집다(ZIBDA)는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 권익을 보호하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16 space-y-8">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
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
                  <section.icon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold" style={{ color: "hsl(var(--primary))" }}>
                  {section.title}
                </h2>
              </div>
              <div className="pl-11">{section.content}</div>
            </div>
          ))}

          {/* Contact */}
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
                제7조 개인정보 보호책임자
              </h2>
            </div>
            <div className="pl-11 space-y-2 text-sm" style={{ color: "hsl(var(--foreground))" }}>
              <p><span className="font-medium">상호</span> : 집다(ZIBDA)</p>
              <p><span className="font-medium">대표자</span> : 윤재성</p>
              <p>
                <span className="font-medium">이메일</span> :{" "}
                <a
                  href="mailto:zibda77@naver.com"
                  className="hover:underline"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  zibda77@naver.com
                </a>
              </p>
              <p><span className="font-medium">시행일</span> : 2026년 06월 19일</p>
            </div>
          </div>
        </section>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

    </div>
  );
};

export default PrivacyPolicy;
