// src/battleCalc.js
// Adapter your App uses. Calls the battle engine and also exposes helpers:
// - buildMoveBook (bootstrap from gamemaster)
// - bestOfThree (UI helper)
// - recommendMovesFor(speciesId, leagueEntry?) -> {fastMove, chargedMoves}
// - dangerMovesFor(enemySpeciesId, mySpeciesId, enemyChargedIds[]) -> top 2 charged move IDs
// - dangerMoveTimingFor(attacker, defender) -> {moveId, fasts, turns, seconds}

import { simulateBattle } from "./engine/battleEngine";

let SPECIES = {};
let MOVES = {};

// ---------------- small utils kept for compatibility ----------------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const canonMoveId = (s) =>
    String(s || "")
        .trim()
        .replace(/^COMBAT_V\d+_MOVE_/i, "")
        .replace(/^V\d+_/i, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toUpperCase();

const normId = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "");

// Robust league cap normalization
function capLeague(league) {
    if (Number.isFinite(league)) return Number(league); // numeric cap passed

    const key = String(league || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/league$/, ""); // strip trailing "league"

    switch (key) {
        case "great": return 1500;
        case "ultra": return 2500;
        case "master": return Infinity;
        default: {
            const m = key.match(/^(\d{3,4})$/); // allow "1500" or "2500"
            return m ? Number(m[1]) : Infinity;
        }
    }
}

// ---------------- CPM helpers ----------------
const CPM = [];
(function fillCPM() {
    const table = [
        0.094, 0.135137432, 0.16639787, 0.192650919, 0.21573247, 0.236572661, 0.25572005, 0.273530381,
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
    CPM.length = 100;
    CPM.fill(0);
    for (let i = 0; i < table.length; i++) CPM[i + 1] = table[i];
})();

function cp(a, d, s, c) {
    return Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * c * c) / 10);
}
function cpAtLevel(baseAtk, baseDef, baseSta, level) {
    const c = CPM[level] || 0;
    if (!c) return 10;
    return cp(baseAtk * c, baseDef * c, baseSta * c, 1);
}
function levelForCap(baseAtk, baseDef, baseSta, cap) {
    if (!isFinite(cap)) return 50;
    let best = 1;
    for (let i = 1; i < CPM.length; i++) {
        const c = CPM[i];
        if (!c) continue;
        if (cp(baseAtk * c, baseDef * c, baseSta * c, 1) <= cap) best = i;
    }
    return best;
}

// Public - can this species exist at or under the league cap at some legal level?
export function eligibleForLeague(speciesId, leagueName) {
    const cap = capLeague(leagueName);
    if (!Number.isFinite(cap)) return true; // Master League is uncapped

    const sid = normId(speciesId);
    const sp = SPECIES[sid];
    if (!sp) return false;

    // CP grows monotonically with level; return true if ANY level 1..50 is <= cap
    for (let L = 1; L <= 50; L++) {
        if (cpAtLevel(sp.atk, sp.def, sp.sta, L) <= cap) return true;
    }
    return false;
}


// ---------------- build species and moves from gamemaster ----------------
function buildSpeciesBook(gm) {
    const lists = [gm?.pokemon, gm?.data?.pokemon].filter(Boolean);
    const out = {};
    for (const L of lists) {
        for (const p of L) {
            const id = normId(p.speciesId || p.id || p.name);
            const bs = p.baseStats || p.stats || {};
            const typesArr = p.types || [p.type1, p.type2].filter(Boolean);
            const types = (typesArr || [])
                .map((t) => String(t).replace(/^POKEMON_TYPE_/, "").toLowerCase())
                .filter(Boolean);
            out[id] = {
                atk: num(bs.atk ?? bs.attack, 200),
                def: num(bs.def ?? bs.defense, 200),
                sta: num(bs.hp ?? bs.sta ?? bs.stamina, 200),
                types: types.length ? types : ["normal"],
            };
        }
    }
    return out;
}

