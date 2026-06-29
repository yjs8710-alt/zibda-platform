import { useState } from "react";
import { SlidersHorizontal, ChevronDown, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropertyCard from "./PropertyCard";
import property1 from "@/assets/property1-v2-20260427.jpg";
import property2 from "@/assets/property2-v2-20260427.jpg";
import property3 from "@/assets/property3-v2-20260427.jpg";
import property4 from "@/assets/property4-v2-20260427.jpg";
import property5 from "@/assets/property5-v2-20260427.jpg";
import property6 from "@/assets/property6-v2-20260427.jpg";

const PROPERTIES = [
  {
    id: 1, image: property1, title: "강남역 초역세권 1층 상가",
    address: "서울특별시 강남구 역삼동 123-4", type: "상가",
    area: "85㎡ (25평)", floor: "1층", deposit: "5,000만원",
    monthly: "350만원", manageFee: "30만원", isNew: true, isHot: true, views: 3241,
    checkedDate: "2026-05-14",
  },
  {
    id: 2, image: property2, title: "여의도 IFC몰 인근 프리미엄 사무실",
    address: "서울특별시 영등포구 여의도동 31", type: "사무실",
    area: "165㎡ (50평)", floor: "12층", deposit: "1억원",
    monthly: "680만원", manageFee: "50만원", isNew: true, isHot: false, views: 1872,
    registeredDate: "2026-05-10",
  },
  {
    id: 3, image: property3, title: "홍대 상권 중심 1층 빈 상가",
    address: "서울특별시 마포구 서교동 353", type: "상가",
    area: "66㎡ (20평)", floor: "1층", deposit: "3,000만원",
    monthly: "280만원", manageFee: "20만원", isNew: false, isHot: true, views: 5610,
    checkedDate: "2026-05-12",
  },
  {
    id: 4, image: property4, title: "이태원 세계음식거리 식당 공실",
    address: "서울특별시 용산구 이태원동 129-3", type: "식당·카페",
    area: "132㎡ (40평)", floor: "1층", deposit: "8,000만원",
    monthly: "420만원", manageFee: "40만원", isNew: false, isHot: false, views: 2103,
    registeredDate: "2026-05-08",
  },
  {
    id: 5, image: property5, title: "판교 테크노밸리 대형 오피스",
    address: "경기도 성남시 분당구 판교역로 166", type: "사무실",
    area: "330㎡ (100평)", floor: "8층", deposit: "2억원",
    monthly: "1,200만원", manageFee: "80만원", isNew: true, isHot: false, views: 987,
    checkedDate: "2026-05-13",
  },
  {
    id: 6, image: property6, title: "신촌 로데오거리 소형 상가",
    address: "서울특별시 서대문구 창천동 52", type: "상가",
    area: "33㎡ (10평)", floor: "1층", deposit: "2,000만원",
    monthly: "130만원", manageFee: "10만원", isNew: false, isHot: false, views: 1456,
    registeredDate: "2026-05-06",
  },
];

const TYPES = ["전체", "상가", "사무실", "식당·카페", "공장·창고", "병원·학원"];
const SORTS = ["최신순", "낮은 월세순", "조회순", "면적순"];

const PropertyListSection = () => {
  const [activeType, setActiveType] = useState("전체");
  const [sortBy, setSortBy] = useState("최신순");
  const [properties, setProperties] = useState(PROPERTIES);

  const filtered = activeType === "전체"
    ? properties
    : properties.filter((p) => p.type === activeType);

  const handleDelete = (id: number) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">최신 공실 매물</h2>
          <p className="text-sm text-muted-foreground mt-1">
            총 <span className="font-semibold text-primary">{filtered.length}개</span>의 매물이 있습니다
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-card border border-border rounded-lg px-4 py-2 text-sm font-medium text-foreground pr-8 outline-none cursor-pointer hover:border-primary transition-colors"
            >
              {SORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 font-medium">
            <SlidersHorizontal className="w-4 h-4" />
            필터
          </Button>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div className="flex gap-2 flex-wrap mb-8">
        {TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              activeType === type
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary hover:text-primary"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((property) => (
          <PropertyCard
            key={property.id}
            {...property}
            buildYear={(property as any).buildYear}
            elevator={(property as any).elevator}
            onDelete={() => handleDelete(property.id)}
          />
        ))}
      </div>

      {/* Load More */}
      <div className="flex justify-center mt-10">
        <Button
          variant="outline"
          size="lg"
          className="px-10 font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          더 보기
        </Button>
      </div>
    </section>
  );
};

export default PropertyListSection;
