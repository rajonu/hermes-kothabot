-- ─── 019: Clinic Appointment Scheduling Engine ───────────────────────────────
-- Additive only. Existing clinic orders-as-appointments continue to work.
-- All new tables prefixed `clinic_` to namespace them cleanly.
-- Run in Supabase SQL Editor.

-- ── Locations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_locations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_locations_shop ON public.clinic_locations(shop_id);

-- ── Doctor ↔ Service junction ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_doctor_services (
  doctor_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, service_id)
);
CREATE INDEX IF NOT EXISTS idx_clinic_ds_shop ON public.clinic_doctor_services(shop_id);

-- ── Doctor ↔ Location junction ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_doctor_locations (
  doctor_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.clinic_locations(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_clinic_dl_shop ON public.clinic_doctor_locations(shop_id);

-- ── Weekly schedules (per doctor, optionally per location) ───────────────────
-- weekday: 0=Sunday … 6=Saturday
-- Multiple rows per (doctor, weekday) = multiple working ranges that day
CREATE TABLE IF NOT EXISTS public.clinic_schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.clinic_locations(id) ON DELETE SET NULL,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_clinic_sched_doctor ON public.clinic_schedules(doctor_id, weekday);
CREATE INDEX IF NOT EXISTS idx_clinic_sched_shop ON public.clinic_schedules(shop_id);

-- ── Special days (off-days, holidays, custom hours) ──────────────────────────
-- doctor_id NULL → applies to entire clinic on that date
CREATE TABLE IF NOT EXISTS public.clinic_special_days (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.clinic_locations(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'off' CHECK (type IN ('off', 'holiday', 'custom')),
  start_time  TIME,  -- NULL = full day off; populated only for type='custom'
  end_time    TIME,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_special_doctor ON public.clinic_special_days(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_clinic_special_shop ON public.clinic_special_days(shop_id, date);

-- ── Extend orders with structured scheduling references ───────────────────────
-- All nullable so existing rows are unaffected.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS doctor_id   UUID REFERENCES public.products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_id  UUID REFERENCES public.products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.clinic_locations(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS starts_at   TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ends_at     TIMESTAMPTZ;

-- Double-booking guard: one doctor cannot have two live appointments at the same starts_at
CREATE UNIQUE INDEX IF NOT EXISTS uniq_doctor_slot
  ON public.orders (doctor_id, starts_at)
  WHERE type = 'appointment'
    AND status <> 'cancelled'
    AND doctor_id IS NOT NULL
    AND starts_at IS NOT NULL;

-- Range query index for availability computation
CREATE INDEX IF NOT EXISTS idx_orders_appt_range
  ON public.orders (shop_id, doctor_id, starts_at, ends_at)
  WHERE type = 'appointment';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.clinic_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_doctor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_doctor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_special_days ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own data; service role bypasses RLS
CREATE POLICY "clinic_locations_owner"
  ON public.clinic_locations
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "clinic_ds_owner"
  ON public.clinic_doctor_services
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "clinic_dl_owner"
  ON public.clinic_doctor_locations
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "clinic_schedules_owner"
  ON public.clinic_schedules
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "clinic_special_days_owner"
  ON public.clinic_special_days
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- Updated_at trigger for locations
CREATE OR REPLACE FUNCTION update_clinic_location_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS clinic_location_updated_at ON public.clinic_locations;
CREATE TRIGGER clinic_location_updated_at
  BEFORE UPDATE ON public.clinic_locations
  FOR EACH ROW EXECUTE FUNCTION update_clinic_location_updated_at();
