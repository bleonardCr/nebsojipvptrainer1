import React, { useState } from 'react';

function PokemonInput({ title, team, pokemonData, onAddPokemon }) {
    const [name, setName] = useState('');
    const [attackIV, setAttackIV] = useState(0);
    const [defenseIV, setDefenseIV] = useState(0);
    const [staminaIV, setStaminaIV] = useState(0);
    const [level, setLevel] = useState(15);

    const handleAdd = () => {
        if (team.length >= 3) return;
        const pokemon = pokemonData.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (pokemon) {
            onAddPokemon(pokemon, { attack: attackIV, defense: defenseIV, stamina: staminaIV }, level);
            setName('');
            setAttackIV(0);
            setDefenseIV(0);
            setStaminaIV(0);
            setLevel(15);
        }
    };

    return (
        <div>
            <h2>{title}</h2>
            <input
                type="text"
                placeholder="Pokémon Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <div>
                <label>
                    Attack IV:
                    <input
                        type="number"
                        min="0"
                        max="15"
                        value={attackIV}
                        onChange={(e) => setAttackIV(parseInt(e.target.value) || 0)}
                    />
                </label>
                <label>
                    Defense IV:
                    <input
                        type="number"
                        min="0"
                        max="15"
                        value={defenseIV}
                        onChange={(e) => setDefenseIV(parseInt(e.target.value) || 0)}
                    />
                </label>
                <label>
                    Stamina IV:
                    <input
                        type="number"
                        min="0"
                        max="15"
                        value={staminaIV}
                        onChange={(e) => setStaminaIV(parseInt(e.target.value) || 0)}
                    />
                </label>
                <label>
                    Level:
                    <select value={level} onChange={(e) => setLevel(parseInt(e.target.value))}>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                        <option value={30}>30</option>
                    </select>
                </label>
            </div>
            <button onClick={handleAdd} disabled={!name || team.length >= 3}>
                Add Pokémon
            </button>
        </div>
    );
}

export default PokemonInput;