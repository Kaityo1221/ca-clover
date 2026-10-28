/**
 * Local GM game logic. Client-only prototype; NOT a security boundary.
 * Do not assume that protecting a React route prevents users from inspecting
 * public JavaScript or creating an independent game.
 */
export type Difficulty = "easy" | "normal" | "hard";
export type DifficultyChoice = Difficulty | "all";
export type AppRole = "admin" | "ca" | "pending" | null | undefined;
export type Pair = {
  id: string;
  level: Difficulty;
  a: string;
  b: string;
  common: string;
  difference: string;
};

/** Returned only by the CA-authorized API. Do not ship a full game catalog to browsers. */
export type Round = {
  pair: Pair;
  majority: string;
  minority: string;
  wolf: number;
  prompts: string[];
  count: number;
};



export const TALK_TOPICS = [
  "このポケモンの見た目で印象的なのは？",
  "どんな場所で出会いそう？",
  "相棒にしたらどんな感じ？",
  "進化についてどう思う？",
  "強そうな技を使いそう？",
  "Pokémon GOではどんな印象？",
  "初めて見たとき、どう感じた？",
  "このポケモンを一言で説明すると？",
  "ほかのポケモンとの違いは？",
  "バトルで活躍しそう？",
  "好きなところをひとつ教えて！",
  "ジェスチャーで表現するなら？",
] as const;

/** UI admission rule only: the real GM API must independently verify JWT and active CA role. */
export function isZoroarkGameMasterRole(role: AppRole): boolean {
  return role === "ca" || role === "admin";
}

export function winner(round: Round, mostVoted: number): "villagers" | "zoroark" {
  if (!Number.isInteger(mostVoted) || mostVoted < 1 || mostVoted > round.count) {
    throw new Error("最多得票者の番号が不正です");
  }
  return mostVoted === round.wolf + 1 ? "villagers" : "zoroark";
}

