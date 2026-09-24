const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReadingProgress } = require('../modules/reading-progress.js');
const values = new Map();
global.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
function database(initial = []) {
    const rows = new Map(initial.map(row => [`${row.book_id}:${row.format}`, row]));
    const writes = [];
    return { rows, writes, from() {
        const filters = {};
        return {
            select() { return this; },
            eq(key, value) { filters[key] = value; return this; },
            async maybeSingle() { return { data: rows.get(`${filters.book_id}:${filters.format}`) || null }; },
            async upsert(row) {
                await new Promise(resolve => setImmediate(resolve));
                writes.push(row);
                rows.set(`${row.book_id}:${row.format}`, row);
                return {};
            }
        };
    } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
test('reopens a PDF on its saved page, including backward navigation', async () => {
    const db = database();
    const progress = createReadingProgress(db, 'pdf-test', 'pdf');
    await progress.load();
    progress.save({ page: 12 });
    progress.save({ page: 3 });
    await settle();
    values.clear();
    assert.equal((await createReadingProgress(db, 'pdf-test', 'pdf').load()).page, 3);
});
test('isolates books and formats, stores exact EPUB locations', async () => {
    const db = database();
    for (const [id, format, position] of [['a','epub',{ cfi:'epubcfi(/6/4!/4/2:9)' }], ['a','pdf',{page:7}], ['b','cbr',{page:20}]]) {
        const p = createReadingProgress(db, id, format);
        await p.load(); p.save(position);
    }
    await settle(); values.clear();
    assert.equal((await createReadingProgress(db, 'a', 'epub').load()).cfi, 'epubcfi(/6/4!/4/2:9)');
    assert.equal((await createReadingProgress(db, 'a', 'pdf').load()).page, 7);
    assert.equal((await createReadingProgress(db, 'b', 'cbr').load()).page, 20);
});
test('restores the newer device copy and synchronizes it', async () => {
    const old = { book_id:'offline', format:'pdf', page:2, updated_at:'2026-09-20T10:00:00Z' };
    const db = database([old]);
    values.set('reading-progress:pdf:offline', JSON.stringify({ ...old, page:9, updated_at:'2026-09-21T10:00:00Z' }));
    assert.equal((await createReadingProgress(db, 'offline', 'pdf').load()).page, 9);
    await settle();
    assert.equal(db.rows.get('offline:pdf').page, 9);
});
test('does not overwrite progress before restoration or with invalid pages', async () => {
    const db = database();
    const p = createReadingProgress(db, 'invalid', 'pdf');
    p.save({ page:1 });
    await p.load();
    for (const page of [0, -1, 1.5, NaN, Infinity]) p.save({page});
    await settle();
    assert.equal(db.writes.length, 0);
});
