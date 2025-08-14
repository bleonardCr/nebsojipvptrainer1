// src/battleCalc.js
// Turn-accurate PvP lite sim with shields, CMP, STAB, types, and robust GM parsing.

let SPECIES = {};  // speciesId -> { atk, def, sta, types: [...] }
let MOVES = {};  // MOVE_ID   -> { id, kind:"fast"|"charged", type, power, energyGain, energyCost, turns }

// ---------------- Utilities ----------------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function canonMoveId(s) {
    if (!s) return "";
    return String(s)
        .trim()
        .replace(/^COMBAT_V\d+_MOVE_/i, "")
        .replace(/^V\d+_/i, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toUpperCase();
}
function normId(s) { return String(s || '').toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, ''); }
function capLeague(league) {
    const map = { "Great League": 1500, "Ultra League": 2500, "Master League": Infinity };
    return typeof league === "string" ? (map[league] ?? Infinity) : (Number.isFinite(league) ? Number(league) : Infinity);
}
function tcase(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function normType(s) {
    if (!s) return null;
    const raw = String(s).replace(/^POKEMON_TYPE_/, '').replace(/_/g, ' ').trim().toLowerCase();
    const T = tcase(raw);
    return TYPES.includes(T) ? T : null;
}

// ---------------- CP multipliers (0.5 levels to 50) ----------------
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
    CPM.length = 100; CPM.fill(0);
    for (let i = 0; i < table.length; i++) CPM[i + 1] = table[i];
})();
function cp(a, d, s, c) { return Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * c * c) / 10); }
function levelForCap(baseAtk, baseDef, baseSta, cap) {
    if (!isFinite(cap)) return 99; // level ~50
    let best = 1;
    for (let i = 1; i < CPM.length; i++) {
        const c = CPM[i]; if (!c) continue;
        if (cp(baseAtk * c, baseDef * c, baseSta * c, 1) <= cap) best = i;
    }
    return best;
}

// ---------------- Type chart & damage ----------------
const TYPES = [
    "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
    "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"
];
const EFF = {};
TYPES.forEach(a => { EFF[a] = {}; TYPES.forEach(d => EFF[a][d] = 1); });
function S(atk, arr, m) { arr.forEach(d => EFF[atk][d] = m); }
S("Fighting", ["Normal", "Rock", "Ice", "Dark", "Steel"], 1.6); S("Fighting", ["Flying", "Poison", "Bug", "Psychic", "Fairy"], 0.625);
S("Flying", ["Fighting", "Bug", "Grass"], 1.6); S("Flying", ["Rock", "Steel", "Electric"], 0.625);
S("Poison", ["Grass", "Fairy"], 1.6); S("Poison", ["Poison", "Ground", "Rock", "Ghost"], 0.625); S("Poison", ["Steel"], 0.390625);
S("Ground", ["Poison", "Rock", "Steel", "Fire", "Electric"], 1.6); S("Ground", ["Bug", "Grass"], 0.625); S("Ground", ["Flying"], 0.390625);
S("Rock", ["Flying", "Bug", "Fire", "Ice"], 1.6); S("Rock", ["Fighting", "Ground", "Steel"], 0.625);
S("Bug", ["Grass", "Psychic", "Dark"], 1.6); S("Bug", ["Fighting", "Flying", "Poison", "Ghost", "Steel", "Fire", "Fairy"], 0.625);
S("Ghost", ["Ghost", "Psychic"], 1.6); S("Ghost", ["Dark"], 0.625);
S("Steel", ["Rock", "Ice", "Fairy"], 1.6); S("Steel", ["Steel", "Fire", "Water", "Electric"], 0.625);
S("Fire", ["Bug", "Steel", "Grass", "Ice"], 1.6); S("Fire", ["Rock", "Fire", "Water", "Dragon"], 0.625);
S("Water", ["Ground", "Rock", "Fire"], 1.6); S("Water", ["Water", "Grass", "Dragon"], 0.625);
S("Grass", ["Ground", "Rock", "Water"], 1.6); S("Grass", ["Flying", "Poison", "Bug", "Steel", "Fire", "Grass", "Dragon"], 0.625);
S("Electric", ["Flying", "Water"], 1.6); S("Electric", ["Grass", "Electric", "Dragon"], 0.625); S("Electric", ["Ground"], 0.390625);
S("Psychic", ["Fighting", "Poison"], 1.6); S("Psychic", ["Psychic", "Steel"], 0.625); S("Psychic", ["Dark"], 0.390625);
S("Ice", ["Flying", "Ground", "Grass", "Dragon"], 1.6); S("Ice", ["Steel", "Fire", "Water", "Ice"], 0.625);
S("Dragon", ["Dragon"], 1.6); S("Dragon", ["Steel"], 0.625); S("Dragon", ["Fairy"], 0.390625);
S("Dark", ["Ghost", "Psychic"], 1.6); S("Dark", ["Fighting", "Dark", "Fairy"], 0.625);
S("Fairy", ["Fighting", "Dragon", "Dark"], 1.6); S("Fairy", ["Poison", "Steel", "Fire"], 0.625);

