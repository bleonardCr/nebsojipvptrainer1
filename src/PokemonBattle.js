// src/PokemonBattle.js
// Small, resilient PvP-lite simulator with defensive stat parsing.
// Exports both a named and default function: simulateBattle

/* ----------------- helpers ----------------- */
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// Try to pull atk/def/sta regardless of how league/GM shaped them.
function coerceStats(src = {}) {
    const s = src.stats || src.baseStats || src.base || {};

    const atk = num(
        s.attack ?? s.atk ?? src.attack ?? src.atk ?? src.baseAttack,
        200
    );
    const def = num(
        s.defense ?? s.def ?? src.defense ?? src.def ?? src.baseDefense,
        200
    );
    const sta = num(
        s.stamina ?? s.sta ?? s.hp ?? src.stamina ?? src.sta ?? src.baseStamina,
        200
    );

    return { atk, def, sta };
}

function pickFast(src = {}) {
    // Accepts either {fastMove: "XXX"} or {fast: {id:...}} or raw GM keys
    if (src.fast && typeof src.fast === "object") return src.fast;
    if (src.fastMove && typeof src.fastMove === "string")
        return { id: src.fastMove, power: num(src.fastPower, 3), energyGain: num(src.fastEnergyGain, 8), turns: num(src.fastTurns, 1), type: src.fastType || "Normal", kind: "fast" };
    // As a last resort, use TACKLE-like default so we never crash
    return { id: "TACKLE", power: 3, energyGain: 8, turns: 1, type: "Normal", kind: "fast" };
}

function pickChargedArray(src = {}) {
    // Accepts {chargedMoves: ["A","B"]} or {chargedMoves: [{...}]}
    const list = Array.isArray(src.chargedMoves) ? src.chargedMoves : [];
    const out = [];
    for (const m of list) {
        if (!m) continue;
        if (typeof m === "string") {
            out.push({ id: m, energyCost: num(src[`${m}_energy`], 45), power: num(src[`${m}_power`], 90), type: src[`${m}_type`] || "Normal", kind: "charged" });
        } else {
            out.push({
                id: m.id || m.moveId || "UNKNOWN",
                energyCost: num(m.energyCost ?? m.energy ?? Math.abs(m.energyDelta), 45),
                power: num(m.power ?? m.pvpPower ?? m.combatPower, 90),
                type: m.type || m.moveType || "Normal",
                kind: "charged",
            });
        }
    }
    // Always have something so the UI can show a recommendation
    if (!out.length) out.push({ id: "GENERIC_CHARGED", energyCost: 45, power: 90, type: "Normal", kind: "charged" });
    return out;
}

/* -------- tiny type chart (enough for relative scoring) -------- */
const TYPES = [
    "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
    "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"
];
const EFF = {};
for (const a of TYPES) { EFF[a] = {}; for (const d of TYPES) EFF[a][d] = 1; }
function S(atk, arr, m) { for (const d of arr) EFF[atk][d] = m; }
// (same mappings as earlier lite engine)
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
const eff = (type, defendTypes = []) =>
    (defendTypes || []).reduce((m, t) => m * (EFF[type]?.[t] ?? 1), 1);
const dmg = (power, atk, def, stab, effm) =>
    Math.max(1, Math.floor(0.5 * num(power, 0) * (num(atk, 1) / Math.max(1, num(def, 1))) * (stab || 1) * (effm || 1)) + 1);

