import { tabFetch } from "../../services/tabSession";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../services/api";
export default function useParty({
  room,
  participant,
  socket,
  onPartyChange,
  onPartyEnded,
  onHostChange,
  initialProductId,
}) {
  const [state, setState] = useState(null),
    [localId, setLocalId] = useState(null),
    [image, setImage] = useState(0),
    [error, setError] = useState(""),
    [hostNote, setHostNote] = useState(null),
    [bursts, setBursts] = useState([]),
    [busy, setBusy] = useState(false);
  const [peers,setPeers]=useState({views:{},following:{}});
  const initialApplied=useRef(null);
  const version = useRef(0);
  const previousState = useRef(null);
  let followed=peers.following[participant?.id];
  const seen=new Set();
  while(followed&&peers.following[followed]&&!seen.has(followed)){seen.add(followed);followed=peers.following[followed];}
  const followView=state?.mode === "explore" && followed ? peers.views[followed] : null;
  const viewedId=followView?.productId||localId||state?.currentProductId;
  const viewedImage=followView?.imageIndex??image;
  useEffect(()=>{if(state&&initialProductId!==initialApplied.current&&initialProductId){initialApplied.current=initialProductId;setLocalId(initialProductId);}},[state,initialProductId]);
  useEffect(()=>{if(socket?.connected&&participant&&state?.status==="live"&&viewedId)socket.emit("party:view",{productId:viewedId,imageIndex:viewedImage});},[socket,participant,state?.status,viewedId,viewedImage]);
  const accept = useCallback((payload) => {
    const next = payload.state;
    if (next && next.version >= version.current) {
      version.current = next.version;
      setState(next);
      const previous = previousState.current;
      const navigationChanged = !previous || previous.currentProductId !== next.currentProductId || previous.imageIndex !== next.imageIndex;
      const regrouped = payload.force || previous?.mode !== next.mode || previous?.hostParticipantId !== next.hostParticipantId;
      if (regrouped || (next.mode === "host" && navigationChanged)) setLocalId(null);
      if (regrouped || (next.mode === "host" && navigationChanged)) setImage(next.imageIndex || 0);
      previousState.current = next;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    tabFetch(`${API_BASE}/api/rooms/${room.id}/party`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.state) accept(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [room.id, accept]);
  useEffect(() => {
    onPartyChange(Boolean(state));
    onPartyEnded(state?.status === "ended");
    onHostChange(state?.hostParticipantId||null);
  }, [state, onPartyChange, onPartyEnded, onHostChange]);
  useEffect(() => {
    if (!socket || !participant) return;
    const join = () =>
      socket.emit(
        "party:join",
        {
          roomId: room.id,
          participantId: participant.id,
          participantToken: participant.participantToken,
          lastVersion: version.current,
        },
        (r) => {
          if (r.ok) accept(r);
        },
      );
    const burst = (p) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setBursts((prev) => [...prev.slice(-19), p]);
    };
    const started = (p) => {
      accept(p);
      join();
    };
    socket.on("party:started", started);
    socket.on("connect", join);
    socket.on("party:state", accept);
    socket.on("party:peers",setPeers);
    socket.on("party:host", setHostNote);
    socket.on("party:burst", burst);
    if (socket.connected) join();
    return () => {
      socket.off("party:started", started);
      socket.off("connect", join);
      socket.off("party:state", accept);
      socket.off("party:peers",setPeers);
      socket.off("party:host", setHostNote);
      socket.off("party:burst", burst);
    };
  }, [socket, participant, room.id, accept]);
  async function start() {
    if (!participant) return;
    setBusy(true);
    setError("");
    try {
      const r = await tabFetch(`${API_BASE}/api/rooms/${room.id}/party`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          participantToken: participant.participantToken,
        }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error?.message || "Could not start the party.");
      accept(d);
      socket?.emit(
        "party:join",
        {
          roomId: room.id,
          participantId: participant.id,
          participantToken: participant.participantToken,
        },
        (r) => {
          if (r.ok) accept(r);
        },
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const send = (action, payload = {}) => {
    if (!socket?.connected) {
      setError("You are offline. Reconnect to continue.");
      return;
    }
    setError("");
    socket.timeout(5000).emit("party:" + action, payload, (err, r) => {
      if (err || !r?.ok) {
        setError(r?.error || "No reply yet. Reconnect and try again.");
        return;
      }
      if (r.state) accept(r);
      if (r.local) setLocalId(r.productId);
    });
  };
  return {
    peers,followView,
    state,
    localId,
    setLocalId,
    image,
    setImage,
    error,
    setError,
    hostNote,
    setHostNote,
    bursts,
    setBursts,
    busy,
    start,
    send,
  };
}
