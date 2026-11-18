import { expect, it } from "vitest";
const following = require("../src/services/partyFollowing");
it("rejects self/offline/cyclic follows, isolates rooms and cleans departure", () => {
  const room = "follow-unit";
  following.join(room, "a", { productId: "one", imageIndex: 0 });
  following.join(room, "b", { productId: "two", imageIndex: 0 });
  expect(() => following.follow(room, "a", "a")).toThrow("yourself");
  expect(() => following.follow(room, "a", "__proto__")).toThrow("left");
  expect(() => following.follow("different-room", "a", "b")).toThrow("left");
  expect(following.follow(room, "a", "b").following.a).toBe("b");
  expect(() => following.follow(room, "b", "a")).toThrow("loop");
  expect(
    following.view(room, "b", { productId: "three", imageIndex: 0 }).views.b
      .productId,
  ).toBe("three");
  expect(following.follow(room, "a", null).following.a).toBeUndefined();
  following.follow(room, "a", "b");
  const after = following.leave(room, "b");
  expect(after.following.a).toBeUndefined();
  expect(after.views.b).toBeUndefined();
  expect(Object.keys(following.leave(room, "a").views)).toHaveLength(0);
});

it("regroups follows without losing members or affecting another room", () => {
  following.join("regroup", "a", {productId:"one",imageIndex:0});
  following.join("regroup", "b", {productId:"two",imageIndex:0});
  following.follow("regroup", "a", "b");
  following.join("kept", "a", {productId:"one",imageIndex:0});
  following.join("kept", "b", {productId:"two",imageIndex:0});
  following.follow("kept", "a", "b");
  expect(following.regroup("regroup").following).toEqual({});
  expect(Object.keys(following.regroup("regroup").views)).toHaveLength(2);
  expect(following.join("kept","a",{}).following.a).toBe("b");
});
