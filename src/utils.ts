// --- Season Helpers ---
const currentYear = new Date().getFullYear();
export const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
export const seasonIdForYear = (year: number) => (year - 1917).toString();
export const yearForSeasonId = (seasonId: string) => parseInt(seasonId) + 1917;
export const initialSeasonId = seasonIdForYear(currentYear);
