import React from 'react';
import PokemonBattle from '../PokemonBattle';

function TeamDisplay({ yourTeam, opponentTeam }) {
    return (
        <div>
            <h2>Your Team</h2>
            {yourTeam.map((pokemon, index) => (
                <div key={index}>
                    {pokemon.name} (CP: {PokemonBattle.calculateCP(pokemon, pokemon.ivs, pokemon.level)}) - Moves: {pokemon.optimalMoveset.join(', ')}
                </div>
            ))}
            <h2>Opponent Team</h2>
            {opponentTeam.map((pokemon, index) => (
                <div key={index}>
                    {pokemon.name} (CP: {PokemonBattle.calculateCP(pokemon, pokemon.ivs, pokemon.level)}) - Moves: {pokemon.optimalMoveset.join(', ')}
                </div>
            ))}
        </div>
    );
}

export default TeamDisplay;