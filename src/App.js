// src/App.js
import QuickMatrix from "./components/QuickMatrix";
import React, { useEffect, useMemo, useState } from "react";
import PokemonSelect from "./components/PokemonSelect";
import { dedupeBySpecies, toOptions, humanize, indexById } from "./lib/pokeList";
import { LEAGUE_NAMES, importLeague } from "./Data/leagueFiles";
import gm from "./Data/gamemaster.json";
import {
    buildMoveBook,
    bestOfThree,
    recommendMovesFor,
    eligibleForLeague
} from "./battleCalc";

/* ---------------- Small UI bits ---------------- */
function ShieldPicker({ label, value, onChange, onReset }) {
    const btn = (n) => ({
        padding: "8px 14px",
        border: "1px solid #111",
        borderRadius: 10,
        background: value === n ? "#111" : "#fff",
        color: value === n ? "#fff" : "#111",
        cursor: "pointer",
        marginRight: 8,
        minWidth: 40,
        fontWeight: 700,
    });
    const resetBtn = {
        padding: "6px 10px",
        border: "1px solid #6b7280",
        borderRadius: 10,
        background: "#fff",
        color: "#111",
        cursor: "pointer",
        marginLeft: 6,
    };
    return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 120 }}>{label}</span>
            {[0, 1, 2].map((n) => (
                <button key={n} style={btn(n)} onClick={() => onChange(n)}>
                    {n}
                </button>
            ))}
            <button style={resetBtn} onClick={onReset} title="Reset shields to 2">
                Reset
            </button>
        </div>
    );
}

function HpBar({ youHP, foeHP }) {
    const wrap = {
        height: 8,
        background: "#e5e7eb",
        borderRadius: 999,
        overflow: "hidden",
    };
    const seg = (w, good) => ({
        width: `${Math.max(0, Math.min(100, w))}%`,
        height: "100%",
        background: good ? "#16a34a" : "#dc2626",
    });
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 6,
            }}
        >
            <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>You: {youHP}%</div>
                <div style={wrap}>
                    <div style={seg(youHP, true)} />
                </div>
            </div>
            <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Foe: {foeHP}%</div>
                <div style={wrap}>
                    <div style={seg(foeHP, false)} />
                </div>
            </div>
        </div>
    );
}

function KillToggle({ dead, onToggle }) {
    const base = {
        border: "1px solid #aaa",
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        marginLeft: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        userSelect: "none",
    };
    return (
        <button
            title={dead ? "Mark alive (include in calc)" : "Mark dead (exclude from calc)"}
            onClick={onToggle}
            style={{
                ...base,
                background: dead ? "#fee2e2" : "#f3f4f6",
                color: dead ? "#991b1b" : "#111",
            }}
        >
            {dead ? "☠️ Dead" : "✖️ Exclude"}
        </button>
    );
}

