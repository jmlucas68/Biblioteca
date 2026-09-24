(function (root) {
    'use strict';
    // A book may have different pagination in each format.
    function createReadingProgress(client, bookId, format) {
        const key = `reading-progress:${format}:${bookId}`;
        let current = null;
        let pending = null;
        let saving = false;
        let loaded = false;
        let retryTimer;
        let warning;
        function warn() {
            if (!root.document || warning) return;
            warning = root.document.createElement('div');
            warning.setAttribute('role', 'status');
            warning.style.cssText = 'position:fixed;bottom:65px;right:12px;z-index:10000;max-width:320px;padding:10px;background:#523b16;color:white;border-radius:6px;font:13px sans-serif';
            warning.textContent = 'Progreso guardado en este dispositivo. Pendiente de sincronizar con la base de datos.';
            root.document.body.append(warning);
        }
        function cache(value) {
            try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Storage can be disabled. */ }
        }
        function valid(value) {
            return value && (format === 'epub'
                ? typeof value.cfi === 'string' && value.cfi.startsWith('epubcfi(')
                : Number.isInteger(value.page) && value.page > 0);
        }
        async function flush() {
            if (saving || !pending) return;
            saving = true;
            clearTimeout(retryTimer);
            try {
                while (pending) {
                    const value = pending;
                    const { error } = await client.from('reading_progress').upsert(value, { onConflict: 'book_id,format' });
                    if (error) throw error;
                    if (pending === value) pending = null;
                    warning?.remove();
                    warning = null;
                }
            } catch (error) {
                console.warn('No se ha podido sincronizar el progreso de lectura:', error);
                warn();
                retryTimer = setTimeout(flush, 15000);
            } finally { saving = false; }
        }
        async function load() {
            let local;
            try { local = JSON.parse(root.localStorage.getItem(key)); } catch (_) { /* No local copy. */ }
            if (valid(local)) current = local;
            try {
                const { data, error } = await client.from('reading_progress').select('*').eq('book_id', bookId).eq('format', format).maybeSingle();
                if (error) throw error;
                if (valid(data) && (!current || Date.parse(data.updated_at) >= Date.parse(current.updated_at))) current = data;
                else if (current) pending = current;
            } catch (error) {
                console.warn('No se ha podido recuperar el progreso de lectura:', error);
                warn();
                if (current) pending = current;
            }
            loaded = true;
            if (current) cache(current);
            void flush();
            return current;
        }
        function save(position) {
            if (!loaded || !valid(position)) return;
            if (current && current.page === (position.page ?? null) && current.cfi === (position.cfi ?? null)) return;
            current = { book_id: String(bookId), format, page: position.page ?? null, cfi: position.cfi ?? null, updated_at: new Date().toISOString() };
            cache(current);
            pending = current;
            void flush();
        }
        root.addEventListener?.('online', flush);
        root.document?.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden') void flush(); });
        return { load, save, flush };
    }
    root.createReadingProgress = createReadingProgress;
    if (typeof module !== 'undefined') module.exports = { createReadingProgress };
})(typeof window !== 'undefined' ? window : globalThis);
