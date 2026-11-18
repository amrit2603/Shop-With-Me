import { RectangleButtons } from "./RectangleButtons";
import { useEffect, useRef, useState } from "react";
import { authRequest, useAuth } from "../services/auth";
import "./DemoEntry.css";
export default function DemoEntry({ onJoinCode, joinError, invited = false, invitation = "" }) {
  const { setUser, loading } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [code, setCode] = useState(null);
  const nameInput = useRef(null);
  useEffect(() => {
    if (invited) nameInput.current?.focus({ preventScroll: true });
  }, [invited]);
  async function enter(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await authRequest("demo", {
        displayName: new FormData(e.currentTarget).get("displayName"),
      });
      setUser(d.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`demo-entry ${invited ? "demo-entry--invited" : ""}`}>
      <div className="demo-entry-intro">
        <p className="demo-eyebrow">Shop With Me</p>
        <h1>{invited ? "Join your friends." : <>Shopping is better<br />with your people.</>}</h1>
        <p>{invited ? "Your invitation stays here. Add your name and you’re in." : "Bring your shortlist. Invite your friends. Find the one together."}</p>
      </div>
      <div className="demo-entry-forms">
        <form className="demo-name-form" onSubmit={enter}>
          {invited && <div className="pending-invitation" role="status">
            <strong>Invitation ready</strong>

          </div>}
          <h2>What should we call you?</h2>
          <p>Just your name. No email or password.</p>
          <label>
            Your name
            <input
              ref={nameInput}
              name="displayName"
              aria-label={invited?"Your display name":undefined}
              required
              minLength={2}
              maxLength={24}
              autoComplete="nickname"
              placeholder="Enter your name"
            />
          </label>
          <RectangleButtons className={`btn-primary ${invited?"btn-join-room":""}`} disabled={busy || loading}>
            {busy ? "Getting ready…" : invited?"Join Room":"Enter demo"}
          </RectangleButtons>
          {error && <p role="alert">{error}</p>}
        </form>
        <form className="demo-invite-form"
          onSubmit={(e) => {
            e.preventDefault();
            onJoinCode(new FormData(e.currentTarget).get("code"));
          }}
        >
          <h2>{invited ? "Your invitation" : "Already invited?"}</h2>
          <label>
            Room code or link
            <input name="code" required placeholder="Paste your invitation" value={code ?? invitation} onChange={e => setCode(e.target.value)} />
          </label>
          <RectangleButtons className="demo-join-button">{invited ? "Update invitation" : "Join with a code"}</RectangleButtons>
          {joinError && <p role="alert">{joinError}</p>}
        </form>
      </div>
      <div className="demo-orb" aria-hidden="true"><div className="demo-orb-body" /></div>
      <aside className="demo-sample" aria-label="Sample party preview">
        <p>Sample shortlist · preview only</p>
        <div className="sample-product"><img src="/products/arkive-haircare-duo.jpg" alt="" /><span>Find your favourite.<br /><strong>Choose it together.</strong></span></div>
        <div className="sample-reactions" aria-hidden="true"><span>Love it</span><span>Looks great</span></div>
      </aside>
    </section>
  );
}