const STAB = 1.2;
function eff(multType, defendTypes) { let m = 1; for (const t of defendTypes) { m *= (EFF[multType]?.[t] ?? 1); } return m; }
function dmg(power, atk, def, stab, effm) {
    const raw = 0.5 * num(power, 0) * (num(atk, 1) / Math.max(1, num(def, 1))) * (stab || 1) * (effm || 1);
    return Math.max(1, Math.floor(raw) + 1); // PvP rounding (+1)
}

// ---------------- Books ----------------
function buildSpeciesBook(gm) {
    const lists = [
        gm?.pokemon, gm?.data?.pokemon, gm?.species, gm?.pokemonList, gm?.pokemonSettings
    ].filter(Boolean);
    const out = {};
    for (const L of lists) {
        for (const p of L) {
            const id = normId(p.speciesId || p.pokemonId || p.templateId || p.id || p.name);
            if (!id) continue;
            const bs = p.baseStats || p.stats || {};
            const atk = num(p.baseAttack ?? bs.atk ?? bs.attack ?? p.attack, 200);
            const def = num(p.baseDefense ?? bs.def ?? bs.defense ?? p.defense, 200);
            const sta = num(p.baseStamina ?? bs.sta ?? bs.stamina ?? p.stamina, 200);
            const typesArr = p.types || [p.type1, p.type2].filter(Boolean);
            const types = (typesArr || []).map(normType).filter(Boolean);
            out[id] = { atk, def, sta, types: types.length ? types : ["Normal"] };
        }
    }
    return out;
}

export function buildMoveBook(gm) {
    SPECIES = buildSpeciesBook(gm);
    const pools = [gm?.moves, gm?.combatMoves, gm?.data?.moves, gm?.data?.combatMoves, gm?.moveList].filter(Boolean);
    const out = {};

    for (const list of pools) {
        for (const m of list) {
            const rawId = m.moveId ?? m.id ?? m.uniqueId ?? m.templateId ?? m.name ?? "";
            const id = canonMoveId(rawId);
            if (!id) continue;

            const type = normType(m.type || m.pokemonType || m.moveType) || "Normal";
            const power = num(m.pvpPower ?? m.power ?? m.combatPower ?? m.damage, 3);

            let kind = "fast", energyGain = 0, energyCost = 0, turns = 1;
            if (m.energyDelta != null) { const ed = num(m.energyDelta, 0); if (ed > 0) { kind = "fast"; energyGain = ed; } if (ed < 0) { kind = "charged"; energyCost = Math.abs(ed); } }
            if (m.energyGain != null) { kind = "fast"; energyGain = num(m.energyGain, 0); }
            if (m.energy != null) { kind = "charged"; energyCost = Math.abs(num(m.energy, 0)); }
            turns = num(m.durationTurns ?? m.turns ?? m.cooldownTurns, kind === "fast" ? 1 : 0);
            if (kind === "fast") turns = Math.max(1, Math.floor(turns) || 1);

            if (kind === "fast" && energyGain <= 0) { console.warn(`[PvP] fast ${id} missing energyGain; using 8.`); energyGain = 8; }
            if (kind === "charged" && energyCost <= 0) { console.warn(`[PvP] charged ${id} missing energy; using 45.`); energyCost = 45; }

            const mv = { id, kind, type, power, energyGain, energyCost, turns };
            if (!out[id] || power > out[id].power) out[id] = mv;
        }
    }

    // safe fallback fast move
    out.TACKLE = out.TACKLE || { id: "TACKLE", kind: "fast", type: "Normal", power: 3, energyGain: 8, energyCost: 0, turns: 1 };

    MOVES = out;
    return out;
}

