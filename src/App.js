import React, { useState } from 'react';
import PokemonInput from './components/PokemonInput';
import TeamDisplay from './components/TeamDisplay';
import MatchupResults from './components/MatchupResults';
import PokemonBattle from './PokemonBattle';
import './App.css';

function App() {
    const [yourTeam, setYourTeam] = useState([]);
    const [opponentTeam, setOpponentTeam] = useState([]);
    const [shields, setShields] = useState({ you: 2, opponent: 2 });
    const [results, setResults] = useState(null);
    const [pokemonData, setPokemonData] = useState([]);

    React.useEffect(() => {
        fetch('/pokemon_data.json')
            .then((response) => response.json())
            .then((data) => setPokemonData(data))
            .catch((error) => console.error('Error loading Pokémon data:', error));
    }, []);

    const handleAddPokemon = (team, pokemon, ivs, level) => {
        const updatedTeam = [...team, { ...pokemon, ivs, level }];
        if (team === yourTeam) {
            setYourTeam(updatedTeam.slice(0, 3));
        } else {
            setOpponentTeam(updatedTeam.slice(0, 3));
        }
    };

    const calculateMatchups = () => {
        const battleResults = PokemonBattle.simulateMatchups(yourTeam, opponentTeam, shields);
        setResults(battleResults);
    };

    return (
        <div className="app">
            <h1>Nebsoji PvP Trainer</h1>
            <div className="team-inputs">
                <PokemonInput
                    title="Your Team"
                    team={yourTeam}
                    pokemonData={pokemonData}
                    onAddPokemon={(pokemon, ivs, level) => handleAddPokemon(yourTeam, pokemon, ivs, level)}
                />
                <PokemonInput
                    title="Opponent Team"
                    team={opponentTeam}
                    pokemonData={pokemonData}
                    onAddPokemon={(pokemon, ivs, level) => handleAddPokemon(opponentTeam, pokemon, ivs, level)}
                />
            </div>
            <div>
                <label>
                    Your Shields:
                    <select value={shields.you} onChange={(e) => setShields({ ...shields, you: parseInt(e.target.value) })}>
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </label>
                <label>
                    Opponent Shields:
                    <select value={shields.opponent} onChange={(e) => setShields({ ...shields, opponent: parseInt(e.target.value) })}>
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </label>
            </div>
            <button onClick={calculateMatchups} disabled={yourTeam.length < 1 || opponentTeam.length < 1}>
                Calculate Matchups
            </button>
            <TeamDisplay yourTeam={yourTeam} opponentTeam={opponentTeam} />
            {results && <MatchupResults results={results} />}
        </div>
    );
}

export default App;