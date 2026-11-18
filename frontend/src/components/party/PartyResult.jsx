import { copyText } from '../../utils/clipboard';
import { tabFetch } from "../../services/tabSession";
import { useEffect, useState } from "react";
import { API_BASE } from "../../services/api";
import { themeValue } from "../../utils/theme";
export default function PartyResult({ shareId, isCreator }) {
  const [result, setResult] = useState(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    tabFetch(`${API_BASE}/api/results/${shareId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Result unavailable.");
        return r.json();
      })
      .then((d) => setResult(d.result))
      .catch((e) => setMessage(e.message));
  }, [shareId]);
  if (!result) return <p role="status">{message || "Loading your result…"}</p>;
  const url = `${window.location.origin}/r/${shareId}`;
  const copy = async (text) => {
    try {
      await copyText(text);
      setMessage("Copied");
    } catch {
      setMessage("Copy is unavailable. Select the link below.");
    }
  };
  async function setting(body) {
    try {
      const r = await tabFetch(`${API_BASE}/api/results/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Could not update sharing.");
      setMessage(
        body.revoked
          ? "Public link revoked."
          : "Names hidden from the public page.",
      );
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function download() {
    await document.fonts.ready;
    const font = themeValue('font-sans');
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 900;
    const c = canvas.getContext("2d");
    c.fillStyle = themeValue('bg');
    c.fillRect(0, 0, 1080, 900);
    c.fillStyle = themeValue('accent');
    c.font = `bold ${themeValue("export-party-brand")} ${font}`;
    c.fillText("VYUMI · Shop With Me", 60, 90);
    c.fillStyle = themeValue('text');
    c.font = `bold ${themeValue("export-party-heading")} ${font}`;
    let y = 190;
    for (const sentence of result.headline.split(". ").filter(Boolean)) {
      c.fillText(sentence.slice(0, 32), 60, y);
      y += 80;
    }
    c.font = `${themeValue("export-party-product")} ${font}`;
    c.fillText(
      result.winner?.name.slice(0, 48) ||
        (result.tied ? "Tied — keep the conversation going" : "No winner yet"),
      60,
      y + 70,
    );
    c.font = `${themeValue("export-party-stats")} ${font}`;
    c.fillText(
      `${result.participants} participants · ${result.reactionsReceived} reactions`,
      60,
      760,
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = "vyumi-party-result.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    });
  }
  return (
    <section className="party-result">
      <h2>{result.headline}</h2>
      <p>{result.summary}</p>
      <div className="party-stats">
        <span>{result.participants} participants</span>
        <span>{result.productsExplored} products explored</span>
        <span>{result.reactionsReceived} reactions</span>
      </div>
      <ol className="party-podium">
        {result.ranking.map((p, i) => (
          <li key={p.id}>
            <span>{i + 1}</span>
            <strong>{p.name}</strong>
            <span>{p.score} points</span>
          </li>
        ))}
      </ol>
      <div className="party-actions">
        <button onClick={() => copy(`${result.headline} ${result.summary}`)}>
          Copy summary
        </button>
        <button onClick={() => copy(url)}>Copy result link</button>
        <button
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({
                  title: "Our shopping party",
                  text: result.headline,
                  url,
                });
              } catch {
                setMessage("Sharing cancelled.");
              }
            } else await copy(url);
          }}
        >
          Share result
        </button>
        <button onClick={download}>Download image</button>
        {isCreator && (
          <>
            <button onClick={() => setting({ hideNames: true })}>
              Hide names
            </button>
            <button onClick={() => setting({ revoked: true })}>
              Revoke public link
            </button>
          </>
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer">
        View public result
      </a>
      <p role="status">{message}</p>
    </section>
  );
}