export function buildMoveBook(gm) {
    SPECIES = buildSpeciesBook(gm);
    const pools = [
        gm?.moves,
        gm?.data?.moves,
        gm?.combatMoves,
        gm?.data?.combatMoves,
    ].filter(Boolean);
    const out = {};
    for (const list of pools) {
        for (const m of list) {
            const id = canonMoveId(m.moveId ?? m.id ?? m.uniqueId ?? m.templateId ?? m.name);
            if (!id) continue;
            const type = String(m.type || m.pokemonType || m.moveType || "Normal")
                .replace(/^POKEMON_TYPE_/, "")
                .toLowerCase();
            const power = num(m.pvpPower ?? m.power ?? m.combatPower ?? m.damage, 3);
            let kind = "fast",
                energyGain = 0,
                energyCost = 0,
                turns = 1;
            if (m.energyDelta != null) {
                const ed = num(m.energyDelta, 0);
                if (ed > 0) {
                    kind = "fast";
                    energyGain = ed;
                }
                if (ed < 0) {
                    kind = "charged";
                    energyCost = Math.abs(ed);
                }
            }
            if (m.energyGain != null) {
                kind = "fast";
                energyGain = num(m.energyGain, 0);
            }
            if (m.energy != null) {
                kind = "charged";
                energyCost = Math.abs(num(m.energy, 0));
            }
            turns = num(m.durationTurns ?? m.turns ?? m.cooldownTurns, kind === "fast" ? 1 : 0);
            if (kind === "fast") turns = Math.max(1, Math.floor(turns) || 1);
            out[id] = { id, kind, type, power, energyGain, energyCost, turns };
        }
    }
    // Fallback TACKLE without logical assignment to satisfy older Babel
    if (!out.TACKLE) {
        out.TACKLE = {
            id: "TACKLE",
            kind: "fast",
            type: "normal",
            power: 3,
            energyGain: 8,
            energyCost: 0,
            turns: 1,
        };
    }
    MOVES = out;
    return out;
}

// ---------------- move ranking helpers ----------------
const STAB = 1.2;
const TYPES = [
    "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
    "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
];
const EFF = {};
TYPES.forEach(a => { EFF[a] = {}; TYPES.forEach(d => EFF[a][d] = 1); });
function S(a, arr, m) { arr.forEach(d => EFF[a][d] = m); }
S("fighting", ["normal", "rock", "ice", "dark", "steel"], 1.6); S("fighting", ["flying", "poison", "bug", "psychic", "fairy"], 0.625);
S("flying", ["fighting", "bug", "grass"], 1.6); S("flying", ["rock", "steel", "electric"], 0.625);
S("poison", ["grass", "fairy"], 1.6); S("poison", ["poison", "ground", "rock", "ghost"], 0.625); S("poison", ["steel"], 0.390625);
S("ground", ["poison", "rock", "steel", "fire", "electric"], 1.6); S("ground", ["bug", "grass"], 0.625); S("ground", ["flying"], 0.390625);
S("rock", ["flying", "bug", "fire", "ice"], 1.6); S("rock", ["fighting", "ground", "steel"], 0.625);
S("bug", ["grass", "psychic", "dark"], 1.6); S("bug", ["fighting", "flying", "poison", "ghost", "steel", "fire", "fairy"], 0.625);
S("ghost", ["ghost", "psychic"], 1.6); S("ghost", ["dark"], 0.625); S("ghost", ["normal"], 0.390625);
S("steel", ["rock", "ice", "fairy"], 1.6); S("steel", ["steel", "fire", "water", "electric"], 0.625);
S("fire", ["bug", "steel", "grass", "ice"], 1.6); S("fire", ["rock", "fire", "water", "dragon"], 0.625);
S("water", ["ground", "rock", "fire"], 1.6); S("water", ["water", "grass", "dragon"], 0.625);
S("grass", ["ground", "rock", "water"], 1.6); S("grass", ["flying", "poison", "bug", "steel", "fire", "grass", "dragon"], 0.625);
S("electric", ["flying", "water"], 1.6); S("electric", ["grass", "electric", "dragon"], 0.625); S("electric", ["ground"], 0.390625);
S("psychic", ["fighting", "poison"], 1.6); S("psychic", ["psychic", "steel"], 0.625); S("psychic", ["dark"], 0.390625);
S("ice", ["flying", "ground", "grass", "dragon"], 1.6); S("ice", ["steel", "fire", "water", "ice"], 0.625);
S("dragon", ["dragon"], 1.6); S("dragon", ["steel"], 0.625); S("dragon", ["fairy"], 0.390625);
S("dark", ["ghost", "psychic"], 1.6); S("dark", ["fighting", "dark", "fairy"], 0.625);
S("fairy", ["fighting", "dragon", "dark"], 1.6); S("fairy", ["poison", "steel", "fire"], 0.625);
S("normal", ["ghost"], 0.390625);

const eff = (type, defs) => (defs || []).reduce((m, t) => m * (EFF[type]?.[t] ?? 1), 1);
const dmg = (power, atk, def, stab, mult) =>
    Math.max(1, Math.floor(0.5 * num(power, 0) * (num(atk, 1) / Math.max(1, num(def, 1))) * (stab || 1) * (mult || 1)) + 1);

// ---------------- user move overrides ----------------
const USER_MOVE_OVERRIDES = {
    "dialga_origin": { fastMove: "DRAGON_BREATH", chargedMoves: ["ROAR_OF_TIME", "IRON_HEAD"] },
    "dialga": { fastMove: "DRAGON_BREATH", chargedMoves: ["ROAR_OF_TIME", "IRON_HEAD"] }
};

