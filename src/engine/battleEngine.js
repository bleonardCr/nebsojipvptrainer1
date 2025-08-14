// src/engine/battleEngine.js
const STAB = 1.2;

const TYPES = [
    "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
    "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
];
const EFF = {}; TYPES.forEach(a => { EFF[a] = {}; TYPES.forEach(d => EFF[a][d] = 1); });
function S(a, arr, m) { arr.forEach(d => EFF[a][d] = m); }
S("fighting", ["normal", "rock", "ice", "dark", "steel"], 1.6); S("fighting", ["flying", "poison", "bug", "psychic", "fairy"], 0.625);
S("flying", ["fighting", "bug", "grass"], 1.6); S("flying", ["rock", "steel", "electric"], 0.625);
S("poison", ["grass", "fairy"], 1.6); S("poison", ["poison", "ground", "rock", "ghost"], 0.625); S("poison", ["steel"], 0.390625);
S("ground", ["poison", "rock", "steel", "fire", "electric"], 1.6); S("ground", ["bug", "grass"], 0.625); S("ground", ["flying"], 0.390625);
S("rock", ["flying", "bug", "fire", "ice"], 1.6); S("rock", ["fighting", "ground", "steel"], 0.625);
S("bug", ["grass", "psychic", "dark"], 1.6); S("bug", ["fighting", "flying", "poison", "ghost", "steel", "fire", "fairy"], 0.625);
S("ghost", ["ghost", "psychic"], 1.6); S("ghost", ["dark"], 0.625);
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

const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const eff = (type, defs) => defs.reduce((m, t) => m * (EFF[type]?.[t] ?? 1), 1);
const dmg = (power, atk, def, stab, mult) => Math.max(1, Math.floor(0.5 * n(power, 0) * (n(atk, 1) / Math.max(1, n(def, 1))) * (stab || 1) * (mult || 1)) + 1);

function buildSide(raw, MOVES) {
    const base = raw.base || { atk: 200, def: 200, sta: 200, types: ["normal"] };
    const cpm = 1;
    const types = (base.types || ["normal"]).map(t => String(t).toLowerCase());

    const fast = MOVES[String(raw.fastMove || "").toUpperCase()] || MOVES.TACKLE || {
        id: "TACKLE", kind: "fast", type: "normal", power: 3, energyGain: 8, energyCost: 0, turns: 1
    };
    const charged = (raw.chargedMoves || [])
        .map(id => MOVES[String(id || "").toUpperCase()])
        .filter(Boolean);

    const Atk = base.atk * cpm;
    const Def = base.def * cpm;
    const HP = Math.max(1, Math.floor(base.sta * cpm));

    return {
        name: raw.name || raw.speciesId,
        types,
        Atk, Def, MaxHP: HP, HP,
        fast, charged,
        energy: 0,
        shields: Math.max(0, raw.shields | 0),
        cd: (fast?.turns || 1)
    };
}

function turnsToCharge(user, needed) {
    const gain = n(user.fast?.energyGain, 0);
    const t = Math.max(1, user.fast?.turns || 1);
    if (gain <= 0) return 999;
    const cycles = Math.ceil(needed / gain);
    return cycles * t;
}
function expectedFastDamage(user, foe, turns) {
    const fm = user.fast; if (!fm) return 0;
    const stab = user.types.includes(fm.type) ? STAB : 1;
    const mult = eff(fm.type, foe.types);
    const per = dmg(fm.power, user.Atk, foe.Def, stab, mult);
    const lands = Math.floor(turns / (fm.turns || 1));
    return per * Math.max(0, lands);
}

function shouldShield(defender, incoming, attacker) {
    const shieldsLeft = defender.shields | 0;
    if (shieldsLeft <= 0) return false;

    const stabIn = attacker.types.includes(incoming.type) ? STAB : 1;
    const multIn = eff(incoming.type, defender.types);
    const hit = dmg(incoming.power, attacker.Atk, defender.Def, stabIn, multIn);
    if (hit >= defender.HP) return true;

    const H = 12;
    const hpAfter = Math.max(0, defender.HP - hit);
    const myDmgNoShield = expectedFastDamage(defender, attacker, H * (hpAfter > 0 ? 1 : 0));
    const myDmgShield = expectedFastDamage(defender, attacker, H);

    let swingBonus = 0;
    if (defender.charged?.length) {
        const best = defender.charged.reduce((best, m) => {
            const da = dmg(best?.power || 0, defender.Atk, attacker.Def, defender.types.includes(best?.type) ? STAB : 1, eff(best?.type, attacker.types));
            const db = dmg(m.power, defender.Atk, attacker.Def, defender.types.includes(m.type) ? STAB : 1, eff(m.type, attacker.types));
            return (!best || db > da) ? m : best;
        }, null);
        const need = Math.max(0, (best?.energyCost || 45) - defender.energy);
        const tt = turnsToCharge(defender, need);
        if (tt <= H) {
            const myHit = dmg(best.power, defender.Atk, attacker.Def, defender.types.includes(best.type) ? STAB : 1, eff(best.type, attacker.types));
            if (hpAfter <= defender.MaxHP * 0.35) swingBonus = myHit * 0.5;
        }
    }
    const prudence = shieldsLeft === 1 ? 1.15 : 1.0;
    return (myDmgShield + swingBonus) * prudence > myDmgNoShield;
}

function chooseThrow(user, foe) {
    const ready = (user.charged || []).filter(m => user.energy >= (m.energyCost || 45));
    if (!ready.length) return null;

    const realDmg = (m) => {
        const stab = user.types.includes(m.type) ? STAB : 1;
        const mult = eff(m.type, foe.types);
        return dmg(m.power, user.Atk, foe.Def, stab, mult);
    };

    const nuke = [...ready].sort((a, b) => realDmg(b) - realDmg(a))[0];
    const bait = [...ready].sort((a, b) => (a.energyCost || 45) - (b.energyCost || 45))[0];

    if ((foe.shields | 0) <= 0) return nuke;
    if (realDmg(nuke) >= foe.HP) return nuke;

    const evNuke = 0 - (nuke.energyCost || 45) * 0.05;
    const evBaitNow = 0 - (bait.energyCost || 45) * 0.02;

    const toNukeAfterBait = Math.max(0, (nuke.energyCost || 45) - (user.energy - (bait.energyCost || 45)));
    const toNukeTurns = turnsToCharge(user, toNukeAfterBait);
    const followReward = realDmg(nuke) * (toNukeTurns <= 8 ? 0.7 : 0.4);

    return (evBaitNow + followReward > evNuke) ? bait : nuke;
}

export function simulateBattle(p1raw, p2raw, MOVES) {
    const A = buildSide(p1raw, MOVES);
    const B = buildSide(p2raw, MOVES);

    const pickBest = (att, def) => {
        const best = (att.charged || []).reduce((best, m) => {
            const val = dmg(m.power, att.Atk, def.Def, att.types.includes(m.type) ? STAB : 1, eff(m.type, def.types));
            return (!best || val > best._val) ? { ...m, _val: val } : best;
        }, null);
        return best?.id || null;
    };
    const p1Best = pickBest(A, B);
    const p2Best = pickBest(B, A);

    A.cd = A.fast?.turns || 1;
    B.cd = B.fast?.turns || 1;

    let t = 0;
    const MAX_TURNS = 2000;

    while (A.HP > 0 && B.HP > 0 && t < MAX_TURNS) {
        t++;

        A._shieldsLeft = A.shields;
        B._shieldsLeft = B.shields;

        const aReady = (A.charged || []).some(m => A.energy >= (m.energyCost || 45));
        const bReady = (B.charged || []).some(m => B.energy >= (m.energyCost || 45));

        if (aReady || bReady) {
            const aFirst = aReady && (!bReady || (A.Atk >= B.Atk));
            const doThrow = (att, def) => {
                const move = chooseThrow(att, def);
                if (!move) return;
                if (shouldShield(def, move, att)) {
                    def.shields = Math.max(0, (def.shields | 0) - 1);
                } else {
                    const hit = dmg(move.power, att.Atk, def.Def, att.types.includes(move.type) ? STAB : 1, eff(move.type, def.types));
                    def.HP = Math.max(0, def.HP - hit);
                }
                att.energy -= (move.energyCost || 45);
                att.cd = att.fast?.turns || 1;
            };

            if (aFirst) { doThrow(A, B); if (B.HP <= 0) break; if (bReady) { doThrow(B, A); if (A.HP <= 0) break; } }
            else { doThrow(B, A); if (A.HP <= 0) break; if (aReady) { doThrow(A, B); if (B.HP <= 0) break; } }
            continue;
        }

        A.cd--; if (A.cd <= 0) {
            const hit = dmg(A.fast.power, A.Atk, B.Def, A.types.includes(A.fast.type) ? STAB : 1, eff(A.fast.type, B.types));
            B.HP = Math.max(0, B.HP - hit);
            A.energy = Math.min(100, A.energy + (A.fast.energyGain || 0));
            A.cd = A.fast.turns || 1;
        }
        if (B.HP <= 0) break;

        B.cd--; if (B.cd <= 0) {
            const hit = dmg(B.fast.power, B.Atk, A.Def, B.types.includes(B.fast.type) ? STAB : 1, eff(B.fast.type, A.types));
            A.HP = Math.max(0, A.HP - hit);
            B.energy = Math.min(100, B.energy + (B.fast.energyGain || 0));
            B.cd = B.fast.turns || 1;
        }
        if (A.HP <= 0) break;
    }

    const result =
        A.HP <= 0 && B.HP <= 0 ? "draw" :
            A.HP <= 0 ? "p2" :
                B.HP <= 0 ? "p1" :
                    (A.HP === B.HP ? "draw" : (A.HP > B.HP ? "p1" : "p2"));

    return {
        result,
        p1: { hp: Math.round((A.HP / A.MaxHP) * 100) },
        p2: { hp: Math.round((B.HP / B.MaxHP) * 100) },
        p1Best, p2Best
    };
}
