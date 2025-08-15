// scripts/buildLeaguesFromGM.js
// Build or update great.json, ultra.json, master.json from src/Data/gamemaster.json
// - Merges with existing files, preserves any custom moves you already set
// - Adds missing species from gamemaster
// - Leaves moves empty for new entries so your app can recommend safely

const fs = require("fs");
const path = require("path");

// ---- CPM and CP helpers (same math you use in battleCalc) ----
const CPM = [
    0, 0.094, 0.135137432, 0.16639787, 0.192650919, 0.21573247, 0.236572661, 0.25572005, 0.273530381,
    0.29024988, 0.306057377, 0.3210876, 0.335445036, 0.34921268, 0.362457751, 0.37523559, 0.387592406,
    0.39956728, 0.411193551, 0.42250001, 0.432926419, 0.44310755, 0.4530599578, 0.46279839, 0.472336083,
    0.48168495, 0.4908558, 0.49985844, 0.508701765, 0.51739395, 0.525942511, 0.53435433, 0.542635767,
    0.55079269, 0.558830576, 0.56675452, 0.574569153, 0.58227891, 0.589887907, 0.59740001, 0.604818814,
    0.61215729, 0.619399365, 0.62656713, 0.633644533, 0.64065295, 0.647576426, 0.65443563, 0.661214806,
    0.667934, 0.674577537, 0.68116492, 0.687680648, 0.69414365, 0.700538673, 0.70688421, 0.713164996,
    0.71939909, 0.725571552, 0.7317, 0.734741009, 0.73776948, 0.740785574, 0.74378943, 0.746781211,
    0.74976104, 0.752729087, 0.75568551, 0.758630378, 0.76156384, 0.764486065, 0.76739717, 0.770297266,
    0.7731865, 0.776064962, 0.77893275, 0.781790055, 0.78463697, 0.787473578, 0.79030001, 0.792803968,
    0.79530001, 0.797803921, 0.8003
];
const cp = (a, d, s, c) => Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * c * c) / 10);
function levelForCap(baseAtk, baseDef, baseSta, cap) {
    if (!Number.isFinite(cap)) return 50;
    let best = 1;
    for (let i = 1; i < CPM.length; i++) {
        const c = CPM[i];
        if (!c) continue;
        if (cp(baseAtk * c, baseDef * c, baseSta * c, 1) <= cap) best = i;
    }
    return best;
}

// ---- load gamemaster and species list ----
const GM_PATH = path.join(__dirname, "../src/Data/gamemaster.json");
const gm = JSON.parse(fs.readFileSync(GM_PATH, "utf8"));

function normId(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function speciesListFromGM(gm) {
    const lists = [gm?.pokemon, gm?.data?.pokemon].filter(Boolean);
    const out = [];
    for (const L of lists) {
        for (const p of L) {
            const id = normId(p.speciesId || p.id || p.name);
            const bs = p.baseStats || p.stats || {};
            const atk = Number(bs.atk ?? bs.attack ?? 200);
            const def = Number(bs.def ?? bs.defense ?? 200);
            const sta = Number(bs.hp ?? bs.sta ?? bs.stamina ?? 200);
            out.push({ speciesId: id, atk, def, sta });
        }
    }
    return out;
}

const species = speciesListFromGM(gm);

// ---- build eligibility by league ----
function eligibleFor(spec, cap) {
    if (!Number.isFinite(cap)) return true; // master - include all
    const lvl = levelForCap(spec.atk, spec.def, spec.sta, cap);
    return lvl >= 1; // can exist at or under cap
}

function readLeague(file) {
    try {
        const arr = JSON.parse(fs.readFileSync(file, "utf8"));
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function writeLeague(file, entries) {
    const pretty = JSON.stringify(entries, null, 2) + "\n";
    fs.writeFileSync(file, pretty, "utf8");
}

// Merge new species into existing list, preserve existing objects with moves
function mergeLeague(existingArr, newSpeciesIds) {
    const existingMap = new Map(existingArr.map(o => [String(o.speciesId), o]));
    for (const sid of newSpeciesIds) {
        if (!existingMap.has(sid)) existingMap.set(sid, { speciesId: sid });
    }
    return Array.from(existingMap.values()).sort((a, b) =>
        String(a.speciesId).localeCompare(String(b.speciesId))
    );
}

// ---- do the work ----
const dataDir = path.join(__dirname, "../src/Data/leagueFiles");
const greatPath = path.join(dataDir, "great.json");
const ultraPath = path.join(dataDir, "ultra.json");
const masterPath = path.join(dataDir, "master.json");

const greatIds = species.filter(s => eligibleFor(s, 1500)).map(s => s.speciesId);
const ultraIds = species.filter(s => eligibleFor(s, 2500)).map(s => s.speciesId);
const masterIds = species.map(s => s.speciesId);

const greatMerged = mergeLeague(readLeague(greatPath), greatIds);
const ultraMerged = mergeLeague(readLeague(ultraPath), ultraIds);
const masterMerged = mergeLeague(readLeague(masterPath), masterIds);

writeLeague(greatPath, greatMerged);
writeLeague(ultraPath, ultraMerged);
writeLeague(masterPath, masterMerged);

console.log(`Updated:
- great.json:  ${greatMerged.length} entries
- ultra.json:  ${ultraMerged.length} entries
- master.json: ${masterMerged.length} entries`);
