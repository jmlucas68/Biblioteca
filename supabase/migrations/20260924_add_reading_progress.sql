-- Biblioteca has a shared reading position, like its shared annotations.
CREATE TABLE IF NOT EXISTS public.reading_progress (
    book_id text NOT NULL,
    format text NOT NULL CHECK (format IN ('pdf', 'epub', 'cbr')),
    page integer CHECK (page > 0),
    cfi text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (book_id, format),
    CHECK ((format = 'epub' AND cfi IS NOT NULL AND cfi LIKE 'epubcfi(%') OR
           (format IN ('pdf', 'cbr') AND page IS NOT NULL))
);
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.reading_progress TO anon, authenticated;
CREATE POLICY "Read shared reading progress" ON public.reading_progress
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Insert shared reading progress" ON public.reading_progress
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Update shared reading progress" ON public.reading_progress
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
