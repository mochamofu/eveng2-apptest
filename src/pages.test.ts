import { describe, it, expect } from "vitest"
import { measureTextWrap } from "@evenrealities/pretext"
import { buildPages, chunkByLines, LINE_HEIGHT } from "./pages"
import { BUILTIN_RECIPES } from "./recipes"

const INNER_W = 568 // 576 - パディング4×2
const MAX_LINES = Math.floor(220 / LINE_HEIGHT) // 8行

describe("chunkByLines", () => {
  it("短いテキストは1チャンク", () => {
    const chunks = chunkByLines("じゃがいもを切る。", INNER_W, MAX_LINES)
    expect(chunks).toHaveLength(1)
  })

  it("長いテキストは全チャンクが行数制限内に収まる", () => {
    const long = "じゃがいもの皮をむいて4等分に切り、水に5分さらしてでんぷんを落とす。".repeat(10)
    const chunks = chunkByLines(long, INNER_W, MAX_LINES)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(measureTextWrap(chunk, INNER_W).lineCount).toBeLessThanOrEqual(MAX_LINES)
    }
    // 結合すると元のテキストに戻る（欠落なし）
    expect(chunks.join("")).toBe(long)
  })

  it("空文字でも落ちない", () => {
    expect(chunkByLines("", INNER_W, MAX_LINES)).toEqual([""])
  })
})

describe("buildPages", () => {
  it("先頭は材料ページ、その後に全手順が含まれる", () => {
    const recipe = BUILTIN_RECIPES[0]
    const pages = buildPages(recipe, INNER_W, MAX_LINES)
    expect(pages[0].title).toMatch(/^材料/)
    const stepPages = pages.filter((p) => p.title.startsWith("手順"))
    expect(stepPages.length).toBeGreaterThanOrEqual(recipe.steps.length)
  })

  it("時間入りの手順にはtimerSecが付く", () => {
    const pages = buildPages(BUILTIN_RECIPES[0], INNER_W, MAX_LINES)
    const simmer = pages.find((p) => p.body.includes("15分煮る"))
    expect(simmer?.timerSec).toBe(900)
  })

  it("時間なしの手順はtimerSecがnull", () => {
    const pages = buildPages(BUILTIN_RECIPES[0], INNER_W, MAX_LINES)
    const cut = pages.find((p) => p.body.includes("乱切り"))
    expect(cut?.timerSec).toBeNull()
  })

  it("全組み込みレシピで全ページが画面に収まる", () => {
    for (const recipe of BUILTIN_RECIPES) {
      const pages = buildPages(recipe, INNER_W, MAX_LINES)
      for (const page of pages) {
        expect(measureTextWrap(page.body, INNER_W).lineCount).toBeLessThanOrEqual(MAX_LINES)
        expect(page.body.length).toBeLessThanOrEqual(2000) // textContainerUpgrade上限
      }
    }
  })
})
