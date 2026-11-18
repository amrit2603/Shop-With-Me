import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../src/utils/clipboard";
afterEach(() => vi.restoreAllMocks());
it("uses a selection fallback when the clipboard API refuses and restores focus", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  document.execCommand = vi.fn(() => true);
  const button = document.createElement("button");
  document.body.append(button);
  button.focus();
  await copyText("https://example.test/room/one");
  expect(document.execCommand).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull();
  expect(document.activeElement).toBe(button);
  button.remove();
});
it("does not report success when both copying methods fail", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  document.execCommand = vi.fn(() => false);
  await expect(copyText("link")).rejects.toThrow("Copy unavailable");
  expect(document.querySelector("textarea")).toBeNull();
});
