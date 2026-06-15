// レシピをグラスの画面（576x288）に収まるページ列へ変換する。
// 行数の見積もりには @evenrealities/pretext を使う。G2ファームウェア（LVGL）と
// 同じグリフ幅で折り返しを計算するため、実機とズレない。

import { measureTextWrap } from "@evenrealities/pretext"
import type { Recipe } from "./recipes"
import { parseDurationSec } from "./duration"

/** EvenHubのLVGLビルドでは行高は27px固定 */
export const LINE_HEIGHT = 27

export interface GlassPage {
  /** ヘッダー左側に出すラベル（例: "材料 1/2", "手順 3/5"） */
  title: string
  body: string
  /** この手順から抽出したタイマー秒数（なければ null） */
  timerSec: number | null
}

/**
 * テキストを maxLines 行以内に収まるチャンクへ分割する。
 * 日本語はスペース区切りがないため、prefixの行数を二分探索して切る。
 * 切れ目はできるだけ句読点・スペースに寄せる。
 */
export function chunkByLines(text: string, maxWidth: number, maxLines: number): string[] {
  if (!text) return [""]
  const chunks: string[] = []
  let rest = text

  while (rest.length > 0) {
    if (measureTextWrap(rest, maxWidth).lineCount <= maxLines) {
      chunks.push(rest)
      break
    }
    // maxLines以内に収まる最長プレフィックスを二分探索
    let lo = 1
    let hi = rest.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (measureTextWrap(rest.slice(0, mid), maxWidth).lineCount <= maxLines) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    let cut = lo
    const slice = rest.slice(0, lo)
    const punct = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("、"), slice.lastIndexOf(" "))
    if (punct >= Math.floor(lo / 2)) cut = punct + 1
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  return chunks
}

/** 材料リストを「・item」を1行ずつ並べたページ群にする */
function buildIngredientPages(recipe: Recipe, maxWidth: number, maxLines: number): GlassPage[] {
  const bodies: string[] = []
  let buffer: string[] = []
  let lines = 0

  for (const item of recipe.ingredients) {
    const text = `・${item}`
    const itemLines = measureTextWrap(text, maxWidth).lineCount
    if (buffer.length > 0 && lines + itemLines > maxLines) {
      bodies.push(buffer.join("\n"))
      buffer = []
      lines = 0
    }
    buffer.push(text)
    lines += itemLines
  }
  if (buffer.length > 0) bodies.push(buffer.join("\n"))
  if (bodies.length === 0) bodies.push("（材料なし）")

  return bodies.map((body, i) => ({
    title: bodies.length > 1 ? `材料 ${i + 1}/${bodies.length}` : "材料",
    body,
    timerSec: null,
  }))
}

/** レシピ全体をページ列へ。先頭は材料ページ、続いて各手順ページ。 */
export function buildPages(recipe: Recipe, maxWidth: number, maxLines: number): GlassPage[] {
  const pages: GlassPage[] = buildIngredientPages(recipe, maxWidth, maxLines)

  const total = recipe.steps.length
  recipe.steps.forEach((step, i) => {
    const timerSec = parseDurationSec(step)
    const chunks = chunkByLines(`${i + 1}. ${step}`, maxWidth, maxLines)
    chunks.forEach((body, c) => {
      pages.push({
        title: c === 0 ? `手順 ${i + 1}/${total}` : `手順 ${i + 1}/${total} 続き`,
        body,
        timerSec,
      })
    })
  })

  return pages
}
