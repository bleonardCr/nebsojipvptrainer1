import React from "react";

export default function PokemonSelect({
    id,
    label,
    options = [],  // array of strings (labels)
    value = "",
    onChange,       // (typedString)
    placeholder = "Start typing..."
}) {
    const [open, setOpen] = React.useState(false);
    const [highlight, setHighlight] = React.useState(-1);
    const inputRef = React.useRef(null);

    // keep a local query so we can control opening behavior
    const [query, setQuery] = React.useState(value || "");
    React.useEffect(() => { setQuery(value || ""); }, [value]);

    const wordStartMatch = React.useCallback((label, q) => {
        const s = String(q || "").trim().toLowerCase();
        if (!s) return false;
        const tokens = String(label || "")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean);
        return tokens.some(t => t.startsWith(s));
    }, []);

    const filtered = React.useMemo(() => {
        const s = query.trim();
        if (s.length < 2) return [];            // avoid huge autofill
        return options
            .filter(name => wordStartMatch(name, s))
            .slice(0, 30);                         // cap results
    }, [options, query, wordStartMatch]);

    const selectIndex = (idx) => {
        if (idx < 0 || idx >= filtered.length) return;
        const chosen = filtered[idx];
        onChange?.(chosen);
        setQuery(chosen);
        setOpen(false);
        setHighlight(-1);
    };

    const handleChange = (e) => {
        const v = e.target.value;
        setQuery(v);
        onChange?.(v);
        setOpen(v.trim().length >= 2);
        setHighlight(-1);
    };

    const handleKeyDown = (e) => {
        if (!open && e.key !== "ArrowDown" && e.key !== "Enter") return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight(h => Math.min((h < 0 ? -1 : h) + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            if (open && highlight >= 0) {
                e.preventDefault();
                selectIndex(highlight);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
        }
    };

    const closeSoon = () => setTimeout(() => setOpen(false), 100);

    return (
        <div style={{ marginBottom: 12, position: "relative", width: 320 }}>
            <label htmlFor={id} style={{ display: "block", marginBottom: 6 }}>{label}</label>
            <input
                id={id}
                ref={inputRef}
                value={query}
                placeholder={placeholder}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setOpen(query.trim().length >= 2)}
                onBlur={closeSoon}
                autoComplete="off"
                style={{ padding: 8, width: "100%" }}
                role="combobox"
                aria-expanded={open}
                aria-controls={`${id}-listbox`}
                aria-autocomplete="list"
            />

            {open && filtered.length > 0 && (
                <ul
                    id={`${id}-listbox`}
                    role="listbox"
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        maxHeight: 220,
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        background: "#fff",
                        zIndex: 20,
                        margin: 0,
                        padding: 0,
                        listStyle: "none"
                    }}
                >
                    {filtered.map((name, i) => (
                        <li
                            key={name}
                            role="option"
                            aria-selected={i === highlight}
                            onMouseDown={(e) => { e.preventDefault(); selectIndex(i); }}
                            onMouseEnter={() => setHighlight(i)}
                            style={{
                                padding: "8px 10px",
                                cursor: "pointer",
                                background: i === highlight ? "#eee" : "#fff"
                            }}
                        >
                            {name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
