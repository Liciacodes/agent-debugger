import { describe, expect, it } from "vitest";
import { calculateTotal } from "./cart";

describe("calculateTotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("adds up price times quantity", () => {
    const items = [
      { name: "Mug", price: 12, quantity: 2 },
      { name: "Pen", price: 3, quantity: 1 },
    ];

    expect(calculateTotal(items)).toBe(27);
  });

  it("applies a percentage discount", () => {
    const items = [{ name: "Shoes", price: 100, quantity: 2 }];

    expect(calculateTotal(items, 10)).toBe(180);
  });
});
