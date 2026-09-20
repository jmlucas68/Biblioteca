-- Registra la última actividad de cada remarcado o nota.
ALTER TABLE public.annotations
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Las anotaciones históricas conservan como actividad su fecha de creación.
UPDATE public.annotations
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.annotations
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_annotations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS annotations_set_updated_at ON public.annotations;

CREATE TRIGGER annotations_set_updated_at
BEFORE UPDATE ON public.annotations
FOR EACH ROW
EXECUTE FUNCTION public.set_annotations_updated_at();

CREATE INDEX IF NOT EXISTS annotations_updated_at_idx
    ON public.annotations (updated_at DESC);
