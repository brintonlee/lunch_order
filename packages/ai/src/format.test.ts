import { describe, expect, it } from "vitest";
import { parseMenuText } from "./format.js";
import { coerceModelOutput } from "./prompt.js";

describe("parseMenuText", () => {
  it("parses the plain text template", () => {
    const d = parseMenuText(`店名: 八方雲集
電話：02-1234-5678
[鍋貼]
招牌鍋貼 7
韭菜鍋貼, 7
# 湯
酸辣湯\t35元
牛肉麵 $120
// 註解
`);
    expect(d.storeName).toBe("八方雲集");
    expect(d.phone).toBe("02-1234-5678");
    expect(d.items).toMatchObject([
      { name: "招牌鍋貼", price: 7, category: "鍋貼" },
      { name: "韭菜鍋貼", price: 7, category: "鍋貼" },
      { name: "酸辣湯", price: 35, category: "湯" },
      { name: "牛肉麵", price: 120, category: "湯" }
    ]);
  });

  it("parses JSON", () => {
    const d = parseMenuText(JSON.stringify({ storeName: "A", items: [{ name: "x", price: 10 }] }));
    expect(d.items[0]).toMatchObject({ name: "x", price: 10, category: "" });
  });

  it("reports unreadable lines and missing store name", () => {
    expect(() => parseMenuText("店名: A\n沒有價格的行")).toThrow(/第 2 行/);
    expect(() => parseMenuText("滷肉飯 40")).toThrow(/店名/);
    expect(() => parseMenuText("店名: A\n滷肉飯 1000000")).toThrow(/第 2 行/);
  });
});

describe("coerceModelOutput", () => {
  it("strips fences and clamps values", () => {
    const d = coerceModelOutput('```json\n{"storeName":"","items":[{"name":"麵","price":"55.4","confidence":2}]}\n```', "提示店");
    expect(d.storeName).toBe("提示店");
    expect(d.items[0]).toMatchObject({ name: "麵", price: 55, confidence: 1 });
  });
});
