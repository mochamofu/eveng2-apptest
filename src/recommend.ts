// 「今日のおすすめ」3レシピを選ぶロジック。
// 同じ日に何度開いても同じ3品になるよう、日付シードで決定論的に選ぶ。
// （毎回ランダムだと「さっき見たのは何だっけ」となるのを防ぐ）

import type { Recipe } from "./recipes"

/** YYYY-MM-DD を数値シードに変換する（簡易ハッシュ） */
function seedFromDate(date: Date): number {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32: シード付き擬似乱数生成器 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * その日の「おすすめ」を count 件返す。
 * - 同じ日付なら同じ結果（決定論的）
 * - できるだけ異なるカテゴリから選ぶ
 */
export function pickDailyRecommendations(recipes: Recipe[], count = 3, date = new Date()): Recipe[] {
  if (recipes.length <= count) return [...recipes]

  const rng = mulberry32(seedFromDate(date))
  // Fisher–Yatesでシャッフル
  const shuffled = [...recipes]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // カテゴリ重複を避けて選ぶ。足りなければ重複を許して補充する。
  const picked: Recipe[] = []
  const usedCategories = new Set<string>()
  for (const recipe of shuffled) {
    if (picked.length >= count) break
    const cat = recipe.category ?? ""
    if (!usedCategories.has(cat)) {
      picked.push(recipe)
      usedCategories.add(cat)
    }
  }
  for (const recipe of shuffled) {
    if (picked.length >= count) break
    if (!picked.includes(recipe)) picked.push(recipe)
  }
  return picked
}

/** 時間帯に応じた挨拶文 */
export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 11) return "おはようございます"
  if (h < 17) return "こんにちは"
  return "こんばんは"
}
