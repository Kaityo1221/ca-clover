import "server-only";
import type { DifficultyChoice, Pair, Round } from "@/lib/zoroark-game";
import { randomInt } from "node:crypto";

// Official topic selection runs server-side after CA verification.
// Source is public by design: never treat the catalog as a credential.
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

export function chooseZoroarkPair(
  level: DifficultyChoice,
  recent: readonly string[],
  choose: (max: number) => number = max => randomInt(max),
): Pair {
  const matching = PAIRS.filter(p => level === "all" || p.level === level);
  if (!matching.length) throw new Error("No catalog entries");
  const newPairs = matching.filter(p => !recent.includes(p.id));
  const pool = newPairs.length ? newPairs : matching;
  const pick = choose(pool.length);
  if (!Number.isInteger(pick) || pick < 0 || pick >= pool.length) throw new Error("Invalid pair index");
  return pool[pick];
}

export function createZoroarkRound(
  count: number,
  pair: Pair,
  choose: (max: number) => number = max => randomInt(max),
): Round {
  if (!Number.isInteger(count) || count < 3 || count > 12) throw new Error("Invalid player count");
  const wolf = choose(count);
  const flip = choose(2);
  if (!Number.isInteger(wolf) || wolf < 0 || wolf >= count || (flip !== 0 && flip !== 1)) throw new Error("Invalid choice");
  const [majority, minority] = flip ? [pair.b, pair.a] : [pair.a, pair.b];
  return {
    pair, majority, minority, wolf, count,
    prompts: Array.from({ length: count }, (_, i) => i === wolf ? minority : majority),
  };
}
