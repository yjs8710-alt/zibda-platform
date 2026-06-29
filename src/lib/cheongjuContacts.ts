import { supabase } from "@/integrations/supabase/client";

export interface ContactValues {
  contactOwner: string;
  contactOwner2: string;
  extraOwners: string[];
  contactManager: string;
  contactBroker: string;
}

export interface CheongjuContactPayload {
  district: string;
  dong: string;
  lot_number: string;
  unit_number: string | null;
  phone: string;
  contact_owner: string | null;
  contact_manager: string | null;
  contact_broker: string | null;
  memo: string | null;
  is_visible: boolean;
  building_name?: string;
}

const EMPTY_CONTACTS: ContactValues = {
  contactOwner: "",
  contactOwner2: "",
  extraOwners: [],
  contactManager: "",
  contactBroker: "",
};

const parseExtraOwners = (memo?: string | null) => {
  const match = (memo || "").match(/EXTRA_OWNERS:\[([^\]]*)\]/);
  if (!match) return { owner2: "", extras: [] as string[] };
  const list = match[1].split(",").map((value) => value.trim()).filter(Boolean);
  return { owner2: list[0] || "", extras: list.slice(1) };
};

const parsePropertyNoteContacts = (note?: string | null): ContactValues => {
  if (!note) return EMPTY_CONTACTS;
  const read = (pattern: RegExp) => note.match(pattern)?.[1]?.trim() || "";
  const extras: string[] = [];
  for (let i = 3; i <= 20; i++) {
    const value = read(new RegExp(`(?:건물주|소유주|소유자)${i}[:\\s]+([^\\n|]+)`));
    if (value) extras.push(value);
  }
  return {
    contactOwner: read(/(?:건물주|소유주|소유자)(?!\d)[:\s]+([^\n|]+)/),
    contactOwner2: read(/(?:건물주|소유주|소유자)2[:\s]+([^\n|]+)/),
    extraOwners: extras,
    contactManager: read(/관리인[:\s]+([^\n|]+)/),
    contactBroker: read(/부동산[:\s]+([^\n|]+)/),
  };
};

export async function loadCheongjuContact({
  dong,
  lotNumber,
  unitNumber,
  fallbackFromProperties = true,
}: {
  dong: string;
  lotNumber: string;
  unitNumber?: string | null;
  fallbackFromProperties?: boolean;
}): Promise<ContactValues | null> {
  if (!dong || !lotNumber) return null;

  let contactQuery = supabase
    .from("cheongju_contacts")
    .select("contact_owner,contact_manager,contact_broker,phone,memo")
    .eq("dong", dong)
    .eq("lot_number", lotNumber)
    .order("updated_at", { ascending: false })
    .limit(1);

  contactQuery = unitNumber ? contactQuery.eq("unit_number", unitNumber) : contactQuery.is("unit_number", null);
  const { data: contactRows } = await contactQuery;
  const contactData = contactRows?.[0];

  if (contactData) {
    const { owner2, extras } = parseExtraOwners(contactData.memo);
    return {
      contactOwner: contactData.contact_owner || contactData.phone || "",
      contactOwner2: owner2,
      extraOwners: extras,
      contactManager: contactData.contact_manager || "",
      contactBroker: contactData.contact_broker || "",
    };
  }

  if (!fallbackFromProperties) return null;

  let propertyQuery = supabase
    .from("properties")
    .select("note")
    .eq("dong", dong)
    .eq("lot_number", lotNumber)
    .not("note", "is", null)
    .order("registered_date", { ascending: false })
    .limit(1);

  if (unitNumber) propertyQuery = propertyQuery.eq("unit_number", unitNumber);
  const { data: propertyRows } = await propertyQuery;
  const parsed = parsePropertyNoteContacts(propertyRows?.[0]?.note || null);
  return parsed.contactOwner || parsed.contactOwner2 || parsed.extraOwners.length || parsed.contactManager || parsed.contactBroker
    ? parsed
    : null;
}

export async function saveCheongjuContact(payload: CheongjuContactPayload) {
  let existingQuery = supabase
    .from("cheongju_contacts")
    .select("id")
    .eq("dong", payload.dong)
    .eq("lot_number", payload.lot_number)
    .order("updated_at", { ascending: false })
    .limit(1);

  existingQuery = payload.unit_number
    ? existingQuery.eq("unit_number", payload.unit_number)
    : existingQuery.is("unit_number", null);

  const { data: existingRows, error: lookupError } = await existingQuery;
  if (lookupError) return { error: lookupError };

  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    return supabase.from("cheongju_contacts").update(payload as never).eq("id", existingId);
  }

  return supabase.from("cheongju_contacts").insert(payload as never);
}