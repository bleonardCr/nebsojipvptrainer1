// PvP lite sim (turn order: fast first, then charged by CMP). Includes timing helpers.

let SPECIES = {}; // speciesId -> { atk, def, sta, types: [...] }
let MOVES = {};   // MOVE_ID -> { id, kind: "fast"|"charged", type, power, energyGain, energyCost, turns }

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
function normId(s) {
    return String(s || "").toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
}
function tcase(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function normType(s) {
    if (!s) return null;
    const raw = String(s).replace(/^POKEMON_TYPE_/, "").replace(/_/g, " ").trim().toLowerCase();
    const T = tcase(raw);
    return TYPES.includes(T) ? T : null;
}
function capLeague(league) {
    const map = { "Great League": 1500, "Ultra League": 2500, "Master League": Infinity };
    return typeof league === "string" ? (map[league] ?? Infinity) : (Number.isFinite(league) ? Number(league) : Infinity);
}

/* ----- CPM / level ----- */
const CPM = [];
(function fillCPM() {
    const t = [
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
    for (let i = 0; i < t.length; i++) CPM[i + 1] = t[i];
})();
function cp(a, d, s, c) { return Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * c * c) / 10); }
function levelForCap(baseAtk, baseDef, baseSta, cap) {
    if (!isFinite(cap)) return 99;
    let best = 1;
    for (let i = 1; i < CPM.length; i++) {
        const c = CPM[i]; if (!c) continue;
        if (cp(baseAtk * c, baseDef * c, baseSta * c, 1) <= cap) best = i;
    }
    return best;
}

/* ----- Types / damage ----- */
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
function eff(multType, defTypes) { let m = 1; for (const t of defTypes) { m *= (EFF[multType]?.[t] ?? 1); } return m; }
function dmg(power, atk, def, stab, effm) {
    const raw = 0.5 * num(power, 0) * (num(atk, 1) / Math.max(1, num(def, 1))) * (stab || 1) * (effm || 1);
    return Math.max(1, Math.floor(raw) + 1);
}

/* ----- Books from GM ----- */
function buildSpeciesBook(gm) {
    const lists = [gm?.pokemon, gm?.data?.pokemon, gm?.species, gm?.pokemonList, gm?.pokemonSettings].filter(Boolean);
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

            if (m.energyDelta != null) {
                const ed = num(m.energyDelta, 0);
                if (ed > 0) { kind = "fast"; energyGain = ed; }
                if (ed < 0) { kind = "charged"; energyCost = Math.abs(ed); }
            }
            if (m.energyGain != null) { kind = "fast"; energyGain = num(m.energyGain, 0); }
            if (m.energy != null) { kind = "charged"; energyCost = Math.abs(num(m.energy, 0)); }
            turns = num(m.durationTurns ?? m.turns ?? m.cooldownTurns, kind === "fast" ? 1 : 0);
            if (kind === "fast") turns = Math.max(1, Math.floor(turns) || 1);

            if (kind === "fast" && energyGain <= 0) { energyGain = 8; }
            if (kind === "charged" && energyCost <= 0) { energyCost = 45; }

            const mv = { id, kind, type, power, energyGain, energyCost, turns };
            if (!out[id] || power > out[id].power) out[id] = mv;
        }
    }

    out.TACKLE = out.TACKLE || { id: "TACKLE", kind: "fast", type: "Normal", power: 3, energyGain: 8, energyCost: 0, turns: 1 };
    out.GENERIC_CHARGED = { id: "GENERIC_CHARGED", kind: "charged", type: "Normal", power: 70, energyCost: 45 };
    out.GENERIC_CHARGED2 = { id: "GENERIC_CHARGED2", kind: "charged", type: "Normal", power: 90, energyCost: 55 };

    MOVES = out;
    return out;
}

/* ----- Fighters ----- */
function buildFighter(src, leagueName) {
    const cap = capLeague(leagueName);
    const sid = normId(src.speciesId || src.name);
    const base = SPECIES[sid] || { atk: 200, def: 200, sta: 200, types: ["Normal"] };

    const lvl = levelForCap(base.atk, base.def, base.sta, cap);
    const cpm = CPM[lvl] || CPM[99];

    const Atk = base.atk * cpm;
    const Def = base.def * cpm;
    const HP = Math.max(1, Math.floor(base.sta * cpm));

    const fastRaw = typeof src.fastMove === "string" ? src.fastMove : (src.fastMove?.id || "");
    const fast = MOVES[canonMoveId(fastRaw)] || MOVES.TACKLE;

    const chargedMoves = [];
    const rawList = Array.isArray(src.chargedMoves) ? src.chargedMoves : [];
    for (const entry of rawList) {
        const id = typeof entry === "string" ? entry : (entry?.id || "");
        const mv = MOVES[canonMoveId(id)];
        if (mv && mv.kind === "charged") chargedMoves.push(mv);
    }
    if (chargedMoves.length === 0) {
        chargedMoves.push(MOVES.GENERIC_CHARGED, MOVES.GENERIC_CHARGED2);
    }

    return {
        name: src.name || src.speciesId,
        speciesId: sid,
        types: base.types,
        Atk, Def, MaxHP: HP, HP,
        fast, chargedMoves,
        energy: 0,
        cooldown: 0
    };
}

/* ----- Move recommendations (editable) ----- */
const MOVE_RECS = {
    dragonite: { fastMove: "DRAGON_BREATH", chargedMoves: ["DRAGON_CLAW", "SUPERPOWER"] },
    dialga: { fastMove: "DRAGON_BREATH", chargedMoves: ["IRON_HEAD", "DRACO_METEOR"] },
    dialga_origin: { fastMove: "DRAGON_BREATH", chargedMoves: ["ROAR_OF_TIME", "IRON_HEAD"] },
    garchomp: { fastMove: "MUD_SHOT", chargedMoves: ["EARTH_POWER", "OUTRAGE"] },
    kyurem: { fastMove: "DRAGON_BREATH", chargedMoves: ["GLACIATE", "DRAGON_CLAW"] },
    palkia: { fastMove: "DRAGON_BREATH", chargedMoves: ["AQUA_TAIL", "DRACO_METEOR"] },
    reshiram: { fastMove: "DRAGON_BREATH", chargedMoves: ["FUSION_FLARE", "DRACO_METEOR"] },
    zekrom: { fastMove: "DRAGON_BREATH", chargedMoves: ["FUSION_BOLT", "CRUNCH"] },

    groudon: { fastMove: "MUD_SHOT", chargedMoves: ["PRECIPICE_BLADES", "FIRE_PUNCH"] },
    kyogre: { fastMove: "WATERFALL", chargedMoves: ["SURF", "THUNDER"] },
    ho_oh: { fastMove: "INCINERATE", chargedMoves: ["SACRED_FIRE", "BRAVE_BIRD"] },
    mewtwo: { fastMove: "PSYCHO_CUT", chargedMoves: ["PSYSTRIKE", "SHADOW_BALL"] },

    metagross: { fastMove: "BULLET_PUNCH", chargedMoves: ["METEOR_MASH", "EARTHQUAKE"] },
    melmetal: { fastMove: "THUNDER_SHOCK", chargedMoves: ["DOUBLE_IRON_BASH", "ROCK_SLIDE"] },
    rhyperior: { fastMove: "SMACK_DOWN", chargedMoves: ["ROCK_WRECKER", "SURF"] },
    excadrill: { fastMove: "MUD_SHOT", chargedMoves: ["DRILL_RUN", "ROCK_SLIDE"] },
    landorus_therian: { fastMove: "MUD_SHOT", chargedMoves: ["STONE_EDGE", "EARTHQUAKE"] },

    togekiss: { fastMove: "CHARM", chargedMoves: ["ANCIENT_POWER", "FLAMETHROWER"] },
    yveltal: { fastMove: "SNARL", chargedMoves: ["OBLIVION_WING", "DARK_PULSE"] },
    xerneas: { fastMove: "GEOMANCY", chargedMoves: ["MOONBLAST", "THUNDER"] },
    hydreigon: { fastMove: "DRAGON_BREATH", chargedMoves: ["BRUTAL_SWING", "DRAGON_PULSE"] },

    zacian_crowned_sword: { fastMove: "METAL_CLAW", chargedMoves: ["CLOSE_COMBAT", "IRON_HEAD"] },
    zamazenta_crowned_shield: { fastMove: "METAL_CLAW", chargedMoves: ["CLOSE_COMBAT", "IRON_HEAD"] },

    primarina: { fastMove: "CHARM", chargedMoves: ["MOONBLAST", "HYDRO_PUMP"] },
};

export function recommendMovesFor(_speciesId, baseEntry) {
    if (baseEntry?.fastMove || (baseEntry?.chargedMoves?.length)) return {};
    const sid = normId(_speciesId || baseEntry?.speciesId);
    const rec = MOVE_RECS[sid];
    if (rec) return rec;
    return { fastMove: "TACKLE", chargedMoves: ["GENERIC_CHARGED", "GENERIC_CHARGED2"] };
}

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

/* ----- Duel ----- */
function shouldShield(attacker, defender, incomingMove, shieldsLeft) {
    if (shieldsLeft <= 0) return false;
    const stab = attacker.types.includes(incomingMove.type) ? STAB : 1;
    const mult = eff(incomingMove.type, defender.types);
    const hit = dmg(incomingMove.power, attacker.Atk, defender.Def, stab, mult);
    const threshold = shieldsLeft === 2 ? 0.32 : 0.45;
    return hit >= defender.HP || hit >= defender.MaxHP * threshold;
}

export function simulateDuel(attackerIn, defenderIn, shieldsA = 2, shieldsB = 2, _book = MOVES, leagueName = "Master League") {
    const A = buildFighter(attackerIn, leagueName);
    const B = buildFighter(defenderIn, leagueName);

    const recA = bestCharged(A, B)?.id || null;
    const recB = bestCharged(B, A)?.id || null;

    let aSh = Math.max(0, shieldsA | 0), bSh = Math.max(0, shieldsB | 0);
    let t = 0; const MAX_TURNS = 2000; const log = [];

    function progressFast(user, foe) {
        if (!user.fast) return;
        user.cooldown--;
        if (user.cooldown <= 0) {
            const stab = user.types.includes(user.fast.type) ? STAB : 1;
            const mult = eff(user.fast.type, foe.types);
            const hit = dmg(user.fast.power, user.Atk, foe.Def, stab, mult);
            foe.HP = Math.max(0, foe.HP - hit);
            user.energy = Math.min(100, user.energy + (user.fast.energyGain || 0));
            user.cooldown = user.fast.turns || 1;
        }
    }

    function canThrow(u) { return (u.chargedMoves || []).some(m => m && u.energy >= (m.energyCost || 45)); }
    function chooseThrow(u, foe) {
        let pick = null, best = -Infinity;
        for (const m of (u.chargedMoves || [])) {
            if (!m) continue;
            if (u.energy < (m.energyCost || 45)) continue;
            const stab = u.types.includes(m.type) ? STAB : 1;
            const mult = eff(m.type, foe.types);
            const val = dmg(m.power, u.Atk, foe.Def, stab, mult);
            if (val > best) { best = val; pick = m; }
        }
        return pick;
    }

    function doThrow(attacker, defender, who) {
        const move = chooseThrow(attacker, defender);
        if (!move) return;
        let shielded = false;
        if (who === "A" ? shouldShield(attacker, defender, move, bSh)
            : shouldShield(attacker, defender, move, aSh)) {
            if (who === "A") bSh--; else aSh--;
            shielded = true;
        } else {
            const stab = attacker.types.includes(move.type) ? STAB : 1;
            const mult = eff(move.type, defender.types);
            const hit = dmg(move.power, attacker.Atk, defender.Def, stab, mult);
            defender.HP = Math.max(0, defender.HP - hit);
        }
        attacker.energy -= (move.energyCost || 45);
        attacker.cooldown = attacker.fast?.turns || 1;
        log.push(`${who} throws ${move.id}${shielded ? " (shielded)" : ""}`);
    }

    A.cooldown = A.fast?.turns || 1;
    B.cooldown = B.fast?.turns || 1;

    while (A.HP > 0 && B.HP > 0 && t < MAX_TURNS) {
        t++;

        progressFast(A, B);
        if (B.HP <= 0) break;
        progressFast(B, A);
        if (A.HP <= 0) break;

        const aReady = canThrow(A);
        const bReady = canThrow(B);
        if (aReady || bReady) {
            const aFirst = aReady && (!bReady || (A.Atk >= B.Atk));
            if (aFirst) {
                doThrow(A, B, "A");
                if (B.HP <= 0) break;
                if (bReady) { doThrow(B, A, "B"); if (A.HP <= 0) break; }
            } else {
                doThrow(B, A, "B");
                if (A.HP <= 0) break;
                if (aReady) { doThrow(A, B, "A"); if (B.HP <= 0) break; }
            }
        }
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

/* ----- Timing helpers ----- */
export function getMoveDetails(id) {
    if (!id) return null;
    const key = canonMoveId(id);
    return MOVES[key] || null;
}
export function secondsToFirstCharged(fastId, chargedId) {
    const f = getMoveDetails(fastId);
    const c = getMoveDetails(chargedId);
    if (!f || !c || f.kind !== "fast" || c.kind !== "charged") return null;
    const fastsNeeded = Math.ceil((c.energyCost || 45) / Math.max(1, f.energyGain || 8));
    const turns = fastsNeeded * (f.turns || 1);
    return Number((turns * 0.5).toFixed(1)); // 1 PvP turn = 0.5s
}
export function fastsToFirstCharged(fastId, chargedId) {
    const f = getMoveDetails(fastId);
    const c = getMoveDetails(chargedId);
    if (!f || !c || f.kind !== "fast" || c.kind !== "charged") return null;
    return Math.ceil((c.energyCost || 45) / Math.max(1, f.energyGain || 8));
}

/* ----- Best-of-three ----- */
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
