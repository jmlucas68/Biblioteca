-- Fecha específica de la última página que cambió el lector.
ALTER TABLE public.reading_progress
    ADD COLUMN IF NOT EXISTS last_page_changed_at timestamptz;

-- El progreso previo ya se registraba en updated_at; se conserva como fecha
-- inicial para que los lectores usados antes de esta migración aparezcan.
UPDATE public.reading_progress
SET last_page_changed_at = updated_at
WHERE last_page_changed_at IS NULL;

ALTER TABLE public.reading_progress
    ALTER COLUMN last_page_changed_at SET NOT NULL,
    ALTER COLUMN last_page_changed_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS reading_progress_last_page_changed_at_idx
    ON public.reading_progress (last_page_changed_at DESC);
