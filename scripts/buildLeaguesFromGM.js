// scripts/buildLeaguesFromGM.js
const fs = require("fs");
const path = require("path");

// ---- CPM helpers (same as app) ----
const CPM = [0, 0.094, 0.135137432, 0.16639787, 0.192650919, 0.21573247, 0.236572661, 0.25572005, 0.273530381, 0.29024988, 0.306057377, 0.3210876, 0.335445036, 0.34921268, 0.362457751, 0.37523559, 0.387592406, 0.39956728, 0.411193551, 0.42250001, 0.432926419, 0.44310755, 0.4530599578, 0.46279839, 0.472336083, 0.48168495, 0.4908558, 0.49985844, 0.508701765, 0.51739395, 0.525942511, 0.53435433, 0.542635767, 0.55079269, 0.558830576, 0.56675452, 0.574569153, 0.58227891, 0.589887907, 0.59740001, 0.604818814, 0.61215729, 0.619399365, 0.62656713, 0.633644533, 0.64065295, 0.647576426, 0.65443563, 0.661214806, 0.667934, 0.674577537, 0.68116492, 0.687680648, 0.69414365, 0.700538673, 0.70688421, 0.713164996, 0.71939909, 0.725571552, 0.7317, 0.734741009, 0.73776948, 0.740785574, 0.74378943, 0.746781211, 0.74976104, 0.752729087, 0.75568551, 0.758630378, 0.76156384, 0.764486065, 0.76739717, 0.770297266, 0.7731865, 0.776064962, 0.77893275, 0.781790055, 0.78463697, 0.787473578, 0.79030001, 0.792803968, 0.79530001, 0.797803921, 0.8003];
const cp = (a, d, s, c) => Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * c * c) / 10);
function levelForCap(a, d, s, cap) { if (!Number.isFinite(cap)) return 50; let best = 1; for (let i = 1; i < CPM.length; i++) { const c = CPM[i]; if (!c) continue; if (cp(a * c, d * c, s * c, 1) <= cap) best = i; } return best; }

// ---- Paths (note: no 'leagueFiles' subfolder) ----
const DATA_DIR = path.join(__dirname, "../src/Data/leagueFiles");
const GM_PATH = path.join(__dirname, "../src/Data/gamemaster.json")
const GREAT = path.join(DATA_DIR, "great.json");
const ULTRA = path.join(DATA_DIR, "ultra.json");
const MASTER = path.join(DATA_DIR, "master.json");

// ---- Utils ----
const normId = s => String(s || "").toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
function readArr(p) { try { const a = JSON.parse(fs.readFileSync(p, "utf8")); return Array.isArray(a) ? a : []; } catch { return []; } }
function writeArr(p, a) { fs.writeFileSync(p, JSON.stringify(a, null, 2) + "\n", "utf8"); console.log("[buildLeagues] wrote", p, "(", a.length, "entries )"); }
function merge(existing, ids) {
    const map = new Map(existing.map(o => [String(o.speciesId), o]));
    let added = 0;
    for (const id of ids) {
        if (!map.has(id)) { map.set(id, { speciesId: id }); added++; }
    }
    return { merged: [...map.values()].sort((a, b) => String(a.speciesId).localeCompare(String(b.speciesId))), added };
}

// ---- Load GM ----
console.log("[buildLeagues] CWD:", process.cwd());
console.log("[buildLeagues] GM path:", GM_PATH);
if (!fs.existsSync(GM_PATH)) { console.error("ERROR: gamemaster.json not found"); process.exit(1); }

const gm = JSON.parse(fs.readFileSync(GM_PATH, "utf8"));
const sources = [gm?.pokemon, gm?.data?.pokemon].filter(Boolean);
if (sources.length === 0) { console.error("ERROR: No pokemon array in gamemaster.json"); process.exit(1); }

const species = [];
for (const L of sources) {
    for (const p of L) {
        const id = normId(p.speciesId || p.id || p.name);
        const bs = p.baseStats || p.stats || {};
        species.push({
            speciesId: id,
            atk: Number(bs.atk ?? bs.attack ?? 200),
            def: Number(bs.def ?? bs.defense ?? 200),
            sta: Number(bs.hp ?? bs.sta ?? bs.stamina ?? 200)
        });
    }
}
console.log(`[buildLeagues] loaded ${species.length} species from GM`);

// ---- Filter by cap ----
const eligible = (s, cap) => Number.isFinite(cap) ? levelForCap(s.atk, s.def, s.sta, cap) >= 1 : true;
const greatIds = species.filter(s => eligible(s, 1500)).map(s => s.speciesId);
const ultraIds = species.filter(s => eligible(s, 2500)).map(s => s.speciesId);
const masterIds = species.map(s => s.speciesId);

// ---- Merge & write ----
const g = merge(readArr(GREAT), greatIds);
const u = merge(readArr(ULTRA), ultraIds);
const m = merge(readArr(MASTER), masterIds);

console.log(`[buildLeagues] additions -> Great:+${g.added} Ultra:+${u.added} Master:+${m.added}`);
if (g.added) writeArr(GREAT, g.merged);
if (u.added) writeArr(ULTRA, u.merged);
if (m.added) writeArr(MASTER, m.merged);
if (!g.added && !u.added && !m.added) console.log("[buildLeagues] no changes (already up to date).");
