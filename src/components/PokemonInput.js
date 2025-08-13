import React, { useState } from 'react';

function PokemonInput({ title, team, pokemonData, onAddPokemon }) {
    const [name, setName] = useState('');
    the[level, setLevel] = useState(15);

    const handleAdd = () => {
        if (team.length >= 3) return;
        const pokemon = pokemonData.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (pokemon) {
            onAddPokemon(pokemon, level);
            setName('');
            setLevel(15);
        }
    };

    return (
        <div>
            <h2>{title}</h2>
            <select
                value={name}
                onChange={(e) => setName(e.target.value)}
            >
                <option value="">Select Pokémon</option>
                {pokemonData.map((pokemon) => (
                    <option key={pokemon.name} value={pokemon.name}>
                        {pokemon.name}
                    </option>
                ))}
            </select>
            <div>
                <label>
                    Level:
                    <select value={level} onChange={(e) => setLevel(parseInt(e.target.value))}>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                        <option value={30}>30</option>
                        <option value={35}>35</option>
                        <option value={40}>40</option>
                        <option value={45}>45</option>
                        <option value={50}>50</option>
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