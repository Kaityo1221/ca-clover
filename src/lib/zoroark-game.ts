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

export const PAIRS: readonly Pair[] = [
  { id: "e01", level: "easy", a: "デデンネ", b: "エモンガ", common: "小型のでんきタイプ", difference: "エモンガはひこうタイプを持つ" },
  { id: "e02", level: "easy", a: "ピカチュウ", b: "ライチュウ", common: "でんきタイプでほおに電気袋がある", difference: "ライチュウはピカチュウの進化形" },
  { id: "e03", level: "easy", a: "ピチュー", b: "ピカチュウ", common: "黄色系のでんきタイプ", difference: "ピチューはベイビィポケモン" },
  { id: "e04", level: "easy", a: "ロコン", b: "アローラロコン", common: "キツネの姿で尾を持つ", difference: "通常のロコンはほのお、アローラはこおりタイプ" },
  { id: "e05", level: "easy", a: "サンド", b: "アローラサンド", common: "丸まることができる", difference: "アローラはこおり・はがねタイプ" },
  { id: "e06", level: "easy", a: "ディグダ", b: "アローラディグダ", common: "地面から顔を出す", difference: "アローラははがねタイプを持つ" },
  { id: "e07", level: "easy", a: "ニャース", b: "アローラニャース", common: "猫の姿で額に小判がある", difference: "アローラはあくタイプ" },
  { id: "e08", level: "easy", a: "ポニータ", b: "ガラルポニータ", common: "馬のような姿", difference: "通常はほのお、ガラルはエスパータイプ" },
  { id: "e09", level: "easy", a: "ゾロア", b: "ヒスイゾロア", common: "キツネのような姿で化ける", difference: "ヒスイはノーマル・ゴーストタイプ" },
  { id: "e10", level: "easy", a: "ナッシー", b: "アローラナッシー", common: "ヤシの木を連想させる外見", difference: "アローラは非常に首が長い" },
  { id: "e11", level: "easy", a: "コラッタ", b: "アローラコラッタ", common: "ネズミに似た小型ポケモン", difference: "アローラはあくタイプを持つ" },
  { id: "e12", level: "easy", a: "バリヤード", b: "ガラルバリヤード", common: "人型で手を使う", difference: "ガラルはこおり・エスパータイプ" },
  { id: "m01", level: "normal", a: "ガーディ", b: "ヒスイガーディ", common: "犬の姿のほのおタイプ", difference: "ヒスイはほのお・いわタイプ" },
  { id: "m02", level: "normal", a: "ビリリダマ", b: "ヒスイビリリダマ", common: "モンスターボールのような外見", difference: "ヒスイはでんき・くさタイプ" },
  { id: "m03", level: "normal", a: "マルマイン", b: "ヒスイマルマイン", common: "丸いボール状の姿", difference: "ヒスイはでんき・くさタイプ" },
  { id: "m04", level: "normal", a: "ウパー", b: "パルデアウパー", common: "頭に枝状の突起がある", difference: "パルデアはどく・じめんタイプ" },
  { id: "m05", level: "normal", a: "ヤドン", b: "ガラルヤドン", common: "のんびりした姿で尻尾が特徴", difference: "ガラルはエスパータイプ単独" },
  { id: "m06", level: "normal", a: "ヤドラン", b: "ガラルヤドラン", common: "シェルダーと関連する進化形", difference: "ガラルはどく・エスパータイプ" },
  { id: "m07", level: "normal", a: "ヤドキング", b: "ガラルヤドキング", common: "頭部にシェルダーがいる", difference: "ガラルはどく・エスパータイプ" },
  { id: "m08", level: "normal", a: "ジグザグマ", b: "ガラルジグザグマ", common: "ジグザグ模様が特徴", difference: "ガラルはあく・ノーマルタイプ" },
  { id: "m09", level: "normal", a: "ゴローニャ", b: "アローラゴローニャ", common: "岩のような大きな体", difference: "アローラはでんきタイプを持つ" },
  { id: "m10", level: "normal", a: "イシツブテ", b: "アローライシツブテ", common: "岩石の体と腕がある", difference: "アローラはでんきタイプを持つ" },
  { id: "m11", level: "normal", a: "ライチュウ", b: "アローラライチュウ", common: "ピカチュウの進化形", difference: "アローラはエスパータイプも持つ" },
  { id: "m12", level: "normal", a: "マタドガス", b: "ガラルマタドガス", common: "複数の頭部と煙のイメージ", difference: "ガラルはどく・フェアリータイプ" },
  { id: "m13", level: "normal", a: "カモネギ", b: "ガラルカモネギ", common: "植物の茎を持つ鳥", difference: "ガラルはかくとうタイプ" },
  { id: "m14", level: "normal", a: "ベトベター", b: "アローラベトベター", common: "ヘドロのような体", difference: "アローラはどく・あくタイプ" },
  { id: "m15", level: "normal", a: "ベトベトン", b: "アローラベトベトン", common: "ヘドロのような大きな体", difference: "アローラはどく・あくタイプ" },
  { id: "h01", level: "hard", a: "プラスル", b: "マイナン", common: "うさぎに似たでんきタイプ", difference: "ほおと尻尾の記号が＋と−" },
  { id: "h02", level: "hard", a: "ニドラン♀", b: "ニドラン♂", common: "毒のトゲと大きな耳", difference: "性別で進化系が異なる" },
  { id: "h03", level: "hard", a: "ラティアス", b: "ラティオス", common: "飛行するドラゴン・エスパータイプ", difference: "体色と姿の違いがある" },
  { id: "h04", level: "hard", a: "トルネロス", b: "ボルトロス", common: "雲に乗る伝説のポケモン", difference: "トルネロスはひこう単独、ボルトロスはでんき・ひこう" },
  { id: "h05", level: "hard", a: "イルミーゼ", b: "バルビート", common: "ホタルのようなむしタイプ", difference: "姿や役割が異なる対のポケモン" },
  { id: "h06", level: "hard", a: "ソルロック", b: "ルナトーン", common: "宇宙を連想させるいわ・エスパー", difference: "太陽と月がモチーフ" },
  { id: "h07", level: "hard", a: "レシラム", b: "ゼクロム", common: "伝説のドラゴンタイプ", difference: "レシラムはほのお、ゼクロムはでんきタイプも持つ" },
  { id: "h08", level: "hard", a: "ダルマッカ", b: "ガラルダルマッカ", common: "丸い体と大きな顔", difference: "ガラルはこおりタイプ" },
  { id: "h09", level: "hard", a: "ロズレイド", b: "ロゼリア", common: "花を手にしたくさ・どくタイプ", difference: "ロズレイドはロゼリアの進化形" },
  { id: "h10", level: "hard", a: "エルレイド", b: "サーナイト", common: "ラルトスから進化するエスパータイプ", difference: "エルレイドはかくとう、サーナイトはフェアリータイプも持つ" },
  { id: "h11", level: "hard", a: "フラベベ", b: "フラエッテ", common: "花と一緒にいるフェアリータイプ", difference: "フラエッテはフラベベの進化形" },
  { id: "h12", level: "hard", a: "グレイシア", b: "リーフィア", common: "イーブイの進化形", difference: "グレイシアはこおり、リーフィアはくさタイプ" },
  { id: "h13", level: "hard", a: "ドガース", b: "マタドガス", common: "毒ガスを連想させるどくタイプ", difference: "マタドガスはドガースの進化形" },
  { id: "h14", level: "hard", a: "パチリス", b: "エモンガ", common: "小さなリス型のでんきタイプ", difference: "エモンガはひこうタイプも持つ" },
  { id: "h15", level: "hard", a: "ダンゴロ", b: "ガントル", common: "岩石の体を持ついわタイプ", difference: "ガントルはダンゴロの進化形" },
];

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

export function sanitizeRecentIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(PAIRS.map((p) => p.id));
  return [...new Set(input.filter((x): x is string => typeof x === "string" && known.has(x)))].slice(-6);
}

export function pickPair(level: DifficultyChoice, recent: readonly string[], random: (max: number) => number): Pair {
  const allowed = PAIRS.filter(p => level === "all" || p.level === level);
  if (allowed.length === 0) throw new Error("No pair for selected difficulty");
  const unseen = allowed.filter(p => !recent.includes(p.id));
  const pool = unseen.length ? unseen : allowed;
  const idx = random(pool.length);
  if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) throw new Error("Invalid random index");
  return pool[idx];
}

export type Round = {
  pair: Pair;
  majority: string;
  minority: string;
  wolf: number;
  prompts: string[];
  count: number;
};

export function makeRound(count: number, pair: Pair, random: (max: number) => number): Round {
  if (!Number.isInteger(count) || count < 3 || count > 12) throw new Error("人数は3〜12人にしてください");
  const wolf = random(count);
  const reversed = random(2) === 1;
  if (!Number.isInteger(wolf) || wolf < 0 || wolf >= count) throw new Error("Invalid wolf index");
  const [majority, minority] = reversed ? [pair.b, pair.a] : [pair.a, pair.b];
  return { pair, majority, minority, wolf, count,
    prompts: Array.from({ length: count }, (_, i) => i === wolf ? minority : majority) };
}

export function winner(round: Round, mostVoted: number): "villagers" | "zoroark" {
  if (!Number.isInteger(mostVoted) || mostVoted < 1 || mostVoted > round.count) {
    throw new Error("最多得票者の番号が不正です");
  }
  return mostVoted === round.wolf + 1 ? "villagers" : "zoroark";
}

export function randomIndex(max: number): number {
  if (!Number.isInteger(max) || max < 1) throw new Error("Invalid random range");
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("安全な乱数を利用できません");
  }
  const buffer = new Uint32Array(1);
  const limit = Math.floor(4294967296 / max) * max;
  let val: number;
  do {
    crypto.getRandomValues(buffer);
    val = buffer[0];
  } while (val >= limit);
  return val % max;
}
