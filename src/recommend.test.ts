import { describe, it, expect } from "vitest"
import { pickDailyRecommendations, greeting } from "./recommend"
import type { Recipe } from "./recipes"

function makeRecipes(n: number, categories = ["A", "B", "C", "D", "E"]): Recipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `recipe${i}`,
    ingredients: ["x"],
    steps: ["y"],
    category: categories[i % categories.length],
    builtin: true,
  }))
}

describe("pickDailyRecommendations", () => {
  const recipes = makeRecipes(150)

  it("指定件数を返す", () => {
    expect(pickDailyRecommendations(recipes, 3, new Date(2026, 5, 15))).toHaveLength(3)
  })

  it("同じ日付なら同じ結果（決定論的）", () => {
    const a = pickDailyRecommendations(recipes, 3, new Date(2026, 5, 15))
    const b = pickDailyRecommendations(recipes, 3, new Date(2026, 5, 15))
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id))
  })

  it("別の日付では基本的に異なる結果になる", () => {
    const a = pickDailyRecommendations(recipes, 3, new Date(2026, 5, 15))
    const b = pickDailyRecommendations(recipes, 3, new Date(2026, 5, 16))
    expect(a.map((r) => r.id)).not.toEqual(b.map((r) => r.id))
  })

  it("カテゴリが十分あれば異なるカテゴリから選ぶ", () => {
    const picked = pickDailyRecommendations(recipes, 3, new Date(2026, 5, 15))
    const cats = picked.map((r) => r.category)
    expect(new Set(cats).size).toBe(3)
  })

  it("レシピ数が要求数以下なら全部返す", () => {
    const few = makeRecipes(2)
    expect(pickDailyRecommendations(few, 3)).toHaveLength(2)
  })

  it("重複なく選ばれる", () => {
    const picked = pickDailyRecommendations(recipes, 3, new Date(2026, 2, 3))
    expect(new Set(picked.map((r) => r.id)).size).toBe(3)
  })
})

describe("greeting", () => {
  it("時間帯で挨拶が変わる", () => {
    expect(greeting(new Date(2026, 5, 15, 8))).toBe("おはようございます")
    expect(greeting(new Date(2026, 5, 15, 13))).toBe("こんにちは")
    expect(greeting(new Date(2026, 5, 15, 20))).toBe("こんばんは")
  })
})
