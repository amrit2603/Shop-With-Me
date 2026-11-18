import { copyText } from "../utils/clipboard";
import { useState } from "react";
import "./CopyLinkButton.css";

export default function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleCopy() {
    try {
      await copyText(url);
      setError("");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setError("Copy unavailable. Select the link instead.");
    }
  }

  return (
    <div className="copy-link">
      {error && <p role="status">{error}</p>}
      <input
        id="shareable-url"
        className="copy-link-input"
        type="text"
        value={url}
        readOnly
        onClick={(e) => e.target.select()}
      />
      <button
        id="copy-link-btn"
        className={`copy-link-btn ${copied ? "copy-link-btn--copied" : ""}`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? "✓ Copied!" : "📋 Copy Link"}
      </button>
    </div>
  );
}
