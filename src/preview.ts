// ブラウザ単体で動くG2画面プレビュー。GlassesIO をDOM描画で実装し、
// 実機と同じ RecipeSession ロジックをそのまま動かす。

import { allRecipes, recipesByCategory } from "./recipes"
import { buildPages, LINE_HEIGHT } from "./pages"
import {
  RecipeSession,
  INNER_W,
  BODY_INNER_H,
  PAD,
  type GlassesIO,
  type ContainerSpec,
  type GlassGesture,
} from "./glasses"

const hud = document.getElementById("hud")!
const select = document.getElementById("recipe-select") as HTMLSelectElement
const startBtn = document.getElementById("start-btn")!

let gestureListeners: Array<(g: GlassGesture) => void> = []
let session: RecipeSession | null = null

function mockIO(): GlassesIO {
  const nodes = new Map<number, HTMLElement>()
  return {
    async createPage(containers: ContainerSpec[]) {
      hud.innerHTML = ""
      nodes.clear()
      for (const c of containers) {
        const node = document.createElement("div")
        node.className = "hud-container"
        // 576x288の論理座標を%でフレームに割り付け、画面幅に追従させる
        node.style.left = `${(c.x / 576) * 100}%`
        node.style.top = `${(c.y / 288) * 100}%`
        node.style.width = `${(c.w / 576) * 100}%`
        node.style.height = `${(c.h / 288) * 100}%`
        node.style.padding = `${PAD}px`
        node.textContent = c.content
        nodes.set(c.id, node)
        hud.append(node)
      }
      return true
    },
    async updateText(id, _name, content) {
      const node = nodes.get(id)
      if (node) node.textContent = content
    },
    async shutdown() {
      hud.innerHTML = '<div class="hud-off">アプリ終了（2回タップ）</div>'
    },
    onGesture(cb) {
      gestureListeners.push(cb)
      return () => {
        gestureListeners = gestureListeners.filter((l) => l !== cb)
      }
    },
  }
}

function emit(g: GlassGesture): void {
  for (const listener of [...gestureListeners]) listener(g)
}

function populateRecipes(): void {
  select.innerHTML = ""
  for (const { category, recipes } of recipesByCategory()) {
    const group = document.createElement("optgroup")
    group.label = category
    for (const recipe of recipes) {
      const option = document.createElement("option")
      option.value = recipe.id
      option.textContent = recipe.name
      group.append(option)
    }
    select.append(group)
  }
}

async function start(): Promise<void> {
  session?.stop()
  const recipe = allRecipes().find((r) => r.id === select.value)
  if (!recipe) return

  const maxLines = Math.floor(BODY_INNER_H / LINE_HEIGHT)
  const pages = buildPages(recipe, INNER_W, maxLines)
  session = new RecipeSession(mockIO(), recipe.name, pages, {
    onEnd: () => {
      session = null
    },
  })
  await session.start()
}

startBtn.addEventListener("click", () => void start())

for (const btn of document.querySelectorAll<HTMLButtonElement>(".gestures button")) {
  btn.addEventListener("click", () => emit(btn.dataset.g as GlassGesture))
}

document.addEventListener("keydown", (e) => {
  const map: Record<string, GlassGesture> = {
    ArrowRight: "tap",
    " ": "tap",
    ArrowUp: "up",
    ArrowDown: "down",
    Escape: "double",
  }
  const g = map[e.key]
  if (g) {
    e.preventDefault()
    emit(g)
  }
})

populateRecipes()
