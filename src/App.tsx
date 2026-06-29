import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Suspense, useEffect } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import Home from "./pages/Home";
import Index from "./pages/Index";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import AgentOnlyRoute from "./components/AgentOnlyRoute";
import ChatInquiryWidget from "./components/ChatInquiryWidget";
import MobileBottomNav from "./components/MobileBottomNav";
import { usePageViewTracker } from "./hooks/usePageViewTracker";
import { useIsGuest } from "./hooks/useIsGuest";
import { useState } from "react";
import { InquiryModal, PartnerAgencyModal, GuestDetailModal, type GuestDetailInfo } from "./components/guest/GuestModals";
import { useExitConfirm } from "./hooks/useExitConfirm";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// 모든 페이지에서 안드로이드/모바일 뒤로가기 → 종료 다이얼로그 활성화
const GlobalExitConfirm = () => {
  const { ExitConfirmDialog } = useExitConfirm(true);
  return <ExitConfirmDialog />;
};

// 게스트(비로그인)는 채팅 위젯 숨김
const AuthGatedChatInquiry = () => {
  const isGuest = useIsGuest();
  const { user } = useAuth();
  const canUseChat = !!user && (user.memberType === "일반회원" || user.isAdmin || user.memberType !== "게스트");
  if (isGuest || !canUseChat) return null;
  return <ChatInquiryWidget />;
};

// 게스트 문의 모달 — 어디서든 window 이벤트로 호출
const GlobalGuestInquiry = () => {
  const { user } = useAuth();
  const isGuest = useIsGuest();
  const [state, setState] = useState<{ open: boolean; detail?: any }>({ open: false });
  const [partner, setPartner] = useState<{ open: boolean; detail?: any }>({ open: false });
  const [detailState, setDetailState] = useState<{ open: boolean; info?: GuestDetailInfo; partnerDetail?: any }>({ open: false });
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (user?.memberType === "일반회원" && user.userId && !detail.memberInfo) {
        try {
          const { data } = await supabase
            .from("agent_profiles")
            .select("name, phone")
            .eq("user_id", user.userId)
            .maybeSingle();
          setState({ open: true, detail: { ...detail, memberInfo: { name: data?.name || "", phone: data?.phone || "" } } });
          return;
        } catch { /* fallback to manual input */ }
      }
      setState({ open: true, detail });
    };
    const partnerHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setPartner({ open: true, detail });
    };
    const detailHandler = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setDetailState({ open: true, info: d.info, partnerDetail: d.partnerDetail });
    };
    window.addEventListener("open-guest-inquiry", handler);
    window.addEventListener("open-guest-partner", partnerHandler);
    window.addEventListener("open-guest-detail", detailHandler);
    return () => {
      window.removeEventListener("open-guest-inquiry", handler);
      window.removeEventListener("open-guest-partner", partnerHandler);
      window.removeEventListener("open-guest-detail", detailHandler);
    };
  }, [user?.memberType, user?.userId]);
  return (
    <>
      <InquiryModal
        open={state.open}
        onClose={() => setState({ open: false })}
        propertyDbId={state.detail?.propertyDbId}
        propertyRegNo={state.detail?.propertyRegNo}
        agentUserId={state.detail?.agentUserId}
        propertyTitle={state.detail?.propertyTitle}
        memberInfo={state.detail?.memberInfo}
      />

      <PartnerAgencyModal
        open={partner.open}
        onClose={() => setPartner({ open: false })}
        agentUserId={partner.detail?.agentUserId}
        propertyId={partner.detail?.propertyDbId}
        propertyTitle={partner.detail?.propertyTitle}
        showChat={!isGuest}
        onChat={() => {
          setState({ open: true, detail: partner.detail });
          setPartner({ open: false });
        }}
      />
      <GuestDetailModal
        open={detailState.open}
        onClose={() => setDetailState({ open: false })}
        info={detailState.info}
        inquiryLabel="문의하기"
        onInquiry={() => {
          setState({ open: true, detail: detailState.partnerDetail });
        }}
      />
    </>
  );
};

