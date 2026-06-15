// グラス側のセッション管理。コンテナのレイアウト、ページ送り、タイマーを担当する。
// 実機ブリッジにもプレビュー用モックにも同じ GlassesIO インターフェースで接続する。

import { pxTruncate } from "@evenrealities/pretext"
import type { GlassPage } from "./pages"
import { formatTime } from "./duration"

export const DISPLAY_W = 576
export const DISPLAY_H = 288
export const HEADER_H = 30
export const FOOTER_H = 30
export const BODY_H = DISPLAY_H - HEADER_H - FOOTER_H // 228
export const PAD = 4
export const INNER_W = DISPLAY_W - 2 * PAD
export const BODY_INNER_H = BODY_H - 2 * PAD // 220 → 27px行高で8行

export const CONTAINER_HEADER = { id: 2, name: "header" }
export const CONTAINER_BODY = { id: 1, name: "body" }
export const CONTAINER_FOOTER = { id: 3, name: "footer" }

const FOOTER_TEXT = "タップ:次へ ｜ 上ｽﾜｲﾌﾟ:戻る ｜ 下ｽﾜｲﾌﾟ:タイマー ｜ 2回タップ:終了"

export interface ContainerSpec {
  id: number
  name: string
  x: number
  y: number
  w: number
  h: number
  content: string
  capture: boolean
}

export type GlassGesture = "tap" | "double" | "up" | "down" | "exit"

export interface GlassesIO {
  createPage(containers: ContainerSpec[]): Promise<boolean>
  updateText(id: number, name: string, content: string): Promise<void>
  shutdown(): Promise<void>
  onGesture(cb: (g: GlassGesture) => void): () => void
}

export interface SessionHooks {
  onPage?: (page: GlassPage, index: number, total: number) => void
  onTimer?: (remainSec: number | null, finished: boolean) => void
  onEnd?: () => void
}

export class RecipeSession {
  private index = 0
  private timerRemain: number | null = null
  private timerId: ReturnType<typeof setInterval> | null = null
  private unsubscribe: (() => void) | null = null
  private ended = false
  // ブリッジへの書き込みを直列化し、連打時の更新競合を防ぐ
  private writing: Promise<unknown> = Promise.resolve()

  constructor(
    private io: GlassesIO,
    private recipeName: string,
    private pages: GlassPage[],
    private hooks: SessionHooks = {},
  ) {}

  async start(): Promise<boolean> {
    const page = this.pages[0]
    const ok = await this.io.createPage([
      {
        ...CONTAINER_BODY,
        x: 0, y: HEADER_H, w: DISPLAY_W, h: BODY_H,
        content: page.body,
        capture: true,
      },
      {
        ...CONTAINER_HEADER,
        x: 0, y: 0, w: DISPLAY_W, h: HEADER_H,
        content: this.headerText(),
        capture: false,
      },
      {
        ...CONTAINER_FOOTER,
        x: 0, y: HEADER_H + BODY_H, w: DISPLAY_W, h: FOOTER_H,
        content: FOOTER_TEXT,
        capture: false,
      },
    ])
    if (!ok) return false

    this.unsubscribe = this.io.onGesture((g) => this.handleGesture(g))
    this.hooks.onPage?.(page, 0, this.pages.length)
    return true
  }

  get currentIndex(): number {
    return this.index
  }

  private headerText(): string {
    const page = this.pages[this.index]
    let text = `${page.title} ｜ ${this.recipeName}`
    if (this.timerRemain !== null) {
      text = this.timerRemain <= 0
        ? `⏱ タイマー終了！ ｜ ${page.title}`
        : `⏱ ${formatTime(this.timerRemain)} ｜ ${text}`
    }
    return pxTruncate(text, INNER_W)
  }

  private handleGesture(g: GlassGesture): void {
    switch (g) {
      case "tap":
        this.show(this.index + 1)
        break
      case "up":
        this.show(this.index - 1)
        break
      case "down":
        this.toggleTimer()
        break
      case "double":
        this.queueWrite(() => this.io.shutdown())
        this.end()
        break
      case "exit":
        this.end()
        break
    }
  }

  private show(index: number): void {
    if (index < 0 || index >= this.pages.length || index === this.index) return
    this.index = index
    this.stopTimer()
    const page = this.pages[index]
    this.queueWrite(async () => {
      await this.io.updateText(CONTAINER_BODY.id, CONTAINER_BODY.name, page.body)
      await this.io.updateText(CONTAINER_HEADER.id, CONTAINER_HEADER.name, this.headerText())
    })
    this.hooks.onPage?.(page, index, this.pages.length)
  }

  private toggleTimer(): void {
    if (this.timerId !== null) {
      this.stopTimer()
      this.refreshHeader()
      return
    }
    const sec = this.pages[this.index].timerSec
    if (sec === null) return
    this.timerRemain = sec
    this.timerId = setInterval(() => this.tick(), 1000)
    this.refreshHeader()
    this.hooks.onTimer?.(this.timerRemain, false)
  }

  private tick(): void {
    if (this.timerRemain === null) return
    this.timerRemain -= 1
    if (this.timerRemain <= 0) {
      this.timerRemain = 0
      this.stopTimer(/* keepRemain */ true)
      this.hooks.onTimer?.(0, true)
    } else {
      this.hooks.onTimer?.(this.timerRemain, false)
    }
    this.refreshHeader()
  }

  private stopTimer(keepRemain = false): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    if (!keepRemain) {
      this.timerRemain = null
      this.hooks.onTimer?.(null, false)
    }
  }

  private refreshHeader(): void {
    this.queueWrite(() =>
      this.io.updateText(CONTAINER_HEADER.id, CONTAINER_HEADER.name, this.headerText()),
    )
  }

  private queueWrite(fn: () => Promise<unknown>): void {
    this.writing = this.writing.then(fn).catch((err) => console.error("glasses write failed:", err))
  }

  private end(): void {
    if (this.ended) return
    this.ended = true
    this.stopTimer()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.hooks.onEnd?.()
  }

  stop(): void {
    this.end()
  }
}
