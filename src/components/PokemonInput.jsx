// src/components/PokemonSelect.jsx
import React from "react";

export default function PokemonSelect({
    id,
    label,
    options = [],   // array of strings (labels)
    value = "",
    onChange,       // (newLabelString or speciesId string)
    placeholder = "Start typing…"
}) {
    return (
        <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>{label}</label>
            <input
                list={`${id}-list`}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                style={{ padding: 8, width: 320 }}
            />
            <datalist id={`${id}-list`}>
                {options.map((name) => (
                    <option key={name} value={name} />
                ))}
            </datalist>
        </div>
    );
}
