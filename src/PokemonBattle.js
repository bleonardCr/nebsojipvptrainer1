const typeEffectiveness = {
    Grass: { strong: ['Water', 'Ground', 'Rock'], weak: ['Fire', 'Poison', 'Flying', 'Bug', 'Dragon'] },
    Poison: { strong: ['Grass', 'Fairy'], weak: ['Poison', 'Ground', 'Rock', 'Ghost'] },
    Fighting: { strong: ['Normal', 'Rock', 'Steel', 'Ice', 'Dark'], weak: ['Flying', 'Poison', 'Psychic', 'Bug', 'Fairy'] },
    Psychic: { strong: ['Fighting', 'Poison'], weak: ['Steel', 'Psychic', 'Dark'] },
    Water: { strong: ['Fire', 'Ground', 'Rock'], weak: ['Water', 'Grass', 'Dragon'] },
    Fairy: { strong: ['Fighting', 'Dragon', 'Dark'], weak: ['Poison', 'Steel', 'Fire'] },
    Normal: { strong: [], weak: ['Rock', 'Steel'] },
    Fire: { strong: ['Grass', 'Ice', 'Bug', 'Steel'], weak: ['Fire', 'Water', 'Rock', 'Dragon'] },
    Flying: { strong: ['Grass', 'Fighting', 'Bug'], weak: ['Electric', 'Rock', 'Steel'] },
    Dragon: { strong: ['Dragon'], weak: ['Steel'] },
    Ground: { strong: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], weak: ['Grass', 'Bug'] }
};

const cpMultipliers = {
    15: 0.694,
    20: 0.7317,
    25: 0.7615,
    30: 0.7893,
    35: 0.8146,
    40: 0.838,
    45: 0.8603,
    50: 0.8815
};

const PokemonBattle = {
    calculateCP(pokemon, ivs, level) {
        const attack = pokemon.baseAttack + ivs.attack;
        const defense = pokemon.baseDefense + ivs.defense;
        const stamina = pokemon.baseStamina + ivs.stamina;
        const cpMultiplier = cpMultipliers[level] || 0.694;
        const cp = Math.floor((attack * Math.sqrt(defense) * Math.sqrt(stamina) * cpMultiplier ** 2) / 10);
        return Math.max(10, cp);
    },

    getTypeMultiplier(moveType, defenderTypes) {
        let multiplier = 1;
        defenderTypes.forEach((type) => {
            if (typeEffectiveness[moveType]?.strong.includes(type)) {
                multiplier *= 1.6;
            } else if (typeEffectiveness[moveType]?.weak.includes(type)) {
                multiplier *= 0.625;
            }
        });
        return multiplier;
    },

    simulateBattle(pokemon1, pokemon2, shields) {
        const p1 = { ...pokemon1, hp: Math.floor((pokemon1.baseStamina + pokemon1.ivs.stamina) * cpMultipliers[pokemon1.level] || 0.694) };
        const p2 = { ...pokemon2, hp: Math.floor((pokemon2.baseStamina + pokemon2.ivs.stamina) * cpMultipliers[pokemon2.level] || 0.694) };
        let p1Shields = shields.you;
        let p2Shields = shields.opponent;
        let p1Energy = 0;
        let p2Energy = 0;
        let turns = 0;

        const p1FastMove = pokemon1.fastMoves.find((m) => m.name === pokemon1.optimalMoveset[0]);
        const p2FastMove = pokemon2.fastMoves.find((m) => m.name === pokemon2.optimalMoveset[0]);
        const p1ChargedMove = pokemon1.chargedMoves.find((m) => m.name === pokemon1.optimalMoveset[1]);
        const p2ChargedMove = pokemon2.chargedMoves.find((m) => m.name === pokemon2.optimalMoveset[1]);

        while (p1.hp > 0 && p2.hp > 0 && turns < 1000) {
            const p1FastDamage = Math.floor(p1FastMove.damage * this.getTypeMultiplier(p1FastMove.type, p2.types));
            const p2FastDamage = Math.floor(p2FastMove.damage * this.getTypeMultiplier(p2FastMove.type, p1.types));
            p2.hp -= p1FastDamage;
            p1.hp -= p2FastDamage;
            p1Energy += p1FastMove.energy;
            p2Energy += p2FastMove.energy;

            if (p1Energy >= p1ChargedMove.energy && p2.hp > 0) {
                if (p2Shields > 0) {
                    p2Shields--;
                } else {
                    const damage = Math.floor(p1ChargedMove.damage * this.getTypeMultiplier(p1ChargedMove.type, p2.types));
                    p2.hp -= damage;
                }
                p1Energy -= p1ChargedMove.energy;
            }
            if (p2Energy >= p2ChargedMove.energy && p1.hp > 0) {
                if (p1Shields > 0) {
                    p1Shields--;
                } else {
                    const damage = Math.floor(p2ChargedMove.damage * this.getTypeMultiplier(p2ChargedMove.type, p1.types));
                    p1.hp -= damage;
                }
                p2Energy -= p2ChargedMove.energy;
            }

            turns++;
        }

        return {
            winner: p1.hp > 0 ? pokemon1.name : pokemon2.name,
            hpRemaining: p1.hp > 0 ? p1.hp : p2.hp,
            shieldsUsed: { you: shields.you - p1Shields, opponent: shields.opponent - p2Shields }
        };
    },

    simulateMatchups(yourTeam, opponentTeam, shields) {
        const results = [];
        let bestLead = null;
        let bestLeadScore = -Infinity;
        const switchRecommendations = {};

        yourTeam.forEach((yourPokemon) => {
            const pokemonResults = { name: yourPokemon.name, matchups: [], score: 0 };
            opponentTeam.forEach((opponentPokemon) => {
                const battle = this.simulateBattle(yourPokemon, opponentPokemon, shields);
                pokemonResults.matchups.push({
                    opponent: opponentPokemon.name,
                    winner: battle.winner,
                    hpRemaining: battle.hpRemaining,
                    shieldsUsed: battle.shieldsUsed
                });
                pokemonResults.score += battle.winner === yourPokemon.name ? 1 : -1;
            });
            results.push(pokemonResults);

            if (pokemonResults.score > bestLeadScore) {
                bestLead = yourPokemon.name;
                bestLeadScore = pokemonResults.score;
            }

            switchRecommendations[yourPokemon.name] = opponentTeam
                .map((op) => ({
                    opponent: op.name,
                    win: pokemonResults.matchups.find((m) => m.opponent === op.name).winner === yourPokemon.name
                }))
                .sort((a, b) => (b.win ? 1 : -1))
                .map((m) => m.opponent);
        });

        return { results, bestLead, switchRecommendations };
    }
};

export default PokemonBattle;