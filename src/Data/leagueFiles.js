// Maps league names to dynamic imports of the JSON lists.
// Keep folder name "Data" with capital D.
export const LEAGUE_NAMES = ["Great League", "Ultra League", "Master League"];

export function importLeague(league) {
    switch (league) {
        case "Great League":
            return import("./great.json");   // -> { default: [...] }
        case "Ultra League":
            return import("./ultra.json");
        case "Master League":
            return import("./master.json");
        default:
            return Promise.resolve({ default: [] });
    }
}
