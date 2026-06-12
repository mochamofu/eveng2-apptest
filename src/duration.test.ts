import { describe, it, expect } from "vitest"
import { parseDurationSec, formatTime, normalizeDigits } from "./duration"

describe("parseDurationSec", () => {
  it("分を抽出する", () => {
    expect(parseDurationSec("中火で5分煮る")).toBe(300)
  })
  it("秒を抽出する", () => {
    expect(parseDurationSec("蓋をして30秒加熱する")).toBe(30)
  })
  it("時間+分を合算する", () => {
    expect(parseDurationSec("冷蔵庫で1時間30分置く")).toBe(5400)
  })
  it("時間のみ", () => {
    expect(parseDurationSec("2時間煮込む")).toBe(7200)
  })
  it("範囲表現は最初の数値を使う", () => {
    expect(parseDurationSec("弱火で10〜15分煮る")).toBe(600)
  })
  it("全角数字に対応する", () => {
    expect(parseDurationSec("５分茹でる")).toBe(300)
  })
  it("時間表現がなければnull", () => {
    expect(parseDurationSec("塩こしょうで味を調える")).toBeNull()
  })
  it("最初の時間表現を採用する", () => {
    expect(parseDurationSec("7分茹でて、3分蒸らす")).toBe(420)
  })
})

describe("formatTime", () => {
  it("M:SS形式にする", () => {
    expect(formatTime(272)).toBe("4:32")
    expect(formatTime(60)).toBe("1:00")
    expect(formatTime(5)).toBe("0:05")
    expect(formatTime(0)).toBe("0:00")
  })
  it("負値は0:00に丸める", () => {
    expect(formatTime(-3)).toBe("0:00")
  })
})

describe("normalizeDigits", () => {
  it("全角→半角", () => {
    expect(normalizeDigits("１２３分")).toBe("123分")
  })
})
