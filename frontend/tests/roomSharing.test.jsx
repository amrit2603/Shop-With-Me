import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RoomReadyCard from "../src/components/home/RoomReadyCard";
const room = {
  id: "room-one",
  code: "ABC234",
  title: "Our choices",
  shareUrl: "http://localhost:3001/room/room-one",
};
afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.share;
});
function clipboard() {
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}
it("copies the actual code and link separately, replacing stale clipboard content", async () => {
  const writeText = clipboard();
  render(<RoomReadyCard room={room} />);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Copy room code ABC234" }),
    ),
  );
  expect(writeText).toHaveBeenLastCalledWith("ABC234");
  expect(screen.getByRole("status")).toHaveTextContent("Code copied!");
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Copy link", exact: true }),
    ),
  );
  expect(writeText).toHaveBeenLastCalledWith(room.shareUrl);
  expect(screen.getByRole("status")).toHaveTextContent("Link copied!");
});
it("shares the invitation URL through native Share, or copies it when unsupported", async () => {
  const writeText = clipboard(),
    share = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  render(<RoomReadyCard room={room} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Share", exact: true })),
  );
  expect(share).toHaveBeenCalledWith({
    title: room.title,
    text: "Help me choose! Join my shopping room.",
    url: room.shareUrl,
  });
  expect(writeText).not.toHaveBeenCalled();
  delete navigator.share;
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Share", exact: true })),
  );
  expect(writeText).toHaveBeenLastCalledWith(room.shareUrl);
  expect(screen.getByRole("status")).toHaveTextContent("Link copied!");
});
it("handles cancelled sharing and failed copying without false success", async () => {
  clipboard();
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelled", "AbortError")),
  });
  render(<RoomReadyCard room={room} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Share", exact: true })),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Sharing cancelled.");
  navigator.clipboard.writeText.mockRejectedValue(new Error("denied"));
  document.execCommand = vi.fn(() => false);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Copy room code ABC234" }),
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Copy unavailable");
  expect(screen.getByRole("status")).not.toHaveTextContent("copied!");
});
