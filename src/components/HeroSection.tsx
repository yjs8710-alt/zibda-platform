import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ClipboardList, Search, User } from "lucide-react";
import heroBgMobile from "@/assets/main-bg-mobile.webp";
import heroBg from "@/assets/main-bg-opt.webp";
import heroLogo from "@/assets/logo-zibda-active-opt.webp";
import iconResidential from "@/assets/icon-residential.webp";
import iconCommercial from "@/assets/icon-commercial.webp";
import iconCollective from "@/assets/icon-collective.webp";
import iconLand from "@/assets/icon-land.webp";

const CATEGORIES = [
  { label: "주거·임대", path: "/residential", icon: iconResidential },
  { label: "상업·임대·매매", path: "/non-residential", icon: iconCommercial },
  { label: "집합건물·건물매매", path: "/collective-sale", icon: iconCollective },
  { label: "토지", path: "/land", icon: iconLand },
];

const APP_ACTIONS = [
  { label: "주거임대", path: "/residential", Icon: Search },
  { label: "내 매물", path: "/my-properties", Icon: ClipboardList },
  { label: "마이페이지", path: "/my-page", Icon: User },
];

const HeroSection = () => {
  const navigate = useNavigate();
  const [isAppMode] = useState(false);

  return (
    <section className="relative h-[calc(100vh-64px)] md:min-h-[calc(100vh-64px)] md:h-auto flex items-start md:items-center justify-center overflow-hidden">
      <picture>
        <source media="(max-width: 768px)" srcSet={heroBgMobile} />
        <img
          src={heroBg}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority="high"
          className="absolute inset-0 w-full h-full object-cover object-center md:[filter:contrast(1.35)_brightness(0.85)_saturate(1.1)]"
        />
      </picture>
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: "linear-gradient(to bottom, hsl(var(--header-bg) / 0.55), hsl(var(--header-bg) / 0.25), hsl(var(--header-bg) / 0.55))" }}
      />
      {/* 모바일 하단 흰색 라인 완전 차단 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-56 md:hidden pointer-events-none"
        style={{ background: "linear-gradient(to top, hsl(var(--header-bg)) 0%, hsl(var(--header-bg)) 30%, transparent 100%)" }}
      />

      <div className="relative z-10 w-full flex flex-col items-center text-center gap-3 md:gap-6 px-4 pt-6 md:pt-16 pb-28 md:pb-16">
        {isAppMode && (
          <div className="md:hidden inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-primary/90 px-3 py-1.5 text-xs font-extrabold text-primary-foreground shadow-lg backdrop-blur-md">
            <CheckCircle2 className="h-4 w-4" />
            집다 앱으로 실행 중
          </div>
        )}

        <img
          src={heroLogo}
          alt="집다 로고"
          loading="eager"
          decoding="async"
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority="high"
          width={384}
          height={120}
          className="w-56 md:w-96 opacity-95 drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-md md:max-w-5xl mt-2">
          {CATEGORIES.map(({ label, path, icon }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="group flex flex-col items-center justify-center gap-2 aspect-square md:aspect-[1.35] rounded-2xl border-2 border-white/50 bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-primary transition-all duration-200 shadow-lg"
            >
              <img src={icon} alt={label} loading="eager" decoding="async" width={56} height={56} className="w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]" />
              <span className="text-sm md:text-base font-bold leading-tight px-2">{label}</span>
            </button>
          ))}
        </div>

        {isAppMode && (
          <div className="md:hidden w-full max-w-md rounded-2xl border border-white/25 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
            <div className="grid grid-cols-3 gap-2">
              {APP_ACTIONS.map(({ label, path, Icon }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-white text-primary shadow-sm transition-colors hover:bg-white/90"
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  <span className="text-[11px] font-extrabold leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>

  );
};

export default HeroSection;
