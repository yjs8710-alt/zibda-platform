-- Backfill chat_inquiry notification links so old notifications also deep-link to the conversation.
-- We match notifications to the chat_messages row that triggered them by user + timestamp proximity.
WITH matched AS (
  SELECT DISTINCT ON (n.id) n.id AS notif_id, cm.conversation_id
  FROM public.notifications n
  JOIN public.chat_messages cm
    ON abs(extract(epoch FROM (n.created_at - cm.created_at))) < 5
  JOIN public.chat_conversations cc ON cc.id = cm.conversation_id
  WHERE n.type = 'chat_inquiry'
    AND (n.link IS NULL OR n.link = '/chat' OR n.link = '')
    AND (cc.user_id = n.user_id OR cc.agent_user_id = n.user_id)
  ORDER BY n.id, abs(extract(epoch FROM (n.created_at - cm.created_at))) ASC
)
UPDATE public.notifications n
SET link = '/chat?c=' || m.conversation_id::text
FROM matched m
WHERE n.id = m.notif_id;