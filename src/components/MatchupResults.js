import React from 'react';

function MatchupResults({ results }) {
    return (
        <div>
            <h2>Matchup Results</h2>
            <p><strong>Best Lead Pokémon:</strong> {results.bestLead}</p>
            {results.results.map((pokemonResult, index) => (
                <div key={index}>
                    <h3>{pokemonResult.name}</h3>
                    <p>Score: {pokemonResult.score}</p>
                    <p>Switch Recommendations: Face {results.switchRecommendations[pokemonResult.name].join(', ')}</p>
                    <ul>
                        {pokemonResult.matchups.map((matchup, i) => (
                            <li key={i}>
                                vs {matchup.opponent}: {matchup.winner === pokemonResult.name ? 'Win' : 'Loss'} (HP Remaining: {matchup.hpRemaining}, Shields Used: You {matchup.shieldsUsed.you}, Opponent {matchup.shieldsUsed.opponent})
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export default MatchupResults;