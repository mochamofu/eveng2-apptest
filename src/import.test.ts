// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { parseRecipeHtml, cleanText } from "./import"

function htmlWithJsonLd(json: unknown): string {
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify(json)}</script>
  </head><body></body></html>`
}

describe("cleanText", () => {
  it("タグ除去と空白正規化", () => {
    expect(cleanText("  <strong>醤油</strong>を 大さじ３　入れる ")).toBe("醤油を 大さじ３ 入れる")
  })
  it("実体参照のデコード", () => {
    expect(cleanText("A &amp; B &nbsp;")).toBe("A & B")
  })
})

describe("parseRecipeHtml: JSON-LD", () => {
  it("HowToStepの配列（クックパッド形式）", () => {
    const html = htmlWithJsonLd({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "回鍋肉",
      recipeIngredient: ["豚肉 150g", "キャベツ 1/6個"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "調味料は合わせておく。" },
        { "@type": "HowToStep", text: "豚肉を炒める。" },
      ],
    })
    const recipe = parseRecipeHtml(html)
    expect(recipe).toEqual({
      name: "回鍋肉",
      ingredients: ["豚肉 150g", "キャベツ 1/6個"],
      steps: ["調味料は合わせておく。", "豚肉を炒める。"],
    })
  })

  it("@graph内のRecipeを見つける", () => {
    const html = htmlWithJsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "サイト" },
        {
          "@type": "Recipe",
          name: "唐揚げ",
          recipeIngredient: ["鶏肉 400g"],
          recipeInstructions: [{ "@type": "HowToStep", text: "揚げる。" }],
        },
      ],
    })
    expect(parseRecipeHtml(html)?.name).toBe("唐揚げ")
  })

  it("HowToSectionを展開する", () => {
    const html = htmlWithJsonLd({
      "@type": "Recipe",
      name: "パン",
      recipeIngredient: ["強力粉 300g"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "生地作り",
          itemListElement: [
            { "@type": "HowToStep", text: "粉を混ぜる。" },
            { "@type": "HowToStep", text: "10分こねる。" },
          ],
        },
        { "@type": "HowToStep", text: "焼く。" },
      ],
    })
    expect(parseRecipeHtml(html)?.steps).toEqual(["粉を混ぜる。", "10分こねる。", "焼く。"])
  })

  it("文字列配列・改行区切り文字列のinstructions", () => {
    const arr = htmlWithJsonLd({
      "@type": "Recipe",
      name: "A",
      recipeInstructions: ["切る。", "煮る。"],
    })
    expect(parseRecipeHtml(arr)?.steps).toEqual(["切る。", "煮る。"])

    const str = htmlWithJsonLd({
      "@type": "Recipe",
      name: "B",
      recipeInstructions: "切る。\n煮る。",
    })
    expect(parseRecipeHtml(str)?.steps).toEqual(["切る。", "煮る。"])
  })

  it("@typeが配列でも認識する", () => {
    const html = htmlWithJsonLd([
      {
        "@type": ["Recipe", "NewsArticle"],
        name: "C",
        recipeInstructions: [{ "@type": "HowToStep", text: "混ぜる。" }],
      },
    ])
    expect(parseRecipeHtml(html)?.name).toBe("C")
  })

  it("壊れたJSONはスキップして次を試す", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{broken</script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "D",
        recipeInstructions: ["焼く。"],
      })}</script>
    </head><body></body></html>`
    expect(parseRecipeHtml(html)?.name).toBe("D")
  })
})

describe("parseRecipeHtml: 白ごはん.com形式", () => {
  const shirogohanHtml = `<!doctype html><html><body>
    <h1 id="recipe-name" itemprop="name">だしなし簡単！肉じゃがの基本レシピ</h1>
    <section id="material" class="material">
      <h2>肉じゃがの材料 <span>(3〜4人分)</span></h2>
      <ul><li><a href="#">じゃが芋</a>（男爵芋）　…　500g</li><li>水　…　300ml</li></ul>
      <ul><li>砂糖　…　大さじ3</li></ul>
    </section>
    <section id="howto" class="howto">
      <div class="howto-block">
        <h3 class="howto-ttl">具材の下ごしらえ</h3>
        <p>じゃが芋は皮をむいて3～4cm角に切る。</p>
        <p class="note-text">※これは補足です。</p>
        <p>玉ねぎはくし切りにする。</p>
      </div>
      <div class="howto-block">
        <h3 class="howto-ttl">味付け</h3>
        <p>鍋に<strong>油小さじ1</strong>を入れて中火にかける。</p>
      </div>
    </section>
  </body></html>`

  it("材料と手順を抽出する", () => {
    const recipe = parseRecipeHtml(shirogohanHtml)
    expect(recipe?.name).toBe("だしなし簡単！肉じゃがの基本レシピ")
    expect(recipe?.ingredients).toEqual(["じゃが芋（男爵芋） … 500g", "水 … 300ml", "砂糖 … 大さじ3"])
    expect(recipe?.steps).toEqual([
      "【具材の下ごしらえ】じゃが芋は皮をむいて3～4cm角に切る。",
      "玉ねぎはくし切りにする。",
      "【味付け】鍋に油小さじ1を入れて中火にかける。",
    ])
  })
})

describe("parseRecipeHtml: microdata", () => {
  it("itempropから抽出する", () => {
    const html = `<!doctype html><html><body>
      <div itemscope itemtype="http://schema.org/Recipe">
        <h1 itemprop="name">グラタン</h1>
        <span itemprop="recipeIngredient">マカロニ 100g</span>
        <span itemprop="recipeIngredient">チーズ 50g</span>
        <div itemprop="recipeInstructions"><ul><li>茹でる。</li><li>焼く。</li></ul></div>
      </div>
    </body></html>`
    const recipe = parseRecipeHtml(html)
    expect(recipe?.name).toBe("グラタン")
    expect(recipe?.ingredients).toEqual(["マカロニ 100g", "チーズ 50g"])
    expect(recipe?.steps).toEqual(["茹でる。", "焼く。"])
  })
})

describe("parseRecipeHtml: 非レシピページ", () => {
  it("nullを返す", () => {
    expect(parseRecipeHtml("<html><body><h1>ニュース記事</h1><p>本文。</p></body></html>")).toBeNull()
  })
})
