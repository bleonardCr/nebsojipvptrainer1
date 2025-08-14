export function humanize(speciesId) {
    if (!speciesId) return "";
    const parts = speciesId.split("_");
    const base = parts.shift() || "";
    const titled = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
    const baseLabel = titled(base.replace("-", " "));
    if (!parts.length) return baseLabel;
    return `${baseLabel} (${parts.map(p => titled(p.replace("-", " "))).join(" ")})`;
}

export function dedupeBySpecies(arr) {
    const seen = new Set();
    return (arr || []).filter(x => {
        const id = x?.speciesId;
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export function toOptions(list) {
    return list
        .map(x => ({ value: x.speciesId, label: humanize(x.speciesId) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function indexById(list) {
    const map = Object.create(null);
    (list || []).forEach(x => { if (x?.speciesId) map[x.speciesId] = x; });
    return map;
}
