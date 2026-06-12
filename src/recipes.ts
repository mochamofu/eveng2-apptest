// レシピのデータ型・組み込みレシピ・localStorageでの保存。

export interface Recipe {
  id: string
  name: string
  ingredients: string[]
  steps: string[]
  builtin?: boolean
}

export const BUILTIN_RECIPES: Recipe[] = [
  {
    id: "builtin-nikujaga",
    name: "肉じゃが",
    builtin: true,
    ingredients: [
      "じゃがいも 3個",
      "にんじん 1本",
      "玉ねぎ 1個",
      "牛こま切れ肉 150g",
      "サラダ油 大さじ1",
      "水 200ml",
      "醤油 大さじ3",
      "みりん 大さじ3",
      "砂糖 大さじ2",
    ],
    steps: [
      "じゃがいもは4等分、にんじんは乱切り、玉ねぎはくし切りにする。",
      "鍋にサラダ油を熱し、牛肉を中火で炒める。色が変わったら野菜を加えて2分炒める。",
      "水・醤油・みりん・砂糖を加えて煮立たせ、アクを取る。",
      "落とし蓋をして弱めの中火で15分煮る。",
      "火を止めて10分置き、味を染み込ませたら完成。",
    ],
  },
  {
    id: "builtin-oyakodon",
    name: "親子丼",
    builtin: true,
    ingredients: [
      "鶏もも肉 150g",
      "玉ねぎ 1/2個",
      "卵 2個",
      "だし汁 100ml",
      "醤油 大さじ2",
      "みりん 大さじ2",
      "ご飯 丼1杯",
      "三つ葉 適量",
    ],
    steps: [
      "鶏もも肉は一口大に切り、玉ねぎは薄切りにする。卵は軽く溶いておく。",
      "小さめのフライパンにだし汁・醤油・みりんを入れて中火にかける。",
      "煮立ったら鶏肉と玉ねぎを加え、5分煮る。",
      "溶き卵を回し入れ、蓋をして30秒加熱したら火を止める。",
      "半熟になったらご飯にのせ、三つ葉を散らして完成。",
    ],
  },
  {
    id: "builtin-napolitan",
    name: "ナポリタン",
    builtin: true,
    ingredients: [
      "スパゲッティ 100g",
      "ウインナー 3本",
      "ピーマン 1個",
      "玉ねぎ 1/4個",
      "ケチャップ 大さじ4",
      "バター 10g",
      "塩・こしょう 少々",
    ],
    steps: [
      "ウインナーは斜め切り、ピーマンと玉ねぎは細切りにする。",
      "スパゲッティを袋の表示より1分短く茹でる（目安7分）。茹で汁を大さじ2取っておく。",
      "フライパンにバターを溶かし、ウインナーと野菜を中火で2分炒める。",
      "ケチャップを加えて30秒炒め、酸味を飛ばす。",
      "スパゲッティと茹で汁を加えて全体を絡め、塩こしょうで味を調えて完成。",
    ],
  },
]

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

export function addCustomRecipe(name: string, ingredients: string[], steps: string[]): Recipe {
  const recipe: Recipe = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    ingredients,
    steps,
  }
  saveCustomRecipes([...loadCustomRecipes(), recipe])
  return recipe
}

export function deleteCustomRecipe(id: string): void {
  saveCustomRecipes(loadCustomRecipes().filter((r) => r.id !== id))
}
