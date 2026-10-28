/** Pure validators for the isolated Zoroark GM API. */
export type DifficultyChoice = "all" | "easy" | "normal" | "hard";

export function allowedZoroarkRole(value: unknown): boolean {
  return value === "ca" || value === "admin";
}
export function allowedZoroarkOrigin(origin: string | null, ownOrigin: string): boolean {
  return origin === null || origin === ownOrigin || origin === "https://kaityo1221.github.io";
}
export function validateRoundRequest(input: unknown): {
  count: number; difficulty: DifficultyChoice; recent: string[];
} | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const count = row.count;
  const difficulty = row.difficulty ?? "all";
  const recent = row.recent ?? [];
  if (!Number.isInteger(count) || (count as number) < 3 || (count as number) > 12) return null;
  if (!["all", "easy", "normal", "hard"].includes(String(difficulty))) return null;
  if (typeof difficulty !== "string") return null;
  if (!Array.isArray(recent) || recent.length > 6 ||
      !recent.every(v => typeof v === "string" && /^[a-z][0-9]{2}$/.test(v))) return null;
  return {count: count as number, difficulty: difficulty as DifficultyChoice, recent: [...new Set(recent)]};
}
