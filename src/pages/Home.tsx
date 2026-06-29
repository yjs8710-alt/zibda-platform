import { useEffect } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

const Home = () => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.time("Home:firstRender");
      requestAnimationFrame(() => {
        console.timeEnd("Home:firstRender");
      });
    }
  }, []);

  return (
    <div className="h-screen md:h-auto md:min-h-screen flex flex-col relative overflow-hidden md:overflow-visible">
      <Header />

      <main className="flex-1 overflow-hidden md:overflow-visible">
        <HeroSection />
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default Home;