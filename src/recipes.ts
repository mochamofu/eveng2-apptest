// レシピのデータ型・組み込みレシピ・localStorageでの保存。
// プリインストールの100レシピは builtin-recipes.ts に分離している。

import { BUILTIN_RECIPES } from "./builtin-recipes"

export interface Recipe {
  id: string
  name: string
  ingredients: string[]
  steps: string[]
  /** 表示・絞り込み用のカテゴリ。未指定は「マイレシピ」扱い。 */
  category?: string
  builtin?: boolean
}

export { BUILTIN_RECIPES }

/** 自作レシピ（URL取り込み・手入力）のカテゴリ名 */
export const CUSTOM_CATEGORY = "マイレシピ"

/** プリインストールレシピのカテゴリを定義順で返す */
export function builtinCategories(): string[] {
  const seen: string[] = []
  for (const r of BUILTIN_RECIPES) {
    const c = r.category ?? CUSTOM_CATEGORY
    if (!seen.includes(c)) seen.push(c)
  }
  return seen
}

const STORAGE_KEY = "recipe-navi:custom:v1"

export function loadCustomRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveCustomRecipes(recipes: Recipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
}

export function allRecipes(): Recipe[] {
  return [...BUILTIN_RECIPES, ...loadCustomRecipes()]
}

/** カテゴリ → レシピ配列のグループを、組み込み定義順 +「マイレシピ」末尾で返す */
export function recipesByCategory(): Array<{ category: string; recipes: Recipe[] }> {
  const order = [...builtinCategories(), CUSTOM_CATEGORY]
  const groups = new Map<string, Recipe[]>()
  for (const recipe of allRecipes()) {
    const cat = recipe.category ?? CUSTOM_CATEGORY
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(recipe)
  }
  return order
    .filter((c) => groups.has(c))
    .map((category) => ({ category, recipes: groups.get(category)! }))
}

export function addCustomRecipe(name: string, ingredients: string[], steps: string[]): Recipe {
  const recipe: Recipe = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    ingredients,
    steps,
    category: CUSTOM_CATEGORY,
  }
  saveCustomRecipes([...loadCustomRecipes(), recipe])
  return recipe
}

export function deleteCustomRecipe(id: string): void {
  saveCustomRecipes(loadCustomRecipes().filter((r) => r.id !== id))
}
