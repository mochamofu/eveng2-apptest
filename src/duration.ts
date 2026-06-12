// 手順テキストから加熱・待ち時間を抽出するユーティリティ。
// 「中火で5分煮る」「30秒レンジで加熱」「1時間30分置く」などに対応する。

const ZENKAKU_DIGITS = "０１２３４５６７８９"

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) => String(ZENKAKU_DIGITS.indexOf(c)))
}

/**
 * テキスト中の最初の時間表現を秒で返す。見つからなければ null。
 * 「1時間30分」のような複合表現は合算する。
 * 「10〜15分」のような範囲は最初の数値（短い方）を採用する。
 */
export function parseDurationSec(text: string): number | null {
  const t = normalizeDigits(text)

  const hourMatch = t.match(/(\d+(?:\.\d+)?)\s*時間(?:\s*(\d+(?:\.\d+)?)\s*分)?/)
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1])
    const minutes = hourMatch[2] ? parseFloat(hourMatch[2]) : 0
    return Math.round(hours * 3600 + minutes * 60)
  }

  const minSecMatch = t.match(/(\d+(?:\.\d+)?)(?:\s*[〜~～-]\s*\d+(?:\.\d+)?)?\s*(分|秒)/)
  if (minSecMatch) {
    const n = parseFloat(minSecMatch[1])
    return Math.round(minSecMatch[2] === "分" ? n * 60 : n)
  }

  return null
}

/** 秒を「M:SS」表記にする（例: 272 → "4:32"） */
export function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}
