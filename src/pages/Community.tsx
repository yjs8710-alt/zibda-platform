import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, TrendingUp, HelpCircle, Megaphone, Search, Pencil, ThumbsUp, Eye, ChevronRight, X, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지사항", icon: Megaphone },
  { key: "info", label: "정보공유", icon: TrendingUp },
  { key: "qna", label: "Q&A", icon: HelpCircle },
  { key: "free", label: "자유게시판", icon: MessageSquare },
  { key: "improvement", label: "개선사항", icon: TrendingUp },
];

const WRITABLE_CATEGORIES = CATEGORIES.filter((c) => c.key !== "all" && c.key !== "notice");

type Post = {
  id: string;
  category: string;
  category_label: string;
  title: string;
  content: string;
  author_user_id: string | null;
  author_name: string;
  author_agency: string;
  is_admin_post: boolean;
  pinned: boolean;
  views: number;
  likes: number;
  created_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  notice: "hsl(218 88% 22%)",
  info: "hsl(152 60% 40%)",
  qna: "hsl(22 100% 52%)",
  free: "hsl(215 16% 48%)",
  improvement: "hsl(262 80% 50%)",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const authorDisplay = (p: Pick<Post, "is_admin_post" | "author_name" | "author_agency">) => {
  if (p.is_admin_post) return "관리자";
  if (p.author_agency) return `${p.author_name} (${p.author_agency})`;
  return p.author_name || "회원";
};

const Community = () => {
  const navigate = useNavigate();
  const { isAuthorized, user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [showWrite, setShowWrite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [writeCategory, setWriteCategory] = useState(WRITABLE_CATEGORIES[0].key);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setPosts((data ?? []) as Post[]);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const filtered = posts.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = !search || p.title.includes(search) || p.author_name.includes(search) || p.author_agency.includes(search);
    return matchCat && matchSearch;
  });

  const openWrite = () => {
    if (!isAuthorized) {
      navigate("/login");
      return;
    }
    setEditingId(null);
    setWriteCategory(WRITABLE_CATEGORIES[0].key);
    setWriteTitle("");
    setWriteContent("");
    setShowWrite(true);
  };

  const openEdit = (post: Post) => {
    setEditingId(post.id);
    setWriteCategory(post.category);
    setWriteTitle(post.title);
    setWriteContent(post.content);
    setShowWrite(true);
  };

  const submitPost = async () => {
    if (!writeTitle.trim() || !writeContent.trim() || !user) return;
    const cat = WRITABLE_CATEGORIES.find((c) => c.key === writeCategory)!;

    if (editingId) {
      const { error } = await supabase
        .from("community_posts")
        .update({
          category: cat.key,
          category_label: cat.label,
          title: writeTitle.trim(),
          content: writeContent.trim(),
        })
        .eq("id", editingId);
      if (error) {
        toast({ title: "수정 실패", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "게시글이 수정되었습니다." });
    } else {
      let authorName = "";
      let authorAgency = "";
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("name, agency_name")
          .eq("user_id", user.userId)
          .maybeSingle();
        authorName = profile?.name ?? "";
        authorAgency = profile?.agency_name ?? "";
      }
      const { error } = await supabase.from("community_posts").insert({
        category: cat.key,
        category_label: cat.label,
        title: writeTitle.trim(),
        content: writeContent.trim(),
        author_user_id: user.userId,
        author_name: authorName,
        author_agency: authorAgency,
        is_admin_post: isAdmin,
      });
      if (error) {
        toast({ title: "등록 실패", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "게시글이 등록되었습니다." });
    }
    setShowWrite(false);
    setEditingId(null);
    await loadPosts();
  };

  const deletePost = async (post: Post) => {
    if (!confirm("이 게시글을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "삭제되었습니다." });
    setSelectedPost(null);
    await loadPosts();
  };

  const canEdit = (post: Post) => isAdmin || (user && post.author_user_id === user.userId);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-lg mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">커뮤니티</h1>
          </div>
          <Button
            className="gap-1.5 rounded-full font-semibold border"
            style={{
              background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)",
              color: "#fff",
              borderColor: "rgba(255,255,255,0.85)",
              boxShadow: "0 0 0 2px rgba(168,85,247,0.35), 0 0 14px rgba(236,72,153,0.55), 0 0 22px rgba(34,211,238,0.45)",
              textShadow: "0 0 6px rgba(255,255,255,0.6)",
            }}
            onClick={openWrite}
          >
            <Pencil className="w-3.5 h-3.5" />
            글쓰기
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={
                activeCategory === key
                  ? {
                      background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)",
                      color: "#fff",
                      borderColor: "rgba(255,255,255,0.85)",
                      boxShadow: "0 0 0 2px rgba(168,85,247,0.35), 0 0 14px rgba(236,72,153,0.55), 0 0 22px rgba(34,211,238,0.45)",
                      textShadow: "0 0 6px rgba(255,255,255,0.6)",
                    }
                  : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
              }
            >
              {label}
            </button>
          ))}

          <div className="ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="검색어 입력"
                className="pl-8 h-8 text-sm w-48"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {selectedPost ? (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setSelectedPost(null)}
              >
                ← 목록으로
              </button>
              {canEdit(selectedPost) && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(selectedPost)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> 수정
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deletePost(selectedPost)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${CATEGORY_COLORS[selectedPost.category]}18`, color: CATEGORY_COLORS[selectedPost.category] }}
              >
                {selectedPost.category_label}
              </span>
              {selectedPost.pinned && <span className="text-xs font-bold text-destructive">📌 공지</span>}
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{selectedPost.title}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6 pb-4 border-b border-border">
              <span className={selectedPost.is_admin_post ? "font-bold text-primary" : ""}>{authorDisplay(selectedPost)}</span>
              <span>{formatDate(selectedPost.created_at)}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{selectedPost.views}</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{selectedPost.likes}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[80px_1fr_160px_70px_70px] text-xs font-semibold text-muted-foreground bg-muted/50 px-4 py-2.5 border-b border-border">
              <span>분류</span>
              <span>제목</span>
              <span className="text-center">작성자</span>
              <span className="text-center">조회</span>
              <span className="text-center">추천</span>
            </div>
            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">게시글이 없습니다.</div>
            )}
            {filtered.map((post, i) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className={`grid grid-cols-[auto_1fr] md:grid-cols-[80px_1fr_160px_70px_70px] items-center px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
                  i < filtered.length - 1 ? "border-b border-border" : ""
                } ${post.pinned ? "bg-primary/[0.03]" : ""}`}
              >
                <span
                  className="text-xs font-semibold w-fit px-2 py-0.5 rounded-full"
                  style={{ background: `${CATEGORY_COLORS[post.category]}18`, color: CATEGORY_COLORS[post.category] }}
                >
                  {post.category_label}
                </span>
                <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {post.pinned && <span className="text-destructive text-xs font-bold shrink-0">📌</span>}
                    <span className="text-sm font-medium text-foreground truncate">{post.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden md:block" />
                  </div>
                  <span className={`text-xs md:hidden truncate ${post.is_admin_post ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {authorDisplay(post)}
                  </span>
                </div>
                <span className={`hidden md:block text-xs text-center truncate ${post.is_admin_post ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {authorDisplay(post)}
                </span>
                <span className="hidden md:flex items-center justify-center gap-0.5 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />{post.views}
                </span>
                <span className="hidden md:flex items-center justify-center gap-0.5 text-xs text-muted-foreground">
                  <ThumbsUp className="w-3 h-3" />{post.likes}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {showWrite && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowWrite(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-foreground">{editingId ? "게시글 수정" : "게시글 작성"}</h3>
              <button
                onClick={() => setShowWrite(false)}
                className="text-muted-foreground hover:text-foreground"
                style={{ color: "hsl(var(--primary))" }}
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">머리글(분류)</label>
                <div className="flex gap-2 flex-wrap">
                  {WRITABLE_CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setWriteCategory(c.key)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={
                        writeCategory === c.key
                          ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                          : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">제목</label>
                <Input
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">내용</label>
                <Textarea
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  placeholder="내용을 입력하세요"
                  rows={8}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowWrite(false)}>
                취소
              </Button>
              <Button
                onClick={submitPost}
                disabled={!writeTitle.trim() || !writeContent.trim()}
                style={{ background: "hsl(var(--accent))", color: "#fff" }}
              >
                {editingId ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Community;
