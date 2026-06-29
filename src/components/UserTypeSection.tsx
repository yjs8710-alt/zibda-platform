import { Building2, Home, Briefcase } from "lucide-react";

const TYPES = [
  {
    icon: Home,
    label: "임대인 (소유주)",
    badge: "방 내놓기",
    badgeColor: "bg-primary/10 text-primary",
    title: "빠르게 임차인을 찾아드려요",
    desc: "허위매물 없는 플랫폼이라 진성 문의가 많아 빠르게 계약됩니다. 직접 매물을 등록하고 임차인과 연결되세요.",
    cta: "매물 등록하기",
    ctaStyle: "bg-primary text-primary-foreground hover:bg-primary/90",
    features: ["무료 매물 등록", "진성 문의 연결", "계약 빠른 처리"],
  },
  {
    icon: Building2,
    label: "임차인 (세입자)",
    badge: "방 구하기",
    badgeColor: "bg-accent/10 text-accent",
    title: "헛걸음 없는 실매물 검색",
    desc: "이미 계약된 매물, 허위매물 없이 현재 계약 가능한 진짜 매물만 확인하세요. 지도에서 직관적으로 찾을 수 있어요.",
    cta: "매물 검색하기",
    ctaStyle: "bg-accent text-accent-foreground hover:bg-accent/90",
    features: ["100% 실매물 보장", "지도 기반 검색", "상세 조건 필터"],
  },
  {
    icon: Briefcase,
    label: "중개사무소",
    badge: "업무 효율화",
    badgeColor: "bg-purple-100 text-purple-700",
    title: "검증된 매물로 신뢰 상담",
    desc: "실거래가 조회, 지적도, 로드뷰까지 한 곳에서. 고객 상담 시 근거 자료로 활용하고 정확한 정보를 제공하세요.",
    cta: "중개사 서비스",
    ctaStyle: "bg-purple-600 text-white hover:bg-purple-700",
    features: ["실거래가 조회", "주변 시세 분석", "매물 관리 도구"],
  },
];

const UserTypeSection = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
            누구를 위한 서비스인가요?
          </h2>
          <p className="text-muted-foreground text-sm">
            임대인, 임차인, 중개사 모두를 위한 부동산 플랫폼
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.label}
                className="bg-white rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-border hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className="w-6 h-6 text-foreground/70" />
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${type.badgeColor}`}>
                    {type.badge}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{type.label}</p>
                  <h3 className="text-base font-extrabold text-foreground mb-2">{type.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{type.desc}</p>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {type.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-foreground/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button className={`mt-auto w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${type.ctaStyle}`}>
                  {type.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UserTypeSection;