// Recommend moves for a species. If leagueEntry already has moves, keep them.
export function recommendMovesFor(speciesId, leagueEntry) {
    const sid = normId(speciesId);
    if (leagueEntry?.fastMove || (leagueEntry?.chargedMoves?.length))
        return {
            fastMove: leagueEntry.fastMove,
            chargedMoves: leagueEntry.chargedMoves
        };
    if (USER_MOVE_OVERRIDES[sid]) return USER_MOVE_OVERRIDES[sid];
    return { fastMove: leagueEntry?.fastMove, chargedMoves: leagueEntry?.chargedMoves || [] };
}

// Rank enemy charged vs my types; return top 2 IDs
export function dangerMovesFor(enemySpeciesId, mySpeciesId, enemyChargedIds = []) {
    const e = SPECIES[normId(enemySpeciesId)];
    const me = SPECIES[normId(mySpeciesId)];
    if (!e || !me || !enemyChargedIds?.length) return [];

    const atk = e.atk, def = me.def, myTypes = me.types || ["normal"];
    const scored = enemyChargedIds
        .map((mid) => String(mid || "").toUpperCase())
        .map((id) => MOVES[id])
        .filter(Boolean)
        .map((m) => {
            const stab = (e.types || []).includes(m.type) ? STAB : 1;
            const mult = eff(m.type, myTypes);
            const reach = Math.min(1, 50 / Math.max(1, m.energyCost || 50)); // cheap moves favored
            return { id: m.id, score: dmg(m.power, atk, def, stab, mult) * reach };
        })
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, 2).map(x => x.id);
}

// ---- helpers: pick most dangerous charged move and timing to reach it ----
function bestChargedAgainst(attackerSid, defenderSid, chargedIds = []) {
    const atkSp = SPECIES[normId(attackerSid)];
    const defSp = SPECIES[normId(defenderSid)];
    if (!atkSp || !defSp || !chargedIds.length) return null;

    const atk = atkSp.atk, def = defSp.def, dTypes = defSp.types || ["normal"];
    let best = null;
    for (const id of chargedIds) {
        const m = MOVES[String(id || "").toUpperCase()];
        if (!m) continue;
        const stab = (atkSp.types || []).includes(m.type) ? STAB : 1;
        const mult = eff(m.type, dTypes);
        const reach = Math.min(1, 50 / Math.max(1, m.energyCost || 50));
        const score = dmg(m.power, atk, def, stab, mult) * reach;
        if (!best || score > best.score) best = { id: m.id, score, energyCost: m.energyCost };
    }
    return best;
}

// Convert fast+charged IDs to a clean lookup key in MOVES
function moveKey(id) {
    return canonMoveId(id); // already normalizes (COMBAT_Vxx_MOVE_, Vxx_, whitespace, etc.)
}

// How many fast moves until the first use of a charged move?
export function fastsToFirstCharged(fastMoveId, chargedMoveId) {
    const f = MOVES[moveKey(fastMoveId)];
    const c = MOVES[moveKey(chargedMoveId)];
    if (!f || !c || !f.energyGain || !c.energyCost) return null;
    return Math.ceil(Math.max(0, c.energyCost) / Math.max(1, f.energyGain));
}

// Seconds until the first use of a charged move (0.5s per turn)
export function secondsToFirstCharged(fastMoveId, chargedMoveId) {
    const f = MOVES[moveKey(fastMoveId)];
    const nFast = fastsToFirstCharged(fastMoveId, chargedMoveId);
    if (!f || nFast == null) return null;
    const turns = nFast * Math.max(1, f.turns || 1);
    return turns * 0.5;
}

function turnsToMove(fastMoveId, chargedEnergyCost) {
    const f = MOVES[String(fastMoveId || "TACKLE").toUpperCase()] || MOVES.TACKLE;
    const gain = Math.max(1, f.energyGain || 0); // guard
    const fasts = Math.ceil(Math.max(0, chargedEnergyCost || 0) / gain);
    const turns = fasts * Math.max(1, f.turns || 1);
    const seconds = turns * 0.5; // 1 turn = 0.5s in GO PvP
    return { fasts, turns, seconds, fastMoveId: f.id };
}

// Public helper if you want to call it directly from UI
export function dangerMoveTimingFor(attacker, defender) {
    const best = bestChargedAgainst(attacker?.speciesId || attacker?.name, defender?.speciesId || defender?.name, attacker?.chargedMoves || []);
    if (!best) return null;
    const t = turnsToMove(attacker?.fastMove, best.energyCost);
    return { moveId: best.id, ...t };
}

