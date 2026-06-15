// レシピサイトのページからレシピ（名前・材料・手順）を抽出する。
//
// 対応形式（優先順）:
//   1. JSON-LD (schema.org/Recipe) — クックパッド・クラシル・DELISH KITCHEN等の主要サイト
//   2. 白ごはん.com のHTML構造（#material / #howto）
//   3. microdata (itemprop="recipeIngredient" / "recipeInstructions")

export interface ParsedRecipe {
  name: string
  ingredients: string[]
  steps: string[]
}

/** HTMLタグ除去・実体参照の簡易デコード・空白の正規化 */
export function cleanText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t　]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
}

export function parseRecipeHtml(html: string): ParsedRecipe | null {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return fromJsonLd(doc) ?? fromShirogohan(doc) ?? fromMicrodata(doc)
}

// ---------- 1. JSON-LD ----------

function fromJsonLd(doc: Document): ParsedRecipe | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent ?? "")
    } catch {
      continue
    }
    const recipe = findRecipeNode(data)
    if (!recipe) continue

    const name = typeof recipe.name === "string" ? cleanText(recipe.name) : ""
    const ingredients = toStringList(recipe.recipeIngredient ?? recipe.ingredients)
    const steps = instructionsToSteps(recipe.recipeInstructions)
    if (name && steps.length > 0) return { name, ingredients, steps }
  }
  return null
}

type JsonRecord = Record<string, any>

function findRecipeNode(node: unknown): JsonRecord | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }
  if (node === null || typeof node !== "object") return null
  const record = node as JsonRecord
  const type = record["@type"]
  const types = Array.isArray(type) ? type : [type]
  if (types.includes("Recipe")) return record
  if (record["@graph"]) return findRecipeNode(record["@graph"])
  return null
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split("\n")
      .map(cleanText)
      .filter(Boolean)
  }
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === "string" ? cleanText(v) : typeof v?.name === "string" ? cleanText(v.name) : ""))
    .filter(Boolean)
}

function instructionsToSteps(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split("\n").map(cleanText).filter(Boolean)
  }
  if (!Array.isArray(value)) return []

  const steps: string[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const text = cleanText(item)
      if (text) steps.push(text)
      continue
    }
    if (item === null || typeof item !== "object") continue
    const record = item as JsonRecord
    if (record["@type"] === "HowToSection" && Array.isArray(record.itemListElement)) {
      steps.push(...instructionsToSteps(record.itemListElement))
      continue
    }
    const text = record.text ?? record.name
    if (typeof text === "string") {
      const cleaned = cleanText(text)
      if (cleaned) steps.push(cleaned)
    }
  }
  return steps
}

// ---------- 2. 白ごはん.com ----------

function fromShirogohan(doc: Document): ParsedRecipe | null {
  const material = doc.querySelector("#material, section.material")
  const howto = doc.querySelector("#howto, section.howto")
  if (!material || !howto) return null

  const name = cleanText(
    doc.querySelector("#recipe-name")?.textContent ?? doc.querySelector("h1")?.textContent ?? "",
  )

  const ingredients = [...material.querySelectorAll("li")]
    .map((li) => cleanText(li.textContent ?? "").replace(/\s*…\s*/g, " … "))
    .filter(Boolean)

  const steps: string[] = []
  for (const block of howto.querySelectorAll(".howto-block")) {
    const title = cleanText(block.querySelector("h3")?.textContent ?? "")
    let first = true
    for (const p of block.querySelectorAll("p")) {
      if (p.classList.contains("note-text")) continue
      const text = cleanText(p.textContent ?? "")
      if (!text) continue
      steps.push(first && title ? `【${title}】${text}` : text)
      first = false
    }
  }

  if (!name || steps.length === 0) return null
  return { name, ingredients, steps }
}

// ---------- 3. microdata ----------

function fromMicrodata(doc: Document): ParsedRecipe | null {
  const scope = doc.querySelector('[itemtype*="schema.org/Recipe"]') ?? doc
  const ingredients = [...scope.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')]
    .map((el) => cleanText(el.textContent ?? ""))
    .filter(Boolean)

  const stepNodes = [...scope.querySelectorAll('[itemprop="recipeInstructions"]')]
  const steps: string[] = []
  for (const node of stepNodes) {
    const items = node.querySelectorAll("li")
    if (items.length > 0) {
      for (const li of items) {
        const text = cleanText(li.textContent ?? "")
        if (text) steps.push(text)
      }
    } else {
      const text = cleanText(node.textContent ?? "")
      if (text) steps.push(text)
    }
  }

  if (steps.length === 0) return null
  const name = cleanText(scope.querySelector('[itemprop="name"]')?.textContent ?? doc.querySelector("h1")?.textContent ?? "")
  return { name: name || "取り込みレシピ", ingredients, steps }
}

// ---------- URL取得 ----------

// WebView内の直接fetchはレシピサイト側がCORSを許可していないと失敗するため、
// 公開CORSプロキシへ順にフォールバックする（URLのみが第三者プロキシに渡る）。
const FETCH_STRATEGIES: Array<(url: string) => string> = [
  (url) => url,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

export async function fetchRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  let lastError: unknown = new Error("取得に失敗しました")
  for (const wrap of FETCH_STRATEGIES) {
    try {
      const res = await fetch(wrap(url), { headers: { Accept: "text/html" } })
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const recipe = parseRecipeHtml(html)
      if (recipe) return recipe
      lastError = new Error("このページからレシピデータを検出できませんでした")
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
