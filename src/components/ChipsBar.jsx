// src/components/ChipsBar.jsx
import React, { useEffect, useState } from "react";
import { getChips, togglePinned } from "../lib/recent";

export default function ChipsBar({ league, onPick, tick = 0, title = "Quick picks" }) {
    const [chips, setChips] = useState({ pinned: [], recents: [] });

    useEffect(() => {
        setChips(getChips(league));
    }, [league, tick]);

    const wrap = {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8,
        alignItems: "center",
    };
    const chip = (pinned) => ({
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: pinned ? "#fff7ed" : "#f9fafb",
        cursor: "pointer",
        fontSize: 13,
    });
    const star = {
        fontSize: 14,
        color: "#f59e0b",
        cursor: "pointer",
        userSelect: "none",
    };
    const label = { fontWeight: 600, color: "#6b7280", marginRight: 6, fontSize: 12 };

    function onStar(e, name) {
        e.stopPropagation();
        togglePinned(league, name);
        setChips(getChips(league));
    }

    if (!chips.pinned.length && !chips.recents.length) return null;

    return (
        <div style={wrap}>
            <span style={label}>{title}:</span>
            {chips.pinned.map((name) => (
                <span key={`pin-${name}`} style={chip(true)} onClick={() => onPick(name)} title="Pick">
                    <span>{name}</span>
                    <span title="Unpin" style={star} onClick={(e) => onStar(e, name)}>★</span>
                </span>
            ))}
            {chips.recents.map((name) => (
                <span key={`rec-${name}`} style={chip(false)} onClick={() => onPick(name)} title="Pick">
                    <span>{name}</span>
                    <span title="Pin" style={star} onClick={(e) => onStar(e, name)}>☆</span>
                </span>
            ))}
        </div>
    );
}
