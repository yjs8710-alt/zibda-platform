import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "report" | "proposal" | "transaction" | "view";

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  property_id?: number | null;
  link?: string | null;
}

export async function createNotification(input: CreateNotificationInput) {
  const { error } = await (supabase.from("notifications") as any).insert({
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    property_id: input.property_id ?? null,
    link: input.link ?? null,
  });
  if (error) console.error("notification insert error", error);
}

export async function notifySelf(type: NotificationType, title: string, body?: string, link?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await createNotification({ user_id: user.id, type, title, body, link });
}