/* ----------------- simulator ----------------- */
export function simulateBattle(attackerSrc = {}, defenderSrc = {}, shieldsA = 2, shieldsB = 2) {
    // 1) Normalize fighters
    const Astats = coerceStats(attackerSrc);
    const Bstats = coerceStats(defenderSrc);

    const A = {
        name: attackerSrc.name || attackerSrc.speciesId || "You",
        types: attackerSrc.types || attackerSrc.type || [],
        Atk: Astats.atk,
        Def: Bstats.def ? Astats.def : Astats.def, // keep shape; (typo-safe fallback)
        MaxHP: Math.max(1, Math.floor(Astats.sta)),
        HP: Math.max(1, Math.floor(Astats.sta)),
        fast: pickFast(attackerSrc),
        chargedMoves: pickChargedArray(attackerSrc),
        energy: 0,
        cooldown: 0,
    };

    const B = {
        name: defenderSrc.name || defenderSrc.speciesId || "Foe",
        types: defenderSrc.types || defenderSrc.type || [],
        Atk: Bstats.atk,
        Def: Bstats.def,
        MaxHP: Math.max(1, Math.floor(Bstats.sta)),
        HP: Math.max(1, Math.floor(Bstats.sta)),
        fast: pickFast(defenderSrc),
        chargedMoves: pickChargedArray(defenderSrc),
        energy: 0,
        cooldown: 0,
    };

    // If something still came in broken, just bail gracefully
    if (!A.MaxHP || !B.MaxHP) {
        return {
            winner: "Draw",
            aHP: 0,
            bHP: 0,
            aRecommended: A.chargedMoves?.[0]?.id || null,
            bRecommended: B.chargedMoves?.[0]?.id || null,
            summary: ["Invalid stats; treating as draw."],
        };
    }

    // Pre-compute “recommended” by raw damage vs the other’s typing
    const bestCharged = (user, foe) => {
        let best = null, bestVal = -Infinity;
        for (const m of user.chargedMoves || []) {
            const stab = (user.types || []).includes(m.type) ? STAB : 1;
            const mult = eff(m.type, foe.types || []);
            const val = dmg(m.power, user.Atk, foe.Def, stab, mult);
            if (val > bestVal) { bestVal = val; best = m; }
        }
        return best;
    };

    const recA = bestCharged(A, B)?.id || null;
    const recB = bestCharged(B, A)?.id || null;

    // Tiny turn engine: charged when ready (CMP = higher Atk), otherwise fast
    const canThrow = (u) => (u.chargedMoves || []).some((m) => u.energy >= (m.energyCost || 45));
    const chooseThrow = (u, foe) => {
        let pick = null, best = -Infinity;
        for (const m of u.chargedMoves || []) {
            if (u.energy < (m.energyCost || 45)) continue;
            const stab = (u.types || []).includes(m.type) ? STAB : 1;
            const mult = eff(m.type, foe.types || []);
            const val = dmg(m.power, u.Atk, foe.Def, stab, mult);
            if (val > best) { best = val; pick = m; }
        }
        return pick;
    };
    const shouldShield = (foe, incoming, shieldsLeft) => {
        if (shieldsLeft <= 0) return false;
        const stab = (foe.types || []).includes(incoming.type) ? STAB : 1;
        const mult = eff(incoming.type, foe.types || []);
        const hit = dmg(incoming.power, foe.Atk || 1, foe.Def, stab, mult);
        const th = shieldsLeft === 2 ? 0.32 : 0.45;
        return hit >= foe.HP || hit >= foe.MaxHP * th;
    };

    A.cooldown = A.fast?.turns || 1;
    B.cooldown = B.fast?.turns || 1;

    let aSh = Math.max(0, shieldsA | 0), bSh = Math.max(0, shieldsB | 0);
    const log = [];
    let t = 0;
    const MAX_TURNS = 2000;

    while (A.HP > 0 && B.HP > 0 && t < MAX_TURNS) {
        t++;

        const aReady = canThrow(A);
        const bReady = canThrow(B);

        if (aReady || bReady) {
            const aFirst = aReady && (!bReady || A.Atk >= B.Atk);

            const resolve = (user, foe, who) => {
                const move = chooseThrow(user, foe);
                if (!move) return;
                let shielded = false;
                if (shouldShield(foe, move, who === "A" ? bSh : aSh)) {
                    if (who === "A") bSh--; else aSh--;
                    shielded = true;
                } else {
                    const stab = (user.types || []).includes(move.type) ? STAB : 1;
                    const mult = eff(move.type, foe.types || []);
                    foe.HP = Math.max(0, foe.HP - dmg(move.power, user.Atk, foe.Def, stab, mult));
                }
                user.energy -= (move.energyCost || 45);
                user.cooldown = user.fast?.turns || 1;
                log.push(`${who} throws ${move.id}${shielded ? " (shielded)" : ""}`);
            };

            if (aFirst) {
                resolve(A, B, "A");
                if (B.HP <= 0) break;
                if (bReady) resolve(B, A, "B");
                if (A.HP <= 0) break;
            } else {
                resolve(B, A, "B");
                if (A.HP <= 0) break;
                if (aReady) resolve(A, B, "A");
                if (B.HP <= 0) break;
            }
            continue;
        }

        // progress fast
        const doFast = (user, foe) => {
            user.cooldown--;
            if (user.cooldown <= 0 && user.fast) {
                const stab = (user.types || []).includes(user.fast.type) ? STAB : 1;
                const mult = eff(user.fast.type || "Normal", foe.types || []);
                foe.HP = Math.max(0, foe.HP - dmg(user.fast.power, user.Atk, foe.Def, stab, mult));
                user.energy = Math.min(100, user.energy + num(user.fast.energyGain, 8));
                user.cooldown = user.fast.turns || 1;
            }
        };

        doFast(A, B);
        if (B.HP <= 0) break;
        doFast(B, A);
        if (A.HP <= 0) break;
    }

    const winner =
        A.HP <= 0 && B.HP <= 0 ? "Draw" :
            A.HP <= 0 ? A.name === "You" ? "Foe" : B.name :
                B.HP <= 0 ? A.name :
                    A.HP === B.HP ? "Draw" : (A.HP > B.HP ? A.name : B.name);

    return {
        winner,
        aHP: Math.round((A.HP / A.MaxHP) * 100),
        bHP: Math.round((B.HP / B.MaxHP) * 100),
        aRecommended: recA,
        bRecommended: recB,
        summary: log.slice(0, 12),
    };
}

export default simulateBattle;
