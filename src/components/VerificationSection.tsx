import { CheckCircle2, Search, RefreshCw, Phone } from "lucide-react";

const STEPS = [
  {
    num: "1",
    icon: Search,
    title: "매물 전담팀 조사",
    desc: "전담팀이 소유주에게 직접 연락하여 매물 상태를 인터뷰합니다.",
  },
  {
    num: "2",
    icon: CheckCircle2,
    title: "검증 완료",
    desc: "허위 매물 없이 실제 확인된 정보만 수집·등록합니다.",
  },
  {
    num: "3",
    icon: RefreshCw,
    title: "매물정보 업데이트",
    desc: "계약 완료된 매물은 즉시 삭제하여 최신 정보를 유지합니다.",
  },
  {
    num: "4",
    icon: Phone,
    title: "주기적 재확인",
    desc: "등록된 매물을 주기적으로 재확인하여 정확도를 높입니다.",
  },
];

const VerificationSection = () => {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-3">
            100% 실매물 보장
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-3">
            집다는 왜 <span className="text-primary">백퍼센트 실매물</span>인가요?
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            집다의 모든 매물은 지역별 매물 전담팀이 소유주에게 직접 확인 후 등록됩니다.<br />
            허위매물 없이 검증된 매물만 제공합니다.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="relative flex flex-col items-center text-center group">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] right-[-calc(50%-40px)] h-0.5 bg-border z-0" style={{ width: "calc(100% - 80px)", left: "calc(50% + 40px)" }} />
                )}
                {/* Circle */}
                <div className="relative z-10 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary transition-colors duration-300">
                  <Icon className="w-7 h-7 text-primary group-hover:text-white transition-colors duration-300" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-foreground mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Testimonial chat bubble */}
        <div className="bg-muted/40 rounded-2xl p-6 max-w-2xl mx-auto border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-4">💬 실제 중개사 후기</p>
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <div className="bg-primary/10 text-foreground text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs">
                사장님, 집다 어때요? 여기도 허위매물 많아요?
              </div>
            </div>
            <div className="flex justify-start gap-2 items-end">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-bold flex-shrink-0">중</div>
              <div className="bg-white border border-border text-foreground text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs shadow-sm">
                집다요? 거기는 다 실매물이에요. 직접 소유주한테 연락한 물건정보만 올려서요.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-primary/10 text-foreground text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs">
                임대 놓을 것도 하나 있는데요..
              </div>
            </div>
            <div className="flex justify-start gap-2 items-end">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-bold flex-shrink-0">중</div>
              <div className="bg-white border border-border text-foreground text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs shadow-sm">
                집다에 올려봐요. 허위가 없으니까 문의도 많고, 금방 나가요! 😊
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VerificationSection;
