import { copyText } from "../utils/clipboard";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  readSavedProducts,
  toggleSavedProduct,
  safeProductUrl,
  productLink,
} from "../utils/savedProducts";
import "./ProductActions.css";
export default function ProductActions({ product, roomId: providedRoomId, compact = false }) {
  const params = useParams(),
    roomId = providedRoomId || product.roomId || params.roomId;
  const [savedItems, setSavedItems] = useState(readSavedProducts);
  const saved = savedItems.some(p => p.id === product.id && p.roomId === roomId);
  const [feedback, setFeedback] = useState(null);
  const message = feedback?.productId === product.id && feedback?.roomId === roomId ? feedback.text : '';
  const setMessage = text => setFeedback({productId:product.id,roomId,text});
  useEffect(() => {
    const update = () => setSavedItems(readSavedProducts());
    window.addEventListener("vyumi:saved", update);
    return () => window.removeEventListener("vyumi:saved", update);
  }, []);
  const source = safeProductUrl(product.sourceUrl || product.product_url),
    link = roomId ? productLink(roomId, product.id) : "";
  async function copy() {
    try {
      await copyText(link);
      setMessage("Link copied!");
    } catch {
      setMessage("Copy unavailable. Select the product link.");
    }
  }
  const extras = <>
      {compact && <Link to="/saved">My saved</Link>}
      {link && (
        <>
          <a href={link}>Product details</a>
          <button onClick={copy}>Copy product link</button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title: product.name, url: link });
                } catch {
                  setMessage("Sharing cancelled.");
                }
              } else await copy();
            }}
          >
            Share
          </button>
        </>
      )}
  </>;
  return (
    <div className={`product-actions ${compact ? "product-actions--compact" : ""}`}>

      <button
        type="button"
        aria-pressed={saved}
        onClick={() => {
          try {
            const active = toggleSavedProduct(product, roomId);
            setMessage(
              active ? "Saved – copy link" : "Removed from your saved list.",
            );
          } catch (e) {
            setMessage(e.message);
          }
        }}
      >
        {saved ? "♥ Saved for me" : "♡ Save for me"}
      </button>
      {!compact && <Link to="/saved">My saved</Link>}
      {source ? (
        <a href={source} target="_blank" rel="noopener noreferrer">
          Buy / View product
        </a>
      ) : link ? (
        <a href={link}>Buy / View product</a>
      ) : (
        <button disabled title="Store link unavailable">
          Buy / View product
        </button>
      )}
      {compact ? <details className="product-extra-actions"><summary>More</summary><div>{extras}</div></details> : extras}
      <span className="product-action-status" role="status">
        {message}
        {message === "Saved – copy link" && (
          <button onClick={copy}>Saved – copy link</button>
        )}
      </span>
    </div>
  );
}
