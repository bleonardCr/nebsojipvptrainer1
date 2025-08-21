import React, { useMemo } from "react";
import {
    bestOfThree,
    recommendMovesFor,
    secondsToFirstCharged,
    fastsToFirstCharged,
} from "../battleCalc";
import { humanize } from "../lib/pokeList";

const DEFAULT_MASTER_META = [
    "Dragonite", "Dialga", "Groudon", "Ho-Oh", "Kyogre", "Kyurem", "Mewtwo", "Palkia", "Reshiram", "Zekrom",
    "Garchomp", "Metagross", "Melmetal", "Rhyperior", "Excadrill", "Landorus (Therian)",
    "Zacian", "Zamazenta", "Togekiss", "Yveltal", "Xerneas", "Hydreigon"
];

function baseName(s) { return String(s || "").split(" (")[0].trim().toLowerCase(); }

export default function QuickMatrix({
    league,
    poolRaw,
    poolIndex,
    myTeamAlive,
    myShields = 2,
    foeShields = 2,
    opponents = DEFAULT_MASTER_META
}) {
    const rows = useMemo(() => {
        if (!myTeamAlive?.length) return [];

        const resolve = (label) => {
            const target = baseName(label);
            const hit = poolRaw.find(x => {
                const h = baseName(humanize(x.speciesId));
                return h === target || h.includes(target) || target.includes(h);
            });
            return hit ? { id: hit.speciesId, label: humanize(hit.speciesId) } : null;
        };

        const lead = myTeamAlive[0];

        return opponents
            .map(resolve)
            .filter(Boolean)
            .map(({ id, label }) => {
                const enemyBase = poolIndex[id];
                const enemy = { ...enemyBase, name: label, ...recommendMovesFor(id, enemyBase) };

                const { best, fights } = bestOfThree(myTeamAlive, enemy, myShields, foeShields, undefined, league);
                const leadFight = fights.find(f => f.you === lead.name) || fights[0];

                const swap = leadFight.winner === lead.name || leadFight.winner === "Draw" ? "Stay" : "Swap";
                const bestSwitch =
                    swap === "Swap"
                        ? (fights.find(f => f.you !== lead.name && f.winner === f.you)?.you || best.you)
                        : "-";

                const dangerMove = leadFight.bRecommended || "-";

                const enemyFast = enemy.fastMove || "TACKLE";
                const fasts = fastsToFirstCharged(enemyFast, dangerMove);
                const secs = secondsToFirstCharged(enemyFast, dangerMove);
                const ttfText = fasts != null && secs != null ? `${fasts} (~${secs}s)` : "-";

                return {
                    opponent: label,
                    result: leadFight.winner === "Draw" ? "Draw" : (leadFight.winner === lead.name ? "Win" : "Loss"),
                    swap,
                    bestSwitch,
                    dangerMove,
                    timeToDanger: ttfText
                };
            })
            .sort((a, b) => a.opponent.localeCompare(b.opponent));
    }, [league, poolRaw, poolIndex, myTeamAlive, myShields, foeShields, opponents]);

    if (!rows.length) return null;

    const cell = { padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13 };
    const boldIf = (cond) => (cond ? { fontWeight: 800 } : null);
    const swapPill = (text, isSwap) => (
        <span
            style={{
                fontWeight: isSwap ? 800 : 400,
                padding: "2px 8px",
                borderRadius: 999,
                background: isSwap ? "#fee2e2" : "transparent",
                color: isSwap ? "#991b1b" : "inherit"
            }}
        >
            {text}
        </span>
    );

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Quick Matrix - Master Top 20</h3>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={{ ...cell, textAlign: "left" }}>Opponent</th>
                            <th style={{ ...cell, textAlign: "left" }}>Lead result</th>
                            <th style={{ ...cell, textAlign: "left" }}>Swap or stay</th>
                            <th style={{ ...cell, textAlign: "left" }}>Best safe switch</th>
                            <th style={{ ...cell, textAlign: "left" }}>Danger move</th>
                            <th style={{ ...cell, textAlign: "left" }}>Fast moves to danger (sec)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const isSwap = r.swap === "Swap";
                            return (
                                <tr key={r.opponent}>
                                    <td style={cell}>{r.opponent}</td>
                                    <td style={cell}>{r.result}</td>
                                    <td style={{ ...cell }}>{swapPill(r.swap, isSwap)}</td>
                                    <td style={{ ...cell, ...boldIf(isSwap) }}>{isSwap ? r.bestSwitch : "-"}</td>
                                    <td style={cell}>{r.dangerMove}</td>
                                    <td style={cell}>{r.timeToDanger}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                Lead is your first alive slot. Times assume 0.5s per turn.
            </div>
        </div>
    );
}