// ---------------- Build fighters at league cap ----------------
function buildFighter(src, leagueName) {
    const cap = capLeague(leagueName);
    const sid = normId(src.speciesId || src.name);
    const base = SPECIES[sid] || { atk: 200, def: 200, sta: 200, types: ["Normal"] };

    const lvl = levelForCap(base.atk, base.def, base.sta, cap);
    const cpm = CPM[lvl] || CPM[99];

    const Atk = base.atk * cpm;
    const Def = base.def * cpm;
    const HP = Math.max(1, Math.floor(base.sta * cpm));

    const fast = MOVES[canonMoveId(src.fastMove)] || MOVES.TACKLE;
    const chargedMoves = (src.chargedMoves || [])
        .map(canonMoveId)
        .map(id => MOVES[id])
        .filter(Boolean);

    return {
        name: src.name || src.speciesId,
        speciesId: sid,
        types: base.types,
        Atk, Def, MaxHP: HP, HP,
        fast, chargedMoves,
        energy: 0,
        cooldown: 0 // turns until next fast connects
    };
}

// pick charged with highest *actual* damage vs current foe
function bestCharged(att, def) {
    let best = null, bestVal = -Infinity;
    for (const m of (att.chargedMoves || [])) {
        if (!m || m.kind !== "charged") continue;
        const stab = att.types.includes(m.type) ? STAB : 1;
        const mult = eff(m.type, def.types);
        const val = dmg(m.power, att.Atk, def.Def, stab, mult);
        if (val > bestVal) { bestVal = val; best = m; }
    }
    return best;
}

