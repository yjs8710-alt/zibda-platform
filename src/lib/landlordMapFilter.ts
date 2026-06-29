import type { LandlordResult } from "@/components/MapFilterBar";
import type { MapProperty } from "@/data/mapProperties";

export function filterLandlordMapProperties(
  properties: MapProperty[],
  landlordResults: LandlordResult[],
  landlordSearched: boolean,
  landlordLoading = false
) {
  if (!landlordSearched) return properties;
  if (landlordLoading) return [];

  const propertyResults = landlordResults.filter((item) => item.source === "property");
  if (propertyResults.length === 0) return [];

  const dbIds = new Set<string>();
  const regNos = new Set<string>();

  propertyResults.forEach((item) => {
    if (item.id.startsWith("prop_")) dbIds.add(item.id.replace(/^prop_/, ""));
    if (item.regNo) regNos.add(item.regNo);
  });

  return properties.filter((property) =>
    (property.dbId && dbIds.has(property.dbId)) ||
    (property.regNo && regNos.has(property.regNo))
  );
}