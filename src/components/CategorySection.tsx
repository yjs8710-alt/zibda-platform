import { Building2, Store, UtensilsCrossed, Factory, Stethoscope, GraduationCap } from "lucide-react";

const CATEGORIES = [
  { icon: Store, label: "상가", count: "4,821", color: "text-orange-500", bg: "bg-orange-50" },
  { icon: Building2, label: "사무실", count: "3,214", color: "text-blue-600", bg: "bg-blue-50" },
  { icon: UtensilsCrossed, label: "식당·카페", count: "1,932", color: "text-red-500", bg: "bg-red-50" },
  { icon: Factory, label: "공장·창고", count: "1,105", color: "text-gray-600", bg: "bg-gray-100" },
  { icon: Stethoscope, label: "병원·의원", count: "645", color: "text-green-600", bg: "bg-green-50" },
  { icon: GraduationCap, label: "학원", count: "713", color: "text-violet-600", bg: "bg-violet-50" },
];

const CategorySection = () => {
  return (
    <section className="bg-card border-y border-border py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-xl font-bold text-foreground mb-6 text-center">업종별 매물 찾기</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {CATEGORIES.map(({ icon: Icon, label, count, color, bg }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer hover:scale-105 transition-transform group"
            >
              <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center group-hover:shadow-md transition-shadow`}>
                <Icon className={`w-7 h-7 ${color}`} />
              </div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{count}건</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