// ---------------- Simulate one duel ----------------
export function simulateDuel(attackerIn, defenderIn, shieldsA = 2, shieldsB = 2, _book = MOVES, leagueName = "Master League") {
    const A = buildFighter(attackerIn, leagueName);
    const B = buildFighter(defenderIn, leagueName);

    const recA = bestCharged(A, B)?.id || null;
    const recB = bestCharged(B, A)?.id || null;

    let aSh = Math.max(0, shieldsA | 0), bSh = Math.max(0, shieldsB | 0);
    let t = 0; const MAX_TURNS = 2000; const log = [];

    function tryFast(user, foe) {
        if (!user.fast) return;
        user.cooldown--;
        if (user.cooldown <= 0) {
            // apply fast damage & energy when the move "lands"
            const stab = user.types.includes(user.fast.type) ? STAB : 1;
            const mult = eff(user.fast.type, foe.types);
            const hit = dmg(user.fast.power, user.Atk, foe.Def, stab, mult);
            foe.HP = Math.max(0, foe.HP - hit);
            user.energy = Math.min(100, user.energy + num(user.fast.energyGain, 0));
            user.cooldown = user.fast.turns; // reset cooldown
        }
    }

    function canThrow(u) { return (u.chargedMoves || []).some(m => u.energy >= (m.energyCost || 45)); }
    function chooseThrow(u, foe) {
        // choose move with max actual damage that is ready
        let pick = null, best = -Infinity;
        for (const m of (u.chargedMoves || [])) {
            if (u.energy < (m.energyCost || 45)) continue;
            const stab = u.types.includes(m.type) ? STAB : 1;
            const mult = eff(m.type, foe.types);
            const val = dmg(m.power, u.Atk, foe.Def, stab, mult);
            if (val > best) { best = val; pick = m; }
        }
        return pick;
    }
    function shouldShield(foe, incoming, shieldsLeft) {
        if (shieldsLeft <= 0) return false;
        const stab = foe.types.includes(incoming.type) ? STAB : 1;
        const mult = eff(incoming.type, foe.types);
        const hit = dmg(incoming.power, (/*att not used*/1) * foe.Atk || foe.Atk, foe.Def, stab, mult); // not exact, still OK
        // KO or big chunk thresholds (tuned by remaining shields)
        const th = shieldsLeft === 2 ? 0.32 : 0.45; // with 2 shields be more liberal, with 1 shield be stricter
        return hit >= foe.HP || hit >= foe.MaxHP * th;
    }

    // initialize fast cooldowns so first fast lands at its "turns"
    A.cooldown = A.fast?.turns || 1;
    B.cooldown = B.fast?.turns || 1;

    while (A.HP > 0 && B.HP > 0 && t < MAX_TURNS) {
        t++;

        // if both have a charged ready at the start of a turn, CMP decides order
        const aReady = canThrow(A);
        const bReady = canThrow(B);

        if (aReady || bReady) {
            const aFirst = aReady && (!bReady || (A.Atk >= B.Atk));

            const resolve = (user, foe, shieldsRef, who) => {
                const move = chooseThrow(user, foe);
                if (!move) return; // shouldn't happen, but safe
                let shielded = false;
                if (shouldShield(foe, move, (who === "A") ? bSh : aSh)) {
                    if (who === "A") bSh--; else aSh--;
                    shielded = true;
                } else {
                    const stab = user.types.includes(move.type) ? STAB : 1;
                    const mult = eff(move.type, foe.types);
                    const hit = dmg(move.power, user.Atk, foe.Def, stab, mult);
                    foe.HP = Math.max(0, foe.HP - hit);
                }
                user.energy -= (move.energyCost || 45);
                user.cooldown = user.fast?.turns || 1; // using a charged consumes the turn; fast window resets
                log.push(`${who} throws ${move.id}${shielded ? " (shielded)" : ""}`);
            };

            if (aFirst) {
                resolve(A, B, () => bSh, "A");
                if (B.HP <= 0) break;
                if (bReady) resolve(B, A, () => aSh, "B");
                if (A.HP <= 0) break;
            } else {
                resolve(B, A, () => aSh, "B");
                if (A.HP <= 0) break;
                if (aReady) resolve(A, B, () => bSh, "A");
                if (B.HP <= 0) break;
            }

            // no fast damage on a turn you throw a charged (already handled via cooldown reset)
            continue;
        }

        // otherwise, apply fast progression this turn
        tryFast(A, B);
        if (B.HP <= 0) break;
        tryFast(B, A);
        if (A.HP <= 0) break;
    }

    const winner =
        A.HP <= 0 && B.HP <= 0 ? "Draw" :
            A.HP <= 0 ? B.name :
                B.HP <= 0 ? A.name :
                    (A.HP === B.HP ? "Draw" : (A.HP > B.HP ? A.name : B.name));

    return {
        winner,
        aHP: Math.round((A.HP / A.MaxHP) * 100),
        bHP: Math.round((B.HP / B.MaxHP) * 100),
        aRecommended: recA,
        bRecommended: recB,
        summary: log.slice(0, 12)
    };
}

// ---------------- Best-of-three wrapper (UI expects this) ----------------
export function bestOfThree(mine, enemy, myShields, foeShields, _book = MOVES, leagueName = "Master League") {
    const fights = mine.map(m => {
        const you = { ...m, name: m.name || m.speciesId };
        const foe = { ...enemy, name: enemy.name || enemy.speciesId };
        const r = simulateDuel(you, foe, myShields, foeShields, MOVES, leagueName);
        const score = r.winner === you.name ? 1 : (r.winner === "Draw" ? 0 : -1);
        return { you: you.name, vs: foe.name, ...r, score };
    });
    fights.sort((a, b) => (b.score - a.score) || (b.aHP - a.aHP) || (b.bHP - a.bHP));
    return { best: fights[0], fights };
}
