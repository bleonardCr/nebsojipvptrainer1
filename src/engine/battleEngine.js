// src/engine/battleEngine.js
// Normalize PokemonBattle exports into a named export: simulateBattle

import defExport from "../PokemonBattle";

let simulateBattle = null;

// default export is a function
if (typeof defExport === "function") {
    simulateBattle = defExport;
}
// default export is an object that contains simulateBattle
else if (defExport && typeof defExport.simulateBattle === "function") {
    simulateBattle = defExport.simulateBattle;
}
// some builds end up as { default: fn }
else if (defExport && typeof defExport.default === "function") {
    simulateBattle = defExport.default;
}

if (!simulateBattle) {
    throw new Error(
        "PokemonBattle.js must export a simulateBattle function (default or as a property)."
    );
}

export { simulateBattle };
