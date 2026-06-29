import { useNavigate } from "react-router-dom";

import Footer from "@/components/Footer";
import { Building2, MapPin, Phone, Mail, User, FileText } from "lucide-react";

const SERVICES = [
  "부동산 매물 정보 제공",
  "상가·사무실·주택 공실 정보 제공",
  "매물 등록 서비스",
  "협력 공인중개사 연결 서비스",
  "지역 부동산 정보 제공",
];

const CompanyIntroduction = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              집다<span className="text-white/60 font-light">(ZIBDA)</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 font-medium">
              집을 찾다, 사람을 잇다
            </p>
          </div>
        </section>

        {/* About */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4" style={{ color: "hsl(var(--primary))" }}>
                플랫폼 소개
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                집다(ZIBDA)는 부동산 정보 제공 플랫폼으로 공인중개사,고객을 연결하는 온라인 서비스입니다.
              </p>
              <p className="text-sm leading-relaxed mt-3" style={{ color: "hsl(var(--foreground))" }}>
                사용자가 보다 쉽고 편리하게 부동산 정보를 확인하고 문의할 수 있도록 다양한 매물 정보와 지역 부동산 정보를 제공합니다.
              </p>
              <p className="text-sm leading-relaxed mt-3" style={{ color: "hsl(var(--foreground))" }}>
                집다는 실제 현장에서 수집된 정보를 기반으로 신뢰할 수 있는 부동산 정보 서비스를 제공하는 것을 목표로 합니다.
              </p>
            </div>

            {/* Services */}
            <div>
              <h2 className="text-xl font-bold mb-5" style={{ color: "hsl(var(--primary))" }}>
                주요 서비스
              </h2>
              <div className="grid gap-3">
                {SERVICES.map((service) => (
                  <div
                    key={service}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {service}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Company Info */}
            <div>
              <h2 className="text-xl font-bold mb-5" style={{ color: "hsl(var(--primary))" }}>
                회사 정보
              </h2>
              <div
                className="rounded-lg p-5 space-y-4"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                  <div>
                    <span className="text-xs font-semibold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>상호</span>
                    <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>집다(ZIBDA)</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                  <div>
                    <span className="text-xs font-semibold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>대표자</span>
                    <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>윤재성</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                  <div>
                    <span className="text-xs font-semibold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>사업자등록번호</span>
                    <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>797-77-00616</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                  <div>
                    <span className="text-xs font-semibold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>주소</span>
                    <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
                      충청북도 청주시 서원구 남이면 저산척북로 636-10, 106동 510호
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                  <div>
                    <span className="text-xs font-semibold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>이메일</span>
                    <a
                      href="mailto:zibda77@naver.com"
                      className="text-sm hover:underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      zibda77@naver.com
                    </a>
                  </div>
                </div>
              </div>
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

export default CompanyIntroduction;
