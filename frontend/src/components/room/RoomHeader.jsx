import { useState, useEffect } from "react";
import RoomReadyCard from "../home/RoomReadyCard";
import { copyText } from "../../utils/clipboard";
import "./RoomHeader.css";

export default function RoomHeader({
  title,
  compact = false,
  roomCode = "",
  expiresAt,
  participantsCount = 1,
  connectionStatus = "connected",
  shareUrl,
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const displayTitle = (title && title.trim()) || "Untitled room";

  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = expiresAt
    ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
    : null;
  const expiryText =
    remaining === null
      ? null
      : remaining <= 0
        ? "Expired"
        : `Decide in ${Math.floor(remaining / 86400)}d ${Math.floor(remaining / 3600) % 24}h ${Math.floor(remaining / 60) % 60}m ${remaining % 60}s`;

  const shortExpiry =
    remaining === null
      ? null
      : remaining <= 0
        ? "Expired"
        : remaining >= 3600
          ? `${Math.ceil(remaining / 3600)}h left`
          : `${Math.ceil(remaining / 60)}m left`;
  const openInvite = async () => {
    setShowInviteModal(true);
    try {
      await copyText(roomCode);
      setCopyError("Code copied!");
    } catch {
      setCopyError("Copy unavailable. Select the code in the invitation.");
    }
  };

  const handleCopyLink = async () => {
    const url = shareUrl || window.location.href;
    try {
      await copyText(url);
      setCopyError("");
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
      setCopyError(
        "Copy unavailable. Open the room code to select the invitation link.",
      );
    }
  };

  return (
    <>
      <header
        className={`room-header ${compact ? "room-header--compact" : ""}`}
      >
        <div className="room-header-main">
          <div className="room-title-row">
            <h1 className="room-title">{displayTitle}</h1>
            {expiryText && (
              <span className="room-expiry-pill">
                {compact ? shortExpiry : expiryText}
              </span>
            )}
          </div>

          <div className="room-meta-row">
            <div
              className="connection-dot-wrap"
              title={`Status: ${connectionStatus}`}
            >
              <span
                className={`connection-dot connection-dot--${connectionStatus}`}
                aria-hidden="true"
              />
              <span className="connection-text">
                {connectionStatus === "connected"
                  ? "Live"
                  : connectionStatus === "reconnecting"
                    ? "Reconnecting"
                    : "Offline"}
              </span>
            </div>

            <span className="room-meta-sep">&bull;</span>
            <span className="participants-count">
              👥 {participantsCount}{" "}
              {participantsCount === 1 ? "friend" : "friends"} here
            </span>

            {roomCode && (
              <>
                <span className="room-meta-sep">&bull;</span>
                <button
                  type="button"
                  className="room-code-tag-btn"
                  onClick={openInvite}
                  title="Copy room code and open sharing options"
                >
                  Code: <strong className="code-text-mono">{roomCode}</strong>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="room-header-actions">
          <button
            type="button"
            className="btn-copy-link"
            onClick={handleCopyLink}
            aria-label="Copy room invite link"
          >
            {copiedLink ? "✓ Copied" : "Copy invite"}
          </button>
          {copyError && <p role="status">{copyError}</p>}
        </div>
      </header>

      {/* Invite Modal showing full RoomReadyCard */}
      {showInviteModal && (
        <div
          className="room-invite-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Invite friends"
        >
          <div className="room-invite-modal-content">
            <RoomReadyCard
              room={{
                code: roomCode,
                shareUrl: shareUrl || window.location.href,
                title: displayTitle,
              }}
              onEnterRoom={() => setShowInviteModal(false)}
              isModal={true}
              onClose={() => setShowInviteModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
