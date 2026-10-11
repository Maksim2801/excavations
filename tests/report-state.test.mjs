import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load = async (file) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(file, import.meta.url))).toString('base64')}`);
const { cleanReport, reportURL, reportFromURL, restoreTemplate } = await load('../frontend/modules/reportState.js');
const filters = { q: 'венчик & кость', photo_present: 'false', date_from: '2026-10-01', date_to: '2026-10-11', material: 'кость', excavation_id: '2', layer_id: '8' };
const link = reportURL(filters, 'elev', 'desc', [9, 11]);
const state = reportFromURL(new URL(link, 'http://localhost').searchParams);
assert.equal(state.q, filters.q);
assert.equal(state.photo_present, false);
assert.equal(state.date_to, filters.date_to);
assert.deepEqual(state.ids, [9, 11]);
const restored = restoreTemplate({ filters: state, columns: ['code', 'north'], sort: { sort: 'elev', order: 'desc' } });
assert.equal(restored.layer_id, '8');
assert.equal(restored.sort, 'elev');
assert.equal(restored.order, 'desc');
assert.equal(restored.photo_present, false);
assert.deepEqual(restored.columns, ['code', 'north']);
assert.deepEqual(cleanReport({ q: '', photo_present: false, elev_from: 0, irrelevant: 'x' }), { photo_present: false, elev_from: 0 });
assert.equal(cleanReport({ layout: 'field', collection_name: 'Коллекция' }).layout, 'field');
assert.equal(cleanReport({ collection_name: 'Коллекция' }).layout, 'working');
assert.equal(cleanReport({ layout: 'album', excavation_id: '1' }).layout, 'album');
// Persistent read cache is isolated by session and never falls back for an unrelated endpoint.
globalThis.localStorage = {};
Object.defineProperties(localStorage, {
  getItem: {value(key) { return this[key] ?? null; }},
  setItem: {value(key, value) { this[key] = value; }},
  removeItem: {value(key) { delete this[key]; }},
});
const { cacheRead, cachedRead, clearReadCache, cacheable } = await load('../frontend/services/offlineCache.js');
cacheRead('user-a', '/api/findings?page=1', { items: [1] });
assert.deepEqual(cachedRead('user-a', '/api/findings?page=1'), { items: [1] });
assert.equal(cachedRead('user-b', '/api/findings?page=1'), undefined);
assert.equal(cacheable('/api/photos/1/file'), false);
assert.equal(cacheable('/api/users'), false);
assert.equal(cacheable('/api/findings/1'), true);
clearReadCache();
assert.equal(cachedRead('user-a', '/api/findings?page=1'), undefined);
console.log('PASS: filter transfer, false/zero values, selection, full template restore, cache isolation and logout purge');
