-- Phase 7: Category-aware order metadata
-- Adds a flexible metadata column so the same orders table can hold:
--   restaurant/retail/grocery/pharmacy → items[] (existing)
--   clinic    → { doctor_name, appointment_at, patient_name }
--   salon/services → { service_name, booking_at }
-- Run in Supabase SQL Editor.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
