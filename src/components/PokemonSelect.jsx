import React, { useMemo, useState, useEffect } from "react";

export default function PokemonSelect({
    id,
    label,
    options = [],          // "Dialga", "Dialga (Origin)", "Reshiram", …
    value = "",
    onChange,              // (label: string)
    placeholder = "Start typing…",
    maxSuggestions = 5,
}) {
    const [term, setTerm] = useState("");
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (!value && !editing) setTerm("");
    }, [value, editing]);

    const baseName = (s) => String(s || "").split(" (")[0].trim();
    const norm = (s) => String(s || "").toLowerCase();

    const suggestions = useMemo(() => {
        const q = norm(term).trim();
        if (!q) return [];
        return options
            .filter((opt) => norm(baseName(opt)).startsWith(q))
            .slice(0, maxSuggestions);
    }, [options, term, maxSuggestions]);

    const inputValue = editing ? term : value;

    function accept(label) {
        if (!label) return;
        onChange?.(label);
        setEditing(false);
        setTerm("");
    }

    function handleChange(e) {
        const v = e.target.value;
        if (options.includes(v)) {
            accept(v);
            return;
        }
        setEditing(true);
        setTerm(v);
    }

    function handleKeyDown(e) {
        if ((e.key === "Enter" || e.key === "Tab") && suggestions.length === 1) {
            e.preventDefault();
            accept(suggestions[0]);
        }
    }

    function handleBlur() {
        setEditing(false);
        setTerm("");
    }

    return (
        <div style={{ marginBottom: 12 }}>
            {label && (
                <label htmlFor={id} style={{ display: "block", marginBottom: 6 }}>
                    {label}
                </label>
            )}

            <input
                id={id}
                list={`${id}-list`}
                value={inputValue}
                placeholder={placeholder}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setEditing(true)}
                onBlur={handleBlur}
                autoComplete="off"
                style={{
                    width: 320,              // keeps clear “X” happy
                    padding: 8,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                }}
            />

            <datalist id={`${id}-list`}>
                {suggestions.map((name) => (
                    <option key={name} value={name} />
                ))}
            </datalist>
        </div>
    );
}
