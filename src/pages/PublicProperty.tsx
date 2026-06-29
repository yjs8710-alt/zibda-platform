import { useParams, useSearchParams } from "react-router-dom";
import PublicPropertyView from "@/components/PublicPropertyView";

export default function PublicProperty() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sharedBy = searchParams.get("sharedBy");
  if (!id) return null;
  return <PublicPropertyView id={id} sharedBy={sharedBy} />;
}