/* ---------------- App ---------------- */
export default function App() {
    // build move/species book once from gamemaster
    useEffect(() => {
        try {
            buildMoveBook(gm);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const [league, setLeague] = useState(LEAGUE_NAMES[0]);

    // league data and options
    const [poolRaw, setPoolRaw] = useState([]);
    const [poolOpts, setPoolOpts] = useState([]);
    const [poolIndex, setPoolIndex] = useState({});
    const [loadError, setLoadError] = useState("");

    // teams - always show 3 boxes, only 1 required
    const empty = { id: "", label: "", dead: false };
    const [me, setMe] = useState([{ ...empty }, { ...empty }, { ...empty }]);
    const [op, setOp] = useState([{ ...empty }, { ...empty }, { ...empty }]);

    // shields
    const [myShields, setMyShields] = useState(2);
    const [opShields, setOpShields] = useState(2);

    // results
    const [results, setResults] = useState(null);

    /* ----- helpers ----- */
    function normalizeList(modDefault) {
        return Array.isArray(modDefault)
            ? modDefault
            : Array.isArray(modDefault?.pokemon)
                ? modDefault.pokemon
                : Array.isArray(modDefault?.data)
                    ? modDefault.data
                    : Array.isArray(modDefault?.list)
                        ? modDefault.list
                        : [];
    }

    function selectFromLabel(current, setFn, i, typedLabel) {
        const byLabel = poolRaw.find((x) => humanize(x.speciesId) === typedLabel);
        const byId = poolRaw.find((x) => x.speciesId === typedLabel);
        const picked = byLabel || byId;
        const next = [...current];
        next[i] = picked
            ? { id: picked.speciesId, label: humanize(picked.speciesId), dead: false }
            : { id: "", label: typedLabel, dead: false };
        setFn(next);
    }

    function toggleDead(which, index) {
        const set = which === "me" ? setMe : setOp;
        const arr = which === "me" ? me : op;
        const next = [...arr];
        next[index] = { ...next[index], dead: !next[index].dead };
        set(next);
    }

    /* ----- load league list when league changes ----- */
    useEffect(() => {
        setLoadError("");
        setResults(null);
        setMe([{ ...empty }, { ...empty }, { ...empty }]);
        setOp([{ ...empty }, { ...empty }, { ...empty }]);
        setMyShields(2);
        setOpShields(2);

        importLeague(league)
            .then((mod) => {
                const list = normalizeList(mod.default);
                const clean = dedupeBySpecies(list);

                // Hide Mega/Primal forms from every league
                const noMegas = clean.filter(
                    (x) => !/mega|primal/i.test(String(x.speciesId))
                );

                // Keep only species that can exist under the selected league cap (respects level floors)
                const filtered = noMegas.filter((x) =>
                    eligibleForLeague(x.speciesId, league)
                );

                setPoolRaw(filtered);
                setPoolOpts(toOptions(filtered).map((o) => o.label));
                setPoolIndex(indexById(filtered));
            })
            .catch((err) => setLoadError(String(err)));
    }, [league]);

    /* ----- compute myTeamAlive ONCE (top-level hook) ----- */
    const myTeamAlive = useMemo(() => {
        const map = poolIndex;
        return me
            .filter((m) => !m.dead && m.id)
            .map((s) => {
                const base = { ...map[s.id], name: s.label };
                const rec = recommendMovesFor(s.id, map[s.id]);
                // include speciesId so downstream helpers can access it
                return { ...base, speciesId: s.id, ...rec };
            });
    }, [me, poolIndex]);

    /* ----- recompute when picks/shields change ----- */
    const ready = useMemo(() => {
        const myAliveChosen = me.some((m) => !!m.id && !m.dead);
        const foeAliveChosen = op.some((o) => !!o.id && !o.dead);
        return myAliveChosen && foeAliveChosen;
    }, [me, op]);

    useEffect(() => {
        if (!ready) {
            setResults(null);
            return;
        }

        const map = poolIndex;

        // Enemies (use league-file moves if present)
        const enemiesAlive = op
            .map((s) => (s.id && !s.dead ? { ...map[s.id], name: s.label } : null))
            .filter(Boolean);

        if (!myTeamAlive.length || !enemiesAlive.length) {
            setResults(null);
            return;
        }

        const perEnemy = enemiesAlive.map((enemy) => {
            const { best, fights } = bestOfThree(
                myTeamAlive,
                enemy,
                myShields ?? 2,
                opShields ?? 2,
                undefined,
                league
            );

            // find the fight row that matches the best pick
            const bestFight = fights.find((f) => f.you === best.you) || fights[0];

            // Arrays added by simulateDuel: aDangerList and bDangerList
            const enemyDangers = Array.isArray(bestFight?.bDangerList) ? bestFight.bDangerList : [];
            const myDangers = Array.isArray(bestFight?.aDangerList) ? bestFight.aDangerList : [];

            // Backward compatible fallback if arrays are missing
            const enemyFallback =
                bestFight?.bMostDangerous != null
                    ? [
                        {
                            id: bestFight.bMostDangerous,
                            fasts: bestFight.bFastMovesToDanger,
                            turns: bestFight.bTurnsToDanger,
                            seconds: Number(bestFight.bSecondsToDanger || 0),
                        },
                    ]
                    : [];

            const myFallback =
                bestFight?.aMostDangerous != null
                    ? [
                        {
                            id: bestFight.aMostDangerous,
                            fasts: bestFight.aFastMovesToDanger,
                            turns: bestFight.aTurnsToDanger,
                            seconds: Number(bestFight.aSecondsToDanger || 0),
                        },
                    ]
                    : [];

            return {
                enemy: enemy.name,
                bestPick: best.you,
                yourRecommended: bestFight?.aRecommended || "",
                enemyDangers: enemyDangers.length ? enemyDangers : enemyFallback,
                myDangers: myDangers.length ? myDangers : myFallback,
                fights,
            };
        });

        setResults({ perEnemy });
    }, [ready, myTeamAlive, op, myShields, opShields, poolIndex, league]);

    /* ----- resets ----- */
    function resetEnemy() {
        setOp([{ ...empty }, { ...empty }, { ...empty }]);
        setResults(null);
        setOpShields(2);
        // reset both shields for simplicity
        setMyShields(2);
    }
    function resetMyTeam() {
        setMe([{ ...empty }, { ...empty }, { ...empty }]);
        setResults(null);
        setMyShields(2);
    }

    /* ----- styles ----- */
    const h1 = {
        textAlign: "center",
        fontSize: 34,
        fontWeight: 800,
        margin: "28px 0",
    };
    const box = {
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 18,
        background: "#fff",
    };
    const colWrap = {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        marginTop: 12,
    };
    const small = { fontSize: 13, color: "#6b7280" };
    const resultsGrid = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 12,
        alignItems: "start",
    };
    const pill = {
        fontSize: 12,
        background: "#f3f4f6",
        padding: "2px 8px",
        borderRadius: 999,
    };

    const DangerList = ({ list }) => {
        if (!list || list.length === 0) return <>—</>;
        return (
            <>
                {list.map((d, i) => (
                    <span key={`${d.id}-${i}`}>
                        <b>{d.id}</b> - {d.fasts} fasts - {d.turns} turns - {d.seconds.toFixed(1)}s
                        {i < list.length - 1 ? " · " : ""}
                    </span>
                ))}
            </>
        );
    };

    return (
        <div
            style={{
                maxWidth: 1200,
                margin: "0 auto",
                padding: "20px 16px",
                fontFamily:
                    "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            }}
        >
            <h1 style={h1}>Nebsoji PvP Trainer</h1>

            {/* League picker */}
            <div style={box}>
                <label style={{ fontWeight: 600, marginRight: 10 }}>
                    Select League:
                </label>
                <select value={league} onChange={(e) => setLeague(e.target.value)}>
                    {LEAGUE_NAMES.map((l) => (
                        <option key={l} value={l}>
                            {l}
                        </option>
                    ))}
                </select>
                {loadError && (
                    <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
                        Failed to load league data: {loadError}
                    </div>
                )}
            </div>

            <div style={colWrap}>
                {/* Your Team */}
                <div style={box}>
                    <h3 style={{ margin: "0 0 4px 0" }}>Your Team (3)</h3>
                    <div style={{ ...small, marginBottom: 8 }}>
                        Only <b>1</b> needs to be selected (and not ☠️ Dead) to run the calc.
                    </div>

                    {me.map((p, i) => (
                        <div key={`me-${i}`} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                                <PokemonSelect
                                    id={`me-${i}`}
                                    label={`Pok\u00E9mon ${i + 1}`}
                                    options={poolOpts}
                                    value={p.label}
                                    onChange={(val) => selectFromLabel(me, setMe, i, val)}
                                    placeholder="Start typing…"
                                />
                            </div>
                            <KillToggle dead={p.dead} onToggle={() => toggleDead("me", i)} />
                        </div>
                    ))}

                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <ShieldPicker
                            label="Your Shields:"
                            value={myShields}
                            onChange={setMyShields}
                            onReset={() => setMyShields(2)}
                        />
                        <button
                            onClick={resetMyTeam}
                            style={{
                                border: "1px solid #111",
                                background: "#fff",
                                borderRadius: 10,
                                padding: "6px 10px",
                                cursor: "pointer",
                                height: 36,
                            }}
                            title="Clear your picks and results (also resets your shields)"
                        >
                            Reset My Team
                        </button>
                    </div>

                    <div style={{ ...small, marginTop: 8 }}>
                        Use <span style={pill}>☠️ Dead</span> or{" "}
                        <span style={pill}>✖️ Exclude</span> to keep a pick visible but out of
                        the calc.
                    </div>
                </div>

                {/* Opponents */}
                <div style={box}>
                    <h3 style={{ margin: "0 0 4px 0" }}>Opponents (up to 3)</h3>
                    <div style={{ ...small, marginBottom: 8 }}>
                        Only <b>1</b> needs to be selected (and not ☠️ Dead).
                    </div>

                    {op.map((p, i) => (
                        <div key={`op-${i}`} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                                <PokemonSelect
                                    id={`op-${i}`}
                                    label={`Opponent ${i + 1}`}
                                    options={poolOpts}
                                    value={p.label}
                                    onChange={(val) => selectFromLabel(op, setOp, i, val)}
                                    placeholder="Start typing…"
                                />
                            </div>
                            <KillToggle dead={p.dead} onToggle={() => toggleDead("op", i)} />
                        </div>
                    ))}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                        <ShieldPicker
                            label="Opponent Shields:"
                            value={opShields}
                            onChange={setOpShields}
                            onReset={() => setOpShields(2)}
                        />
                        <button
                            onClick={resetEnemy}
                            style={{
                                border: "1px solid #111",
                                background: "#fff",
                                borderRadius: 10,
                                padding: "6px 10px",
                                cursor: "pointer",
                                height: 36,
                            }}
                            title="Clear enemies and results (also resets both shields)"
                        >
                            Reset Enemy
                        </button>
                    </div>

                    <div style={small}>
                        Mark a pick with <span style={pill}>☠️ Dead</span> to exclude it from
                        the calc.
                    </div>
                </div>
            </div>

            {/* Results */}
            {results && results.perEnemy?.length > 0 && (
                <div style={{ ...box, marginTop: 18 }}>
                    <h3 style={{ marginTop: 0 }}>Live Results</h3>
                    <div style={resultsGrid}>
                        {results.perEnemy.map((E, i) => (
                            <div
                                key={i}
                                style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <div style={{ fontWeight: 800 }}>
                                        vs <b>{E.enemy}</b>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            background: "#f3f4f6",
                                            padding: "2px 8px",
                                            borderRadius: 999,
                                        }}
                                    >
                                        Danger moves: <DangerList list={E.enemyDangers} />
                                    </div>
                                </div>

                                <div style={{ fontSize: 13, color: "#374151", marginTop: 6, marginBottom: 8 }}>
                                    Best of your team: <b>{E.bestPick}</b> | Your danger moves:{" "}
                                    <DangerList list={E.myDangers} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                                    {E.fights.map((o, j) => {
                                        const win = o.winner === o.you;
                                        const draw = o.winner === "Draw";
                                        const badge = {
                                            display: "inline-block",
                                            padding: "3px 8px",
                                            borderRadius: 999,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "#fff",
                                            background: draw ? "#6b7280" : win ? "#16a34a" : "#dc2626",
                                        };
                                        return (
                                            <div
                                                key={j}
                                                style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 700 }}>{o.you}</div>
                                                    <span style={badge}>{draw ? "Draw" : win ? "Win" : "Loss"}</span>
                                                </div>
                                                <HpBar youHP={o.aHP} foeHP={o.bHP} />
                                                <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>
                                                    Your rec. charged: <b>{o.aRecommended || "—"}</b>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
                        Competitive-lite sim (turns, energy, type, STAB, shields). IVs and buffs can
                        be added later - UI stays the same.
                    </div>
                </div>
            )}

            {/* Quick Matrix */}
            {myTeamAlive.length > 0 && (
                <QuickMatrix
                    league={league}
                    poolRaw={poolRaw}
                    poolIndex={poolIndex}
                    myTeamAlive={myTeamAlive}
                    myShields={myShields}
                    foeShields={opShields}
                />
            )}
        </div>
    );
}
