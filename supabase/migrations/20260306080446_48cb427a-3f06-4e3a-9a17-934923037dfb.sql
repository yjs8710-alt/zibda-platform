ALTER TABLE public.cheongju_contacts
  ADD COLUMN IF NOT EXISTS lot_number text NOT NULL DEFAULT '';