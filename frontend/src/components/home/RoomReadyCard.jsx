import { RectangleButtons } from "../RectangleButtons";
import { copyText } from "../../utils/clipboard";
import { useState } from "react";
import "./RoomReadyCard.css";
export default function RoomReadyCard({
  room,
  onEnterRoom,
  isModal = false,
  onClose = null,
}) {
  const [copied, setCopied] = useState(false),
    [message, setMessage] = useState("");
  if (!room) return null;
  const code = room.code || room.id?.slice(0, 6).toUpperCase();
  const url =
    room.shareUrl || `${window.location.origin}/room/${room.id || code}`;
  async function copy(text = url, label = "Link") {
    try {
      await copyText(text);
      setCopied(label === "Link");
      setMessage(`${label} copied!`);
    } catch {
      setCopied(false);
      setMessage("Copy unavailable. Select the code or invitation link.");
    }
  }
  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: room.title || "Shop With Me",
        text: "Help me choose! Join my shopping room.",
        url,
      });
      setMessage("Invitation shared.");
    } catch (error) {
      if (error.name === "AbortError") setMessage("Sharing cancelled.");
      else await copy();
    }
  }
  return (
    <>
      <div
        id="room-ready-card"
        className={`room-ready-card ${isModal ? "room-ready-card--modal" : ""}`}
        role="region"
        aria-label="Room ready"
      >
        <div className="ready-header-row">
          {isModal && onClose && (
            <RectangleButtons
              className="ready-close-btn"
              aria-label="Close dialog"
              onClick={onClose}
            >
              ×
            </RectangleButtons>
          )}
        </div>
        <h2 className="ready-title">Invite friends to vote.</h2>
        <p className="ready-subtitle">
          Share the link. Friends enter their own name.
        </p>
        <div className="large-code-container">
          <span className="large-code-label">ROOM CODE · CLICK TO COPY</span>
          <RectangleButtons
            type="button"
            className="large-code-display"
            aria-label={`Copy room code ${code}`}
            onClick={() => copy(code, "Code")}
          >
            {code}
          </RectangleButtons>
        </div>
        <div className="share-row">
          <input
            className="room-ready-link-input"
            aria-label="Shareable room link"
            readOnly
            value={url}
          />
          <RectangleButtons
            className="btn-copy-ready btn-copy-link"
            onClick={() => copy()}
          >
            {copied ? "Copied!" : "Copy link"}
          </RectangleButtons>
        </div>
        <div className="ready-secondary-actions" aria-label="Send invitation">
        <RectangleButtons
          type="button"
          className="btn-action-outline btn-web-share"
          onClick={share}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" /></svg>
          Share
        </RectangleButtons>
        <a
          className="btn-action-outline whatsapp-share"
          href={`https://wa.me/?text=${encodeURIComponent(`Help me choose! Join my shopping room: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z"/><path d="M8 8c0 4 2 6 6 7l2-2-3-1-1 1-2-3 1-1-1-2Z"/></svg>
          Share on WhatsApp
        </a>
        </div>
        <p role="status">{message}</p>
      </div>
      {!isModal && (
        <div className="ready-actions-footer">
          <RectangleButtons className="btn-enter-room" onClick={onEnterRoom}>
            Open live room →
          </RectangleButtons>
        </div>
      )}
    </>
  );
}
