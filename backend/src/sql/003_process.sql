ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS process VARCHAR(40);

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS process VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_plans_process
  ON public.plans (process);

CREATE INDEX IF NOT EXISTS idx_inspections_process
  ON public.inspections (process);
