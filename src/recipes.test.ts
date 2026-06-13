import { describe, it, expect } from "vitest"
import { BUILTIN_RECIPES, builtinCategories } from "./recipes"

describe("組み込みレシピ", () => {
  it("ちょうど100種ある", () => {
    expect(BUILTIN_RECIPES).toHaveLength(100)
  })

  it("IDが一意である", () => {
    const ids = BUILTIN_RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("名前が一意である", () => {
    const names = BUILTIN_RECIPES.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("全レシピに名前・材料・手順・カテゴリがある", () => {
    for (const r of BUILTIN_RECIPES) {
      expect(r.name.length, r.id).toBeGreaterThan(0)
      expect(r.ingredients.length, r.id).toBeGreaterThan(0)
      expect(r.steps.length, r.id).toBeGreaterThan(0)
      expect(r.category, r.id).toBeTruthy()
      expect(r.builtin, r.id).toBe(true)
    }
  })

  it("カテゴリは複数あり、各カテゴリにレシピが属する", () => {
    const cats = builtinCategories()
    expect(cats.length).toBeGreaterThanOrEqual(5)
    for (const cat of cats) {
      expect(BUILTIN_RECIPES.some((r) => r.category === cat)).toBe(true)
    }
  })
})
