// コンパニオン（スマホ）側のエントリ。レシピの管理UIと、グラスへの
// セッション開始・ミラー表示を担当する。アプリ本体はスマホ上で動き、
// グラスは表示と入力（タッチパッド）のみを受け持つ。

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk"
import {
  allRecipes,
  addCustomRecipe,
  deleteCustomRecipe,
  recipesByCategory,
  type Recipe,
} from "./recipes"
import { fetchRecipeFromUrl } from "./import"
import { pickDailyRecommendations, greeting } from "./recommend"
import { buildPages, LINE_HEIGHT, type GlassPage } from "./pages"
import {
  RecipeSession,
  INNER_W,
  BODY_INNER_H,
  PAD,
  type GlassesIO,
  type ContainerSpec,
  type GlassGesture,
} from "./glasses"
import { formatTime } from "./duration"

const app = document.getElementById("app")!
let session: RecipeSession | null = null

// ---------- ブリッジ ----------

function getBridge(timeoutMs = 4000): Promise<EvenAppBridge | null> {
  return Promise.race([
    waitForEvenAppBridge(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

function realIO(bridge: EvenAppBridge): GlassesIO {
  return {
    async createPage(containers: ContainerSpec[]) {
      const textObject = containers.map(
        (c) =>
          new TextContainerProperty({
            xPosition: c.x,
            yPosition: c.y,
            width: c.w,
            height: c.h,
            borderWidth: 0,
            borderColor: 5,
            paddingLength: PAD,
            containerID: c.id,
            containerName: c.name,
            content: c.content,
            isEventCapture: c.capture ? 1 : 0,
          }),
      )
      const result = await bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer({ containerTotalNum: containers.length, textObject }),
      )
      return Number(result) === 0
    },
    async updateText(id, name, content) {
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({ containerID: id, containerName: name, content }),
      )
    },
    async shutdown() {
      await bridge.shutDownPageContainer(1)
    },
    onGesture(cb: (g: GlassGesture) => void) {
      // protobufは0値のフィールドを省略するため、CLICK_EVENT(0)は
      // eventType が undefined のまま届く。?? 0 で補ってから比較する。
      return bridge.onEvenHubEvent((event) => {
        const sys = event.sysEvent ? (event.sysEvent.eventType ?? 0) : null
        const text = event.textEvent ? (event.textEvent.eventType ?? 0) : null

        if (sys === OsEventTypeList.DOUBLE_CLICK_EVENT || text === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          cb("double")
          return
        }
        if (text === OsEventTypeList.SCROLL_TOP_EVENT || sys === OsEventTypeList.SCROLL_TOP_EVENT) {
          cb("up")
          return
        }
        if (text === OsEventTypeList.SCROLL_BOTTOM_EVENT || sys === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
          cb("down")
          return
        }
        if (sys === OsEventTypeList.CLICK_EVENT || text === OsEventTypeList.CLICK_EVENT) {
          cb("tap")
          return
        }
        if (sys === OsEventTypeList.SYSTEM_EXIT_EVENT || sys === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
          cb("exit")
        }
      })
    },
  }
}

// ---------- 画面描画 ----------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function renderHome(): void {
  app.innerHTML = ""

  app.append(
    el("h1", "app-title", "🍳 レシピナビ for Even G2"),
    el("p", "app-sub", "調理中はグラスに手順を表示。タップで次へ、下スワイプでタイマー。"),
  )

  const status = el("div", "status")
  status.innerHTML =
    "Even Hubコンパニオンアプリ内で「▶ グラスでナビ開始」を押すと、ペアリング済みのG2に手順が表示されます。" +
    'ブラウザだけで試す場合は <a href="/preview.html">G2プレビュー</a> へ。'
  app.append(status)

  app.append(buildRecommendations())

  // 検索ボックス
  const search = el("input", "search-box") as HTMLInputElement
  search.type = "search"
  search.placeholder = `🔍 ${allRecipes().length}件のレシピを検索（料理名・材料）`
  const listContainer = el("div", "recipe-groups")
  search.addEventListener("input", () => renderRecipeList(listContainer, search.value.trim()))
  app.append(search, listContainer)
  renderRecipeList(listContainer, "")

  // レシピ追加フォーム
  const addBtn = el("button", "btn-add", "＋ レシピを追加")
  const form = el("div", "form hidden")
  form.innerHTML = `
    <label>レシピサイトのURLから取り込む</label>
    <div class="url-row">
      <input id="import-url" type="url" inputmode="url" placeholder="https://cookpad.com/jp/recipes/... など">
      <button class="btn-ghost" id="import-btn">読み込む</button>
    </div>
    <div id="import-status" class="import-status"></div>
    <label>レシピ名</label>
    <input id="new-name" maxlength="40" placeholder="例: 味噌汁">
    <label>材料（1行に1つ）</label>
    <textarea id="new-ingredients" placeholder="豆腐 1/2丁&#10;わかめ 適量&#10;味噌 大さじ2"></textarea>
    <label>手順（1行に1つ。「5分煮る」のように書くとタイマーになります）</label>
    <textarea id="new-steps" placeholder="鍋に水400mlを沸かす。&#10;豆腐とわかめを入れて2分煮る。&#10;火を止めて味噌を溶き入れる。"></textarea>
    <div class="form-actions">
      <button class="btn-ghost" id="form-cancel">キャンセル</button>
      <button class="btn-start" id="form-save" style="flex:0 0 auto;">保存</button>
    </div>
  `
  addBtn.addEventListener("click", () => form.classList.toggle("hidden"))

  const importBtn = form.querySelector("#import-btn") as HTMLButtonElement
  const importStatus = form.querySelector("#import-status") as HTMLElement
  importBtn.addEventListener("click", async () => {
    const url = (form.querySelector("#import-url") as HTMLInputElement).value.trim()
    if (!/^https?:\/\//.test(url)) {
      importStatus.textContent = "URLを入力してください（https://〜）"
      return
    }
    importBtn.disabled = true
    importStatus.textContent = "読み込み中…"
    try {
      const recipe = await fetchRecipeFromUrl(url)
      ;(form.querySelector("#new-name") as HTMLInputElement).value = recipe.name
      ;(form.querySelector("#new-ingredients") as HTMLTextAreaElement).value = recipe.ingredients.join("\n")
      ;(form.querySelector("#new-steps") as HTMLTextAreaElement).value = recipe.steps.join("\n")
      importStatus.textContent = `✓ 「${recipe.name}」を読み込みました（材料${recipe.ingredients.length}・手順${recipe.steps.length}）。内容を確認して保存してください。`
    } catch (err) {
      importStatus.textContent = `読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}。下のフォームに手入力もできます。`
    } finally {
      importBtn.disabled = false
    }
  })
  form.querySelector("#form-cancel")!.addEventListener("click", () => form.classList.add("hidden"))
  form.querySelector("#form-save")!.addEventListener("click", () => {
    const name = (form.querySelector("#new-name") as HTMLInputElement).value.trim()
    const ingredients = textareaLines(form, "#new-ingredients")
    const steps = textareaLines(form, "#new-steps")
    if (!name || steps.length === 0) {
      alert("レシピ名と手順を入力してください。")
      return
    }
    addCustomRecipe(name, ingredients, steps)
    renderHome()
  })
  app.append(addBtn, form)
}

function textareaLines(root: ParentNode, selector: string): string[] {
  return (root.querySelector(selector) as HTMLTextAreaElement).value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

// 起動時の「今日のおすすめ」3レシピ。その日の中では同じ3品を表示する。
function buildRecommendations(): HTMLElement {
  const section = el("section", "recommend")
  const recipes = pickDailyRecommendations(allRecipes(), 3)

  const head = el("div", "recommend-head")
  head.innerHTML = `<span class="recommend-greet">${greeting()}！</span><span class="recommend-title">今日のおすすめ</span>`
  section.append(head)

  const grid = el("div", "recommend-grid")
  for (const recipe of recipes) {
    const card = el("button", "recommend-card")
    card.type = "button"
    card.innerHTML =
      `<span class="recommend-cat">${recipe.category ?? "マイレシピ"}</span>` +
      `<span class="recommend-name">${recipe.name}</span>` +
      `<span class="recommend-meta">材料${recipe.ingredients.length} ・ 手順${recipe.steps.length}</span>` +
      `<span class="recommend-go">▶ グラスでナビ開始</span>`
    card.addEventListener("click", () => startNavigation(recipe))
    grid.append(card)
  }
  section.append(grid)
  return section
}

// カテゴリ別のレシピ一覧を描画する。query があれば料理名・材料で絞り込む。
function renderRecipeList(container: HTMLElement, query: string): void {
  container.innerHTML = ""
  const q = query.toLowerCase()
  const match = (r: Recipe) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    r.ingredients.some((i) => i.toLowerCase().includes(q))

  let shown = 0
  for (const { category, recipes } of recipesByCategory()) {
    const hits = recipes.filter(match)
    if (hits.length === 0) continue
    shown += hits.length

    const section = el("section", "recipe-group")
    const header = el("button", "group-header")
    header.type = "button"
    // 検索中は全カテゴリを開いた状態にする
    const open = q.length > 0
    header.innerHTML = `<span class="group-arrow">${open ? "▼" : "▶"}</span><span class="group-name">${category}</span><span class="group-count">${hits.length}</span>`
    const body = el("div", "group-body")
    if (!open) body.classList.add("hidden")
    for (const recipe of hits) body.append(buildRecipeCard(recipe))

    header.addEventListener("click", () => {
      const hidden = body.classList.toggle("hidden")
      const arrow = header.querySelector(".group-arrow")!
      arrow.textContent = hidden ? "▶" : "▼"
    })
    section.append(header, body)
    container.append(section)
  }

  if (shown === 0) {
    container.append(el("p", "empty-message", "該当するレシピがありません。"))
  }
}

function buildRecipeCard(recipe: Recipe): HTMLElement {
  const card = el("div", "recipe-card")
  const head = el("div", "recipe-head")
  const name = el("div", "recipe-name", recipe.name)
  const meta = el("div", "recipe-meta", `材料${recipe.ingredients.length} ・ 手順${recipe.steps.length}`)
  head.append(name, meta)

  const detail = el("div", "recipe-detail hidden")
  detail.textContent =
    `【材料】\n${recipe.ingredients.map((i) => `・${i}`).join("\n")}\n\n` +
    `【手順】\n${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
  head.addEventListener("click", () => detail.classList.toggle("hidden"))

  const actions = el("div", "recipe-actions")
  const start = el("button", "btn-start", "▶ グラスでナビ開始")
  start.addEventListener("click", () => startNavigation(recipe))
  actions.append(start)

  if (!recipe.builtin) {
    const del = el("button", "btn-danger", "削除")
    del.addEventListener("click", () => {
      if (confirm(`「${recipe.name}」を削除しますか？`)) {
        deleteCustomRecipe(recipe.id)
        renderHome()
      }
    })
    actions.append(del)
  }

  card.append(head, detail, actions)
  return card
}

// ---------- セッション ----------

async function startNavigation(recipe: Recipe): Promise<void> {
  const bridge = await getBridge()
  if (!bridge) {
    alert(
      "G2のブリッジに接続できませんでした。Even Hubコンパニオンアプリ内で開いているか確認してください。\n" +
        "ブラウザで試す場合は /preview.html を開いてください。",
    )
    return
  }

  const maxLines = Math.floor(BODY_INNER_H / LINE_HEIGHT)
  const pages = buildPages(recipe, INNER_W, maxLines)

  const ui = renderSessionScreen(recipe)
  session = new RecipeSession(realIO(bridge), recipe.name, pages, {
    onPage: ui.showPage,
    onTimer: ui.showTimer,
    onEnd: () => {
      session = null
      renderHome()
    },
  })

  const ok = await session.start()
  if (!ok) {
    session = null
    renderHome()
    alert(
      "グラスへの画面作成に失敗しました。Even Hubコンパニオンアプリ内で開いているか、G2の接続状態を確認してください。",
    )
  }
}

interface SessionUI {
  showPage: (page: GlassPage, index: number, total: number) => void
  showTimer: (remain: number | null, finished: boolean) => void
}

function renderSessionScreen(recipe: Recipe): SessionUI {
  app.innerHTML = ""
  const overlay = el("div", "session")
  const inner = el("div", "session-inner")

  inner.append(el("h1", "app-title", `🍳 ${recipe.name} — ナビ中`))

  const mirror = el("div", "mirror")
  const mirrorHead = el("div", "mirror-head")
  const mirrorTitle = el("span")
  const mirrorTimer = el("span")
  mirrorHead.append(mirrorTitle, mirrorTimer)
  const mirrorBody = el("div")
  mirror.append(mirrorHead, mirrorBody)

  const hint = el(
    "div",
    "session-hint",
    "グラスのテンプルを操作してください\nタップ: 次へ ／ 上スワイプ: 戻る ／ 下スワイプ: タイマー開始・停止 ／ 2回タップ: 終了",
  )

  const stop = el("button", "btn-stop", "ナビを終了する")
  stop.addEventListener("click", () => {
    session?.stop()
    session = null
    renderHome()
  })

  inner.append(mirror, hint, stop)
  overlay.append(inner)
  app.append(overlay)

  return {
    showPage(page, index, total) {
      mirrorTitle.textContent = `${page.title}（${index + 1}/${total}ページ）`
      mirrorBody.textContent = page.body
    },
    showTimer(remain, finished) {
      mirrorTimer.textContent = finished ? "⏱ タイマー終了！" : remain !== null ? `⏱ ${formatTime(remain)}` : ""
    },
  }
}

renderHome()
