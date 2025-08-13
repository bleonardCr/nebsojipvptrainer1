import React, { useState, useEffect } from 'react';
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
    const [selectedLeague, setSelectedLeague] = useState('Great');
    const [filteredPokemon, setFilteredPokemon] = useState([]);

    useEffect(() => {
        fetch('/pokemon_data.json')
            .then((response) => response.json())
            .then((data) => {
                setPokemonData(data);
                setFilteredPokemon(data.filter(p => p.leagues.includes(selectedLeague)));
            })
            .catch((error) => console.error('Error loading Pokémon data:', error));
    }, [selectedLeague]);

    const leagueCPcaps = {
        Great: 1500,
        Ultra: 2500,
        Master: 10000
    };

    const optimalIVs = {
        Great: { attack: 0, defense: 15, stamina: 15 },
        Ultra: { attack: 15, defense: 15, stamina: 15 },
        Master: { attack: 15, defense: 15, stamina: 15 }
    };

    const handleAddPokemon = (team, pokemon, level) => {
        const ivs = optimalIVs[selectedLeague];
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
            <label>
                Select League:
                <select value={selectedLeague} onChange={(e) => setSelectedLeague(e.target.value)}>
                    <option value="Great">Great League</option>
                    <option value="Ultra">Ultra League</option>
                    <option value="Master">Master League</option>
                </select>
            </label>
            <div className="team-inputs">
                <PokemonInput
                    title="Your Team"
                    team={yourTeam}
                    pokemonData={filteredPokemon}
                    onAddPokemon={(pokemon, level) => handleAddPokemon(yourTeam, pokemon, level)}
                />
                <PokemonInput
                    title="Opponent Team"
                    team={opponentTeam}
                    pokemonData={filteredPokemon}
                    onAddPokemon={(pokemon, level) => handleAddPokemon(opponentTeam, pokemon, level)}
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