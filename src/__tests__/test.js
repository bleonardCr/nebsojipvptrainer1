import {
  buildMoveBook,
  bestOfThree,
  secondsToFirstCharged,
  fastsToFirstCharged,
  getMoveDetails,
  recommendMovesFor,
} from "../battleCalc";

// Minimal “GM” so tests don’t depend on your big file
const gm = {
  data: {
    combatMoves: [
      // fasts
      { id: "FAST_A", type: "POKEMON_TYPE_NORMAL", power: 3, energyGain: 8, durationTurns: 1 },
      { id: "FAST_BIG", type: "POKEMON_TYPE_NORMAL", power: 3, energyGain: 13, durationTurns: 1 },
      // chargeds
      { id: "CHG_45", type: "POKEMON_TYPE_NORMAL", power: 90, energy: 45 }, // 45 energy
      { id: "CHG_55", type: "POKEMON_TYPE_NORMAL", power: 110, energy: 55 },
      // typed charged for STAB/type checks
      { id: "FIGHTING_CHARGE", type: "POKEMON_TYPE_FIGHTING", power: 100, energy: 45 },
    ],
    pokemon: [
      { speciesId: "alpha", baseStats: { atk: 200, def: 200, sta: 200 }, types: ["POKEMON_TYPE_NORMAL"] },
      { speciesId: "steelmon", baseStats: { atk: 200, def: 200, sta: 200 }, types: ["POKEMON_TYPE_STEEL"] },
      { speciesId: "alphastrong", baseStats: { atk: 230, def: 200, sta: 200 }, types: ["POKEMON_TYPE_NORMAL"] },
      { speciesId: "fighter", baseStats: { atk: 210, def: 190, sta: 200 }, types: ["POKEMON_TYPE_FIGHTING"] },
    ],
  },
};

function mk(name, fast, charged) {
  return { speciesId: name, name, fastMove: fast, chargedMoves: charged };
}

describe("battleCalc core", () => {
  beforeAll(() => buildMoveBook(gm));

  test("timing helpers: fasts/seconds to first charged", () => {
    // FAST_BIG gains 13 energy/turn; CHG_45 costs 45 => ceil(45/13)=4 fasts => 2.0s
    expect(fastsToFirstCharged("FAST_BIG", "CHG_45")).toBe(4);
    expect(secondsToFirstCharged("FAST_BIG", "CHG_45")).toBe(2.0);
  });

  test("move book exposes parsed moves", () => {
    const f = getMoveDetails("FAST_A");
    const c = getMoveDetails("CHG_45");
    expect(f.kind).toBe("fast");
    expect(c.kind).toBe("charged");
    expect(c.energyCost).toBe(45);
  });

  test("CMP (higher Atk) throws first and wins mirror-ish fight", () => {
    const A = mk("alphastrong", "FAST_BIG", ["CHG_45"]);
    const B = mk("alpha", "FAST_BIG", ["CHG_45"]);
    const { fights, best } = bestOfThree([A], B, 0, 0, undefined, "Master League");
    expect(best.you).toBe("alphastrong");
    expect(fights[0].winner).toBe("alphastrong");
  });

  test("type chart & STAB make Fighting vs Steel decisively win", () => {
    const F = mk("fighter", "FAST_BIG", ["FIGHTING_CHARGE"]);       // Fighting type + STAB
    const S = mk("steelmon", "FAST_BIG", ["CHG_55"]);                // Steel defender
    const { fights, best } = bestOfThree([F], S, 0, 0, undefined, "Master League");
    expect(best.you).toBe("fighter");
    expect(fights[0].winner).toBe("fighter");
  });

  test("recommendations include crowned Zacian metal + CC/IH", () => {
    const rec = recommendMovesFor("zacian_crowned_sword", { speciesId: "zacian_crowned_sword" });
    expect(rec.fastMove).toBe("METAL_CLAW");
    expect(rec.chargedMoves).toEqual(expect.arrayContaining(["CLOSE_COMBAT", "IRON_HEAD"]));
  });

  test("robustness: unknown charged IDs are ignored without crashing", () => {
    const A = mk("alpha", "FAST_BIG", ["CHG_45", "DOES_NOT_EXIST"]);
    const B = mk("alpha", "FAST_BIG", ["CHG_45"]);
    const { fights } = bestOfThree([A], B, 0, 0, undefined, "Master League");
    expect(fights[0].winner).toBeDefined(); // just make sure it runs
  });
});