// ---------------- adapter -> engine ----------------
function toEngineSide(src, leagueName, shields) {
    const cap = capLeague(leagueName);
    const sid = src?.speciesId || src?.name || "";
    const base = SPECIES[normId(sid)] || { atk: 200, def: 200, sta: 200, types: ["normal"] };
    const level = levelForCap(base.atk, base.def, base.sta, cap);
    const eligible = !Number.isFinite(cap) || cpAtLevel(base.atk, base.def, base.sta, 1) <= cap;
    return {
        speciesId: sid,
        name: src?.name || src?.speciesId || sid,
        fastMove: src?.fastMove,
        chargedMoves: src?.chargedMoves || [],
        shields: Math.max(0, Math.min(2, shields | 0)),
        level,
        base,
        eligible
    };
}

export function simulateDuel(
    attackerIn,
    defenderIn,
    shieldsA = 2,
    shieldsB = 2,
    _bookIgnored,
    leagueName = "Master League"
) {
    const p1 = toEngineSide(attackerIn, leagueName, shieldsA);
    const p2 = toEngineSide(defenderIn, leagueName, shieldsB);
    const cap = capLeague(leagueName);

    // If either side is illegal under the selected cap, return a neutral draw
    if (Number.isFinite(cap)) {
        const p1CP = cpAtLevel(p1.base.atk, p1.base.def, p1.base.sta, p1.level);
        const p2CP = cpAtLevel(p2.base.atk, p2.base.def, p2.base.sta, p2.level);
        if (!p1.eligible || !p2.eligible || p1CP > cap || p2CP > cap) {
            return {
                winner: "Draw",
                aHP: 0,
                bHP: 0,
                aRecommended: null,
                bRecommended: null,
                aMostDangerous: null,
                aFastMovesToDanger: null,
                aTurnsToDanger: null,
                aSecondsToDanger: null,
                bMostDangerous: null,
                bFastMovesToDanger: null,
                bTurnsToDanger: null,
                bSecondsToDanger: null,
                summary: []
            };
        }
    }

    // Run the battle
    const r = simulateBattle(p1, p2, MOVES) || {};
    const p1s = r.p1 || { hp: 0 };
    const p2s = r.p2 || { hp: 0 };
    const res = r.result || "draw";

    // Compute most dangerous charged move for each side and time to reach
    const enemyBest = bestChargedAgainst(p2.speciesId, p1.speciesId, p2.chargedMoves) || null;
    const mineBest = bestChargedAgainst(p1.speciesId, p2.speciesId, p1.chargedMoves) || null;
    const enemyTime = enemyBest ? turnsToMove(p2.fastMove, enemyBest.energyCost) : null;
    const mineTime = mineBest ? turnsToMove(p1.fastMove, mineBest.energyCost) : null;

    return {
        winner:
            res === "draw" ? "Draw" :
                res === "p1" ? (attackerIn.name || attackerIn.speciesId) :
                    res === "p2" ? (defenderIn.name || defenderIn.speciesId) : "Draw",
        aHP: num(p1s.hp, 0),
        bHP: num(p2s.hp, 0),

        // what to throw
        aRecommended: r.p1Best ?? attackerIn.chargedMoves?.[0] ?? null,
        bRecommended: r.p2Best ?? defenderIn.chargedMoves?.[0] ?? null,

        // single most dangerous charged move and timing to reach it
        aMostDangerous: mineBest ? mineBest.id : null,
        aFastMovesToDanger: mineTime ? mineTime.fasts : null,
        aTurnsToDanger: mineTime ? mineTime.turns : null,
        aSecondsToDanger: mineTime ? mineTime.seconds : null,

        bMostDangerous: enemyBest ? enemyBest.id : null,
        bFastMovesToDanger: enemyTime ? enemyTime.fasts : null,
        bTurnsToDanger: enemyTime ? enemyTime.turns : null,
        bSecondsToDanger: enemyTime ? enemyTime.seconds : null,

        summary: []
    };
}

export function bestOfThree(mine, enemy, myShields, foeShields, _bookIgnored, leagueName = "Master League") {
    const fights = mine.map(m => {
        const you = { ...m, name: m.name || m.speciesId };
        const foe = { ...enemy, name: enemy.name || enemy.speciesId };
        const r = simulateDuel(you, foe, myShields, foeShields, null, leagueName);
        const score = r.winner === you.name ? 1 : (r.winner === "Draw" ? 0 : -1);
        return { you: you.name, vs: foe.name, ...r, score };
    });

    fights.sort((a, b) => {
        const s = b.score - a.score;
        if (s) return s;
        if (b.aHP !== a.aHP) return b.aHP - a.aHP;
        return a.bHP - b.bHP;
    });

    return { best: fights[0], fights };
}