// 첫 화면(Home)은 즉시 로딩, 나머지 라우트는 lazy 로딩으로 초기 번들 최소화
const LoginPage = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SignupPage = lazy(() => import("./pages/Signup"));
const Community = lazy(() => import("./pages/Community"));
const ResidentialRental = lazy(() => import("./pages/ResidentialRental"));
const LandSearch = lazy(() => import("./pages/LandSearch"));
const NonResidentialRental = lazy(() => import("./pages/NonResidentialRental"));
const CommercialRental = lazy(() => import("./pages/CommercialRental"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CompanyIntroduction = lazy(() => import("./pages/CompanyIntroduction"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CustomerService = lazy(() => import("./pages/CustomerService"));
const PublicProperty = lazy(() => import("./pages/PublicProperty"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const MyProperties = lazy(() => import("./pages/MyProperties"));
const MyPage = lazy(() => import("./pages/MyPage"));
const MyInfoPage = lazy(() => import("./pages/MyInfoPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient();

const RouteFallback = () => null;


const LegacyPropertyRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/share/${id ?? ""}${location.search}`} replace />;
};

const HomeOrPropertyDetail = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return params.get("propertyId") ? <Index /> : <Home />;
};

const BOMNAL_LICENSE_NO = "43112-2024-00034";

const useGlobalProtect = () => {
  useEffect(() => {
    let cancelled = false;
    let exempt = false;

    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onContext = (e: MouseEvent) => { if (exempt) return; if (!isEditable(e.target)) e.preventDefault(); };
    const onDrag = (e: DragEvent) => { if (exempt) return; e.preventDefault(); };
    const onCopy = (e: ClipboardEvent) => { if (exempt) return; if (!isEditable(e.target)) e.preventDefault(); };

    const applyProtect = (on: boolean) => {
      exempt = !on;
      if (typeof document !== "undefined") {
        document.body.classList.toggle("protect-on", on);
      }
    };

    // 기본은 보호 ON
    applyProtect(true);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("copy", onCopy);

    const checkExempt = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        // 관리자 체크
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleData) { if (!cancelled) applyProtect(false); return; }
        // 봄날부동산 체크
        const { data: ap } = await supabase
          .from("agent_profiles")
          .select("license_number, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && ap?.license_number === BOMNAL_LICENSE_NO && ap?.status === "approved") {
          applyProtect(false);
        }
      } catch { /* ignore */ }
    };
    checkExempt();

    // 로그인/로그아웃 시 재평가
    let unsub: (() => void) | undefined;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = supabase.auth.onAuthStateChange(() => {
        applyProtect(true);
        checkExempt();
      });
      unsub = () => data.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("copy", onCopy);
      document.body.classList.remove("protect-on");
      unsub?.();
    };
  }, []);
};
const PageViewTracker = () => {
  usePageViewTracker();
  return null;
};

const App = () => {
  useGlobalProtect();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PwaUpdatePrompt />
      <BrowserRouter>
        <PageViewTracker />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* 공개 페이지 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/property/:id" element={<LegacyPropertyRedirect />} />
            <Route path="/share/:id" element={<PublicProperty />} />

            {/* 첫 화면은 eager */}
            <Route path="/" element={<HomeOrPropertyDetail />} />
            <Route path="/company" element={<CompanyIntroduction />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/support" element={<CustomerService />} />

            <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
            <Route path="/apartment" element={<ProtectedRoute><ResidentialRental /></ProtectedRoute>} />
            <Route path="/residential" element={<ProtectedRoute><ResidentialRental /></ProtectedRoute>} />
            <Route path="/residential-rent" element={<Navigate to="/residential" replace />} />
            <Route path="/land" element={<ProtectedRoute><LandSearch /></ProtectedRoute>} />
            <Route path="/non-residential" element={<ProtectedRoute><NonResidentialRental /></ProtectedRoute>} />
            <Route path="/collective-sale" element={<ProtectedRoute><NonResidentialRental mode="collective-sale" /></ProtectedRoute>} />
            <Route path="/commercial" element={<ProtectedRoute><CommercialRental /></ProtectedRoute>} />
            <Route path="/my-properties" element={<AgentOnlyRoute><MyProperties /></AgentOnlyRoute>} />
            <Route path="/my-page" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/my-info" element={<AgentOnlyRoute><MyInfoPage /></AgentOnlyRoute>} />


            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

            {/* 관리자 */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <AuthGatedChatInquiry />
          <GlobalGuestInquiry />
          <MobileBottomNav />
          <GlobalExitConfirm />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
