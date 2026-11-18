import { useState } from "react";
import useParty from "./useParty";
import ShoppingHostPanel from "./ShoppingHostPanel";
import PartyResult from "./PartyResult";
import ProductComments from "../ProductComments";
import ProductActions from "../ProductActions";
import { postComment, apiUrl } from "../../services/api";
import { getInitials, getParticipantColor } from "../../utils/identity";
import "./PartyStage.css";
const reactions = [
  ["Love", "Love it", "❤️"],
  ["Like", "Looks great", "🔥"],
  ["No", "Not for me", "👎"],
  ["Need more info", "Unsure", "🤔"],
];
export default function PartyStage({
  room,
  participant,
  socket,
  isCreator,
  onPartyChange,
  onPartyEnded,
  onHostChange,
  onlineParticipantIds = [],
  initialProductId,
}) {
  const [person, setPerson] = useState("");
  const {
    state,
    localId,
    setLocalId,
    image,
    setImage,
    error,
    setError,
    bursts,
    setBursts,
    busy,
    start,
    send,
    peers,
    followView,
    hostNote,
    setHostNote,
  } = useParty({
    room,
    participant,
    socket,
    onPartyChange,
    onPartyEnded,
    onHostChange,
    initialProductId,
  });
  if (!state)
    return isCreator ? (
      <section className="party-start">
        <button
          className="btn-primary"
          disabled={!participant || busy}
          onClick={start}
        >
          Start Shopping Party
        </button>
        <p>Don’t just share products. Experience shopping together.</p>
        {error && <p role="alert">{error}</p>}
      </section>
    ) : null;
  if (state.status === "ended")
    return <PartyResult shareId={state.shareId} isCreator={isCreator} />;
  const host = state.hostParticipantId === participant?.id;
  const product =
    room.products.find(
      (p) =>
        p.id === (followView?.productId || localId || state.currentProductId),
    ) || room.products[0];
  if (!product) return null;
  const images = product.images?.length ? product.images : [product.imageUrl],
    displayImage = followView?.imageIndex ?? image;
  const disabled = !participant || !socket?.connected,
    totals = room.voteTotals?.[product.id] || {},
    vote = room.votes?.[product.id]?.[participant?.id];
  const target = state.mode === "explore" ? peers.following[participant?.id] : null,
    members = room.participants || [],
    name = (id) => members.find((p) => p.id === id)?.name || "A friend";
  function navigate(id) {
    if (target) send("follow", { toParticipantId: null });
    setLocalId(null);
    setImage(0);
    send("navigate", { productId: id });
  }
  return (
    <section className="party-stage" aria-label="Live Shopping Party">
      <div className="party-presence" aria-label="Party presence">
        <div className="party-avatars">
          {members
            .filter((p) => onlineParticipantIds.includes(p.id))
            .map((p) => (
              <span
                key={p.id}
                className="party-avatar"
                title={p.name}
                style={{ background: getParticipantColor(p.id) }}
              >
                {getInitials(p.name)}
              </span>
            ))}
        </div>
        <span>{onlineParticipantIds.length} in the room</span>
        <span className={`party-live ${socket?.connected ? "is-live" : ""}`}>
          <i aria-hidden="true" />
          {socket?.connected ? "LIVE" : "CONNECTING"}
        </span>
      </div>
      <header className="party-topline">
        <p className="party-following">
          {target
            ? `Following ${name(target)}`
            : state.mode === "explore"
              ? "Browse separately. Suggest a product to show everyone."
              : host
                ? "Your friends see what you choose."
                : `${name(state.hostParticipantId)} is showing this product.`}
        </p>
        <details className="party-controls">
          <summary>Manage party</summary>
          <ul className="party-member-list" aria-label="Party members">
            {members.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name}
                  {p.id === participant?.id ? " (You)" : ""} ·{" "}
                  {onlineParticipantIds.includes(p.id) ? "Online" : "Offline"}
                  {peers.following[p.id]
                    ? ` · Following ${name(peers.following[p.id])}`
                    : ""}
                </span>

              </li>
            ))}
          </ul>
          {!onlineParticipantIds.filter((id) => id !== participant?.id)
            .length && <p>No other friends online. Invite someone to join.</p>}
          <p>{state.mode === "host" ? "Everyone follows the host. Switch to Explore independently to follow a friend." : "Browse freely, follow a friend, or suggest a product to the host."}</p>
          <div className="party-actions">
            <label>
              Choose a person
              <select
                aria-label="Choose a person"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              >
                <option value="">Choose a person</option>
                {members
                  .filter(
                    (p) =>
                      p.id !== participant?.id &&
                      Object.hasOwn(peers.views, p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={disabled || state.mode !== "explore" || !Object.hasOwn(peers.views, person)}
              onClick={() => send("follow", { toParticipantId: person })}
            >
              Follow
            </button>
            <button
              disabled={disabled || !target}
              onClick={() => send("follow", { toParticipantId: null })}
            >
              Unfollow
            </button>
            {host && (
              <button
                disabled={disabled || !Object.hasOwn(peers.views, person)}
                onClick={() => send("transfer", { toParticipantId: person })}
              >
                Let this person lead
              </button>
            )}
          </div>
          {host && (
            <div className="party-actions">
              <label>
                Shared browsing
                <select
                  aria-label="Party mode"
                  value={state.mode}
                  disabled={disabled}
                  onChange={(e) => send("set-mode", { mode: e.target.value })}
                >
                  <option value="host">Follow the host</option>
                  <option value="explore">Explore independently</option>
                </select>
              </label>
              <button
                disabled={disabled}
                onClick={() => send("mute", { muted: !state.hostMuted })}
              >
                {state.hostMuted
                  ? "Resume automatic tips"
                  : "Pause automatic tips"}
              </button>
              <button
                disabled={disabled}
                onClick={() => {
                  if (window.confirm("End the party and create your result?"))
                    send("end");
                }}
              >
                End party
              </button>
            </div>
          )}
        </details>
      </header>
      <div className="party-product">
        <div className="party-gallery">
          <img
            className="party-main-image"
            src={apiUrl(images[displayImage] || images[0])}
            alt={product.name}
          />
          <div className="party-thumbnails">
            {images.map((src, i) => (
              <button
                key={src + i}
                aria-label={`View image ${i + 1}`}
                aria-pressed={displayImage === i}
                onClick={() => {
                  if (target) send("follow", { toParticipantId: null });
                  setImage(i);
                  if (host)
                    send("navigate", { productId: product.id, imageIndex: i });
                }}
              >
                <img src={apiUrl(src)} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="party-product-info">
          <div className="party-product-heading">
            <h3 data-testid="party-current-product">{product.name}</h3>
            <p className="party-price">
              {product.price == null
                ? "Price unknown"
                : new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: product.currency || "INR",
                  }).format(product.price)}
            </p>
          </div>
          <div
            className="party-reactions"
            aria-label="What do you think of this product?"
          >
            {reactions.map(([key, label, icon]) => (
              <button
                key={key}
                disabled={disabled}
                aria-pressed={vote === key}
                aria-label={label}
                onClick={() =>
                  send("react", { productId: product.id, vote: key })
                }
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
                <strong>{totals[key] || 0}</strong>
              </button>
            ))}
          </div>
          {state.mode === "explore" &&
            !host &&
            localId &&
            localId !== state.currentProductId && (
              <div className="party-actions">
                <button
                  disabled={disabled}
                  onClick={() => send("suggest", { productId: product.id })}
                >
                  Suggest this
                </button>
                <button
                  onClick={() => {
                    setLocalId(null);
                    setImage(state.imageIndex);
                  }}
                >
                  Back to group
                </button>
              </div>
            )}
          <div className="party-bursts" aria-hidden="true">
            {bursts.map((b) => (
              <span
                key={b.id}
                onAnimationEnd={() =>
                  setBursts((prev) => prev.filter((x) => x.id !== b.id))
                }
              >
                {reactions.find((x) => x[0] === b.vote)?.[2]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="party-navigation">
        <span>{host ? "You’re hosting · Choose what everyone sees" : state.mode === "host" ? `Watching ${name(state.hostParticipantId)} · Tap a product to suggest it` : "Explore products · Suggest a favourite"}</span>
        {host && <div className="party-actions">
          <button disabled={disabled || room.products.findIndex(p => p.id === product.id) <= 0} onClick={() => navigate(room.products[room.products.findIndex(p => p.id === product.id) - 1].id)}>Previous</button>
          <button disabled={disabled || room.products.findIndex(p => p.id === product.id) >= room.products.length - 1} onClick={() => navigate(room.products[room.products.findIndex(p => p.id === product.id) + 1].id)}>Next product</button>
        </div>}
      </div>
      <div className="party-rail" aria-label="Party products">
        {room.products.map((p, i) => (
          <div key={p.id}>
            <button
              title={p.name}
              aria-label={`${!host && state.mode === "host" ? "Suggest" : "View"} ${p.name}`}
              aria-pressed={product.id === p.id}
              disabled={disabled}
              onClick={() =>
                !host && state.mode === "host"
                  ? send("suggest", { productId: p.id })
                  : navigate(p.id)
              }
            >
              <img src={apiUrl(p.imageUrl)} alt="" />
              <span>{i + 1}</span>
            </button>
          </div>
        ))}
      </div>
      {state.suggestions.length > 0 && (
        <section className="party-suggestions">
          <h3>Suggested by friends</h3>
          {state.suggestions.map((s) => (
            <div key={s.productId}>
              <span>
                {room.products.find((p) => p.id === s.productId)?.name} ·{" "}
                {s.count} suggestions {s.note}
              </span>
              {host && (
                <button
                  disabled={disabled}
                  onClick={() =>
                    send("take-me-there", { productId: s.productId })
                  }
                >
                  Bring everyone here
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="party-tools">
        <details className="party-notes" open>
          <summary>Product details</summary>
          <div className="party-notes-body">
            <p>{product.description}</p>
            <ProductActions compact product={product} roomId={room.id} />
          </div>
        </details>
        <ShoppingHostPanel key={product.id} room={room} currentProductId={product.id} disabled={disabled} send={send} hostNote={hostNote} onDismiss={() => setHostNote(null)} />
        <section className="party-comments" aria-label="Product comments">
          <h3>Product comments</h3>
          <p className="party-comments-product">{product.name}</p>
            <ProductComments compact
              defaultExpanded
              key={product.id}
              productId={product.id}
              comments={room.comments?.[product.id] || []}
              isJoined={!disabled}
              onPostComment={async (id, text) => {
                try {
                  await postComment(room.id, id, {
                    participantId: participant.id,
                    participantToken: participant.participantToken,
                    text,
                  });
                } catch (e) {
                  setError(e.message);
                  throw e;
                }
              }}
            />
        </section>
      </div>
      {error && (
        <p role="alert" className="party-error">
          {error}
        </p>
      )}
    </section>
  );
}
