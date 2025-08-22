// src/lib/recent.js
// Simple per-league recents & pins stored in localStorage

const keyR = (league) => `pvptrainer:recents:${league}`;
const keyP = (league) => `pvptrainer:pins:${league}`;

function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
}

export function getRecents(league) {
    return read(keyR(league));
}
export function addRecent(league, label, limit = 8) {
    const pins = new Set(getPinned(league).map(String));
    const cur = getRecents(league).filter(x => !pins.has(String(x)));
    const list = [label, ...cur.filter(x => x !== label)].slice(0, limit);
    write(keyR(league), list);
}
export function getPinned(league) {
    return read(keyP(league));
}
export function togglePinned(league, label) {
    const cur = new Set(getPinned(league));
    if (cur.has(label)) cur.delete(label); else cur.add(label);
    write(keyP(league), Array.from(cur));
}
export function getChips(league) {
    const pinned = getPinned(league);
    const pinSet = new Set(pinned.map(String));
    const recents = getRecents(league).filter(x => !pinSet.has(String(x)));
    return { pinned, recents };
}
