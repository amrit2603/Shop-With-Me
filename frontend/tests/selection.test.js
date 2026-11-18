import { beforeEach, expect, it } from "vitest";
import { recommendProducts } from "../src/utils/recommendProducts";
import {
  readSavedProducts,
  toggleSavedProduct,
} from "../src/utils/savedProducts";
beforeEach(() => sessionStorage.clear());
it("keeps personal saves scoped by user and room with a product link", () => {
  sessionStorage.setItem("vyumi_tab_user", JSON.stringify({ id: "alice" }));
  toggleSavedProduct({ id: "p", name: "Lamp", price: null }, "room-a");
  expect(readSavedProducts("room-a")[0].link).toContain(
    "/room/room-a/product/p",
  );
  expect(readSavedProducts("room-b")).toEqual([]);
  sessionStorage.setItem("vyumi_tab_user", JSON.stringify({ id: "bob" }));
  expect(readSavedProducts()).toEqual([]);
  sessionStorage.setItem("vyumi_tab_user", JSON.stringify({ id: "alice" }));
  expect(readSavedProducts()).toHaveLength(1);
  expect(toggleSavedProduct({ id: "p", name: "Lamp" }, "room-a")).toBe(false);
  expect(readSavedProducts()).toEqual([]);
});
it("honors budget/must-have without inventing missing price or quality", () => {
  const room = {
    products: [
      { id: "a", name: "A", price: 50, category: "Home", description: "Lamp" },
      { id: "b", name: "B", price: 200, category: "Audio" },
      { id: "c", name: "C", price: null, category: "Home" },
    ],
    votes: { a: { one: "Love" } },
  };
  expect(
    recommendProducts(room, "a", {
      budget: "100",
      priority: "price",
      mustHave: "any",
    }).map((x) => x.product.id),
  ).toEqual(["a"]);
  expect(
    recommendProducts(room, "a", {
      budget: "any",
      priority: "quality",
      mustHave: "feedback",
    })[0].reason,
  ).toContain("not independently verified");
  expect(
    recommendProducts(room, "a", {
      budget: "any",
      priority: "price",
      mustHave: "category",
    }).map((x) => x.product.id),
  ).toEqual(["a", "c"]);
  expect(
    recommendProducts(room, "b", {
      budget: "10",
      priority: "price",
      mustHave: "any",
    }),
  ).toEqual([]);
});
