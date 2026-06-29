import { TrendingUp, Zap, ShieldCheck, HeadphonesIcon } from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "실시간 매물 업데이트",
    desc: "하루 수백 건의 신규 공실이 등록됩니다. 가장 빠르게 공실 정보를 확인하세요.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Zap,
    title: "간편 직접 등록",
    desc: "중개사 없이도 직접 공실을 등록하고 임차인을 빠르게 찾을 수 있습니다.",
    color: "text-accent",
    bg: "bg-orange-50",
  },
  {
    icon: ShieldCheck,
    title: "허위매물 NO",
    desc: "등록된 모든 매물은 검증 절차를 거쳐 허위매물을 방지합니다.",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: HeadphonesIcon,
    title: "전문 상담 연결",
    desc: "전문 중개사와 바로 연결하여 궁금한 점을 빠르게 해결하세요.",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-16 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground">왜 집다인가요?</h2>
          <p className="text-muted-foreground mt-2 text-sm">빠르고 정확한 공실 매물 플랫폼</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="font-bold text-foreground mb-2 text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
