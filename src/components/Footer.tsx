import { useNavigate } from "react-router-dom";
import { Phone, Mail } from "lucide-react";

const Footer = () => {
  const navigate = useNavigate();
  return (
    <footer className="bg-foreground text-white">
      {/* Footer Bottom */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div>
            <p className="text-sm text-white max-w-sm leading-relaxed">
              청주 부동산 플랫폼
            </p>
            <div className="flex gap-4 mt-4">
              <a href="#" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors">
                <Phone className="w-3.5 h-3.5" /> 1588-0000
              </a>
              <a href="mailto:zibda77@naver.com" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors">
                <Mail className="w-3.5 h-3.5" /> zibda77@naver.com
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <button
              onClick={() => navigate("/company")}
              className="text-white hover:text-white/80 transition-colors text-xs text-left"
            >
              Zibda소개
            </button>
            <button
              onClick={() => navigate("/terms")}
              className="text-white hover:text-white/80 transition-colors text-xs text-left"
            >
              이용약관
            </button>
            <button
              onClick={() => navigate("/privacy")}
              className="text-white hover:text-white/80 transition-colors text-xs text-left"
            >
              개인정보처리방침
            </button>
            <button
              onClick={() => navigate("/support")}
              className="text-white hover:text-white/80 transition-colors text-xs text-left"
            >
              고객센터
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-white/30">© 2024 집다. All rights reserved.</p>
          <p className="text-xs text-white/30">사업자등록번호: 797-77-00616 | 대표: 윤재성</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
