import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  User, Building2, Lock, Users, Trash2, Loader2, Save, Eye, EyeOff, ChevronRight, MessageCircle, Phone, Hash, Star,
} from "lucide-react";
import logoImg from "@/assets/logo-zibda-house.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, formatLicenseNumber } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { MAP_PROPERTIES } from "@/data/mapProperties";

interface AgentProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  agency_phone: string | null;
  agency_name: string;
  license_number: string;
  business_number: string;
  agency_address: string;
  member_type: string;
  status: string;
  is_active: boolean;
  parent_user_id: string | null;
  created_at: string;
}

const MyPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "info";
  const [activeTab, setActiveTab] = useState(initialTab);
  const activityOnly = searchParams.get("view") === "activity";
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) setActiveTab(t);
  }, [searchParams]);
  const { isLoading: authLoading, isAuthorized, user } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyAddress, setAgencyAddress] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Sub-members (for 대표중개사)
  const [subMembers, setSubMembers] = useState<AgentProfile[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // 받은 문의 내역
  type InquiryRow = { id: string; name: string; phone: string; message: string | null; property_reg_no: string | null; created_at: string; is_read: boolean };
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);

  // Email
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthorized) {
      navigate("/login");
    }
  }, [authLoading, isAuthorized, navigate]);

  // Fetch profile
  useEffect(() => {
    if (!user?.userId) return;
    (async () => {
      setLoading(true);
      // Get email
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.email) setEmail(authUser.email);

      const { data } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("user_id", user.userId)
        .maybeSingle();

      if (data) {
        setProfile(data as AgentProfile);
        setName(data.name);
        setPhone(data.phone);
        setAgencyPhone((data as any).agency_phone ?? "");
        setAgencyName(data.agency_name);
        setAgencyAddress(data.agency_address);
        setRepresentativeName((data as any).representative_name ?? "");
        setLicenseNumber(data.license_number);
        setBusinessNumber(data.business_number);
      }
      setLoading(false);
    })();
  }, [user?.userId]);

  // Fetch sub-members for 대표중개사
  useEffect(() => {
    if (!profile || profile.member_type !== "대표중개사") return;
    (async () => {
      setLoadingSubs(true);
      const { data } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("parent_user_id", profile.user_id);
      setSubMembers(data ?? []);
      setLoadingSubs(false);
    })();
  }, [profile]);

  // 문의 내역 (일반회원=보낸 문의 / 중개사=받은 문의)
  const isGeneralMember = profile?.member_type === "일반회원";
  const loadInquiries = async () => {
    if (!user?.userId) return;
    setLoadingInquiries(true);
    const column = isGeneralMember ? "user_id" : "agent_user_id";
    const { data } = await supabase
      .from("guest_inquiries")
      .select("id, name, phone, message, property_reg_no, created_at, is_read")
      .eq(column, user.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setInquiries((data ?? []) as InquiryRow[]);
    setLoadingInquiries(false);
  };
  useEffect(() => {
    if (!user?.userId || !profile) return;
    loadInquiries();
    const column = isGeneralMember ? "user_id" : "agent_user_id";
    const ch = supabase
      .channel(`mypage-inquiries-${user.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_inquiries", filter: `${column}=eq.${user.userId}` }, loadInquiries)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.userId, profile?.member_type]);

  const deleteInquiry = async (id: string) => {
    const prev = inquiries;
    setInquiries((p) => p.filter((i) => i.id !== id));
    const { error } = await supabase.from("guest_inquiries").delete().eq("id", id);
    if (error) {
      setInquiries(prev);
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "문의가 삭제되었습니다." });
    }
  };

  const handleSaveAll = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("agent_profiles")
      .update({
        name,
        phone,
        agency_phone: agencyPhone,
        agency_name: agencyName,
        agency_address: agencyAddress,
        representative_name: representativeName,
        license_number: licenseNumber,
        business_number: businessNumber,
      } as any)
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "정보가 저장되었습니다." });
      navigate("/residential");
      // DB에서 최신 데이터 다시 불러오기
      const { data: refreshed } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", profile.id)
        .maybeSingle();
      if (refreshed) {
        setProfile(refreshed as AgentProfile);
        setName(refreshed.name);
        setPhone(refreshed.phone);
        setAgencyPhone((refreshed as any).agency_phone ?? "");
        setAgencyName(refreshed.agency_name);
        setAgencyAddress(refreshed.agency_address);
        setRepresentativeName((refreshed as any).representative_name ?? "");
        setLicenseNumber(refreshed.license_number);
        setBusinessNumber(refreshed.business_number);
      }
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "비밀번호는 6자 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "새 비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "비밀번호 변경 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "비밀번호가 변경되었습니다." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteSubMember = async (sub: AgentProfile) => {
    if (!confirm(`${sub.name} 회원을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;

    // Deactivate & disassociate
    const { error } = await supabase
      .from("agent_profiles")
      .update({ is_active: false, parent_user_id: null, status: "rejected" })
      .eq("id", sub.id);

    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${sub.name} 회원이 삭제되었습니다.` });
      setSubMembers((prev) => prev.filter((m) => m.id !== sub.id));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isRepresentative = profile?.member_type === "대표중개사";
  const visibleTabs = activityOnly && isGeneralMember
    ? ["inquiries", "favorites"]
    : ["info", "password", "inquiries", ...(isGeneralMember ? ["favorites"] : []), ...(isRepresentative ? ["members"] : [])];
  const tabCount = visibleTabs.length;

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={logoImg} alt="집다 로고" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">마이페이지</h1>
            <p className="text-xs text-muted-foreground">
              {profile?.member_type ?? "회원"} · {profile?.name}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams(activityOnly ? { view: "activity", tab: v } : { tab: v }, { replace: true }); }} className="space-y-4">
          <TabsList className="grid w-full h-auto" style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
            {visibleTabs.includes("info") && <TabsTrigger value="info" className="text-sm md:text-base font-bold gap-1.5 py-2.5">
              <User className="w-4 h-4" /> 내 정보
            </TabsTrigger>}
            {visibleTabs.includes("password") && <TabsTrigger value="password" className="text-sm md:text-base font-bold gap-1.5 py-2.5">
              <Lock className="w-4 h-4" /> 비밀번호
            </TabsTrigger>}
            {visibleTabs.includes("inquiries") && <TabsTrigger value="inquiries" className="text-sm md:text-base font-bold gap-1.5 py-2.5 relative">
              <MessageCircle className="w-4 h-4" /> 문의내역
              {inquiries.filter((i) => !i.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground">
                  {inquiries.filter((i) => !i.is_read).length}
                </span>
              )}
            </TabsTrigger>}
            {visibleTabs.includes("favorites") && (
              <TabsTrigger value="favorites" className="text-sm md:text-base font-bold gap-1.5 py-2.5">
                <Star className="w-4 h-4" /> 관심목록
              </TabsTrigger>
            )}
            {visibleTabs.includes("members") && (
              <TabsTrigger value="members" className="text-sm md:text-base font-bold gap-1.5 py-2.5">
                <Users className="w-4 h-4" /> 회원관리
              </TabsTrigger>
            )}
          </TabsList>



          {/* ─── 내 정보 ─── */}
          {visibleTabs.includes("info") && <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">회원/사업자 정보</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* 2-column definition list */}
                <div className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  {([
                    [
                      { label: "이름", value: profile?.name ?? "", editable: true, field: "name" as const },
                      { label: "휴대폰 번호", value: phone, editable: true, field: "phone" as const },
                    ],
                    [
                      { label: "대표번호", value: agencyPhone, editable: true, field: "agencyPhone" as const },
                      { label: "이메일", value: email, editable: false },
                    ],
                    [
                      { label: "사업자등록번호", value: businessNumber, editable: true, field: "businessNumber" as const },
                      { label: "중개사무소등록번호", value: licenseNumber, editable: true, field: "licenseNumber" as const },
                    ],
                    [
                      { label: "상호명", value: agencyName, editable: true, field: "agencyName" as const },
                      { label: "대표자", value: representativeName, editable: true, field: "representativeName" as const },
                    ],
                    [
                      { label: "주소(신청용)", value: agencyAddress, editable: true, field: "agencyAddress" as const },
                      null,
                    ],
                    [
                      { label: "회원유형", value: profile?.member_type ?? "", editable: false },
                      null,
                    ],
                  ] as const).map((row, ri) => (
                    <div
                      key={ri}
                      className="grid grid-cols-1 md:grid-cols-2 border-b last:border-b-0"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      {row.map((cell, ci) =>
                        cell ? (
                          <div
                            key={ci}
                            className={`px-5 py-3 ${ci === 0 && row[1] ? "md:border-r" : ""}`}
                            style={{ borderColor: "hsl(var(--border))" }}
                          >
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{cell.label}</p>
                            {cell.editable && cell.field ? (
                              <Input
                                value={
                                  cell.field === "name" ? name
                                    : cell.field === "phone" ? phone
                                    : cell.field === "agencyPhone" ? agencyPhone
                                    : cell.field === "businessNumber" ? businessNumber
                                    : cell.field === "licenseNumber" ? licenseNumber
                                    : cell.field === "agencyName" ? agencyName
                                    : cell.field === "representativeName" ? representativeName
                                    : agencyAddress
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (cell.field === "name") setName(v);
                                   else if (cell.field === "phone") setPhone(formatPhone(v));
                                   else if (cell.field === "agencyPhone") setAgencyPhone(formatPhone(v));
                                  else if (cell.field === "businessNumber") setBusinessNumber(v);
                                  else if (cell.field === "licenseNumber") setLicenseNumber(formatLicenseNumber(v));
                                  else if (cell.field === "agencyName") setAgencyName(v);
                                  else if (cell.field === "representativeName") setRepresentativeName(v);
                                  else setAgencyAddress(v);
                                }}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <p className="text-sm text-foreground">{cell.value || "—"}</p>
                            )}
                          </div>
                        ) : (
                          <div key={ci} className="hidden md:block" />
                        )
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end p-4">
                  <Button size="sm" onClick={handleSaveAll} disabled={saving} className="text-xs gap-1">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ─── 비밀번호 변경 ─── */}
          {visibleTabs.includes("password") && <TabsContent value="password">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  비밀번호 변경
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6자 이상"
                      className="text-sm pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">새 비밀번호 확인</Label>
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="text-xs gap-1"
                  >
                    {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    비밀번호 변경
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ─── 문의 내역 ─── */}
          {visibleTabs.includes("inquiries") && <TabsContent value="inquiries">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  문의 내역
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {inquiries.length}건
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => navigate("/chat")}
                  className="w-full mb-3 h-10 rounded-lg text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" }}
                >
                  <MessageCircle className="w-4 h-4" /> 채팅 문의 내역 보기
                </button>
                {loadingInquiries ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : inquiries.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">{isGeneralMember ? "보낸 문의가 없습니다." : "받은 문의가 없습니다."}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inquiries.map((i) => (
                      <div
                        key={i.id}
                        className={`p-3 rounded-lg border ${!i.is_read ? "bg-primary/[0.04] border-primary/30" : "border-border"}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {!i.is_read && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">NEW</span>
                          )}
                          {i.property_reg_no && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              <Hash className="w-2.5 h-2.5" />NO.{i.property_reg_no}
                            </span>
                          )}
                          <span className="text-sm font-bold text-foreground">{i.name}</span>
                          <a
                            href={`tel:${i.phone.replace(/[^0-9]/g, "")}`}
                            className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary"
                          >
                            <Phone className="w-3 h-3" /> {i.phone}
                          </a>
                        </div>
                        {i.message && (
                          <p className="text-xs text-foreground bg-muted/40 rounded px-2 py-1.5 whitespace-pre-wrap line-clamp-3">
                            {i.message}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(i.created_at).toLocaleString("ko-KR")}
                          </span>
                          <div className="flex items-center gap-1">
                            {!isGeneralMember && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => navigate(`/notifications?inquiry=${i.id}`)}
                              >
                                상세
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteInquiry(i.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}


          {/* ─── 관심목록 (일반회원 전용) ─── */}
          {visibleTabs.includes("favorites") && (
            <TabsContent value="favorites">
              <FavoritesPanel onGo={() => navigate("/residential")} />
            </TabsContent>
          )}

          {/* ─── 회원관리 (대표중개사 전용) ─── */}
          {visibleTabs.includes("members") && (
            <TabsContent value="members">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    하부 회원 관리
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {subMembers.length}명
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSubs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : subMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">등록된 하부 회원이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subMembers.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 p-3 rounded-lg border"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                            style={{ background: "hsl(var(--accent))" }}
                          >
                            {sub.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{sub.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {sub.member_type}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: sub.is_active ? "hsl(142 76% 36% / 0.1)" : "hsl(0 84% 60% / 0.1)",
                                  color: sub.is_active ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)",
                                }}
                              >
                                {sub.is_active ? "활성" : "비활성"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{sub.phone} · {sub.agency_name}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            onClick={() => handleDeleteSubMember(sub)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

// ─── 관심목록 패널 ───────────────────────────────────────────────────────
const FavoritesPanel = ({ onGo }: { onGo: () => void }) => {
  const { favorites, toggleFavorite, clearFavorites } = useFavorites();
  const navigate = useNavigate();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // 관심목록 키 목록 가져오기 (string 변환)
  const favoriteSignature = Array.from(favorites).map(String).sort().join("|");
  const keys = useMemo(() => {
    if (!favoriteSignature) return [];
    return favoriteSignature.split("|").filter(Boolean);
  }, [favoriteSignature]);

  // MAP_PROPERTIES (mock) 매칭
  const mockItems = useMemo(
    () => MAP_PROPERTIES.filter((p) => keys.includes(String(p.id))),
    [keys]
  );

  // DB 매물 매칭 (uuid 또는 reg_no)
  const [dbItems, setDbItems] = useState<any[]>([]);
  useEffect(() => {
    const uuidLike = keys.filter((k) => /^[0-9a-f-]{32,}$/i.test(k));
    const regNoLike = keys.filter((k) => /^\d+$/.test(k) && k.length > 4);
    const numericIds = keys.filter((k) => /^\d+$/.test(k)).map((k) => Number(k));
    const stableNumericId = (uuid: string, fallbackIdx: number) => {
      if (!uuid) return 100000 + fallbackIdx;
      let h = 5381;
      for (let i = 0; i < uuid.length; i++) h = ((h << 5) + h + uuid.charCodeAt(i)) | 0;
      return 100000 + (Math.abs(h) % 2000000000);
    };
    if (uuidLike.length === 0 && regNoLike.length === 0 && numericIds.length === 0) { setDbItems([]); return; }
    (async () => {
      const all: any[] = [];
      if (uuidLike.length) {
        const { data } = await supabase
          .from("properties")
          .select("id, reg_no, title, building_name, address, type, deposit, monthly, images, dong, lot_number, status")
          .in("id", uuidLike)
          .eq("status", "active");
        if (data) all.push(...data);
      }
      if (regNoLike.length) {
        const { data } = await supabase
          .from("properties")
          .select("id, reg_no, title, building_name, address, type, deposit, monthly, images, dong, lot_number, status")
          .in("reg_no", regNoLike)
          .eq("status", "active");
        if (data) all.push(...data);
      }
      if (numericIds.length) {
        const { data } = await supabase
          .from("properties")
          .select("id, reg_no, title, building_name, address, type, deposit, monthly, images, dong, lot_number, status")
          .eq("status", "active")
          .order("checked_date", { ascending: false, nullsFirst: false })
          .order("registered_date", { ascending: false })
          .limit(2000);
        if (data) {
          all.push(...data.filter((p, idx) => numericIds.includes(stableNumericId(String(p.id ?? ""), idx))));
        }
      }
      // dedupe by id
      const seen = new Set<string>();
      setDbItems(all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))));
    })();
  }, [keys]);

  const visibleMockItems = mockItems.filter((p) => !dbItems.some((d) => String(d.id) === String((p as any).dbId) || String(d.reg_no) === String((p as any).regNo)));
  const totalCount = visibleMockItems.length + dbItems.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
          관심 매물 목록
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {totalCount}건 · 자동 저장됨
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="text-center py-10">
            <Star className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              아직 관심 매물이 없습니다.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              매물 카드의 별(★) 버튼을 누르면 자동으로 저장됩니다.
            </p>
            <Button size="sm" onClick={onGo} className="text-xs">
              매물 둘러보기
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => setConfirmClearOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 전체 비우기
              </Button>
            </div>
            <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>관심목록을 전부 비우시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription className="sr-only">
                    저장된 모든 관심 매물이 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
                  <AlertDialogCancel className="flex-1 m-0 bg-gradient-to-r from-slate-200 to-slate-300 hover:from-slate-300 hover:to-slate-400 text-slate-800 border-0">
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    onClick={() => clearFavorites()}
                  >
                    확인
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="space-y-2">
              {dbItems.map((p) => {
                const addr = p.address || [p.dong, p.lot_number].filter(Boolean).join(" ");
                return (
                  <div
                    key={`db-${p.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30"
                    style={{ borderColor: "hsl(var(--border))" }}
                    onClick={() => navigate(`/share/${p.id}`)}
                  >
                    <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                      {p.images?.[0] && (
                        <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">
                          {p.type || "매물"} {p.reg_no ? `· NO.${parseInt(String(p.reg_no), 10)}` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{addr || "주소 정보 없음"}</p>
                      {(p.deposit || p.monthly) && (
                        <p className="text-xs font-semibold text-primary mt-0.5">
                          {p.deposit} / {p.monthly}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-yellow-500 hover:bg-yellow-500/10"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(p.reg_no || p.id); }}
                      title="관심목록에서 제거"
                    >
                      <Star className="w-4 h-4" fill="currentColor" />
                    </Button>
                  </div>
                );
              })}
              {visibleMockItems.map((p: any) => {
                const addr = [p.dong, p.lotNumber, p.buildingName].filter(Boolean).join(" ");
                return (
                  <div
                    key={`mock-${p.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                      {p.images?.[0] && (
                        <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">
                          {p.propertyType || "매물"} · {p.dealType || ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{addr || "주소 정보 없음"}</p>
                      {(p.price || p.deposit) && (
                        <p className="text-xs font-semibold text-primary mt-0.5">
                          {p.price ?? p.deposit}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-yellow-500 hover:bg-yellow-500/10"
                      onClick={() => toggleFavorite(p.id)}
                      title="관심목록에서 제거"
                    >
                      <Star className="w-4 h-4" fill="currentColor" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MyPage;
