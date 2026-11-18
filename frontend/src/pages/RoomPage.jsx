import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ParticipantBar from '../components/ParticipantBar';
import RoomHeader from '../components/room/RoomHeader';
import RoomProductCard, {ProductDetails} from '../components/room/RoomProductCard';
import RoomSummaryPanel from '../components/room/RoomSummaryPanel';
import RoomMobileTabs from '../components/room/RoomMobileTabs';
import ChatPanel from '../components/ChatPanel';
import { getRoom, joinRoom, voteProduct, setFinalChoice, updateParticipantName } from '../services/api';
import { initRoomSocket } from '../services/socket';
import './RoomPage.css';
import {useAuth} from '../services/auth';

export default function RoomPage() {
  const { roomId, productId: deepProductId } = useParams();
  const navigate = useNavigate();
  const {user,signOut}=useAuth();

  const [selectedId,setSelectedId]=useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [room, setRoom] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [mobileTab, setMobileTab] = useState('products');
  const [desktopSideTab, setDesktopSideTab] = useState('chat');
  const [chatUnread, setChatUnread] = useState(0);

  const [participant, setParticipant] = useState(null);
  const [onlineParticipants, setOnlineParticipants] = useState([]);
  const sessionKey = `active_participant_${roomId}`;
  const localKey = `last_participant_${roomId}`;

  const [rememberedParticipant] = useState(() => {
    try {
      const saved = sessionStorage.getItem(localKey) || sessionStorage.getItem(`shop_with_me_participant_${roomId}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [creatorToken] = useState(() => {
    try { return sessionStorage.getItem(`creator_token_${roomId}`) || null; } catch { return null; }
  });
  const isCreator = room?.creatorUserId ? user?.id === room.creatorUserId : Boolean(creatorToken);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const persistIdentity = useCallback((p) => {
    setParticipant(p);
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(p));
      sessionStorage.setItem(localKey, JSON.stringify({name:p.name}));

    } catch {}
  }, [sessionKey, localKey]);

  useEffect(() => {
    if(user){joinRoom(roomId,{name:user.displayName}).then(res=>persistIdentity({...res.participant,participantToken:res.participantToken,accountUserId:user.id})).catch(()=>setParticipant(null));return;}
    try {
      const activeSaved = sessionStorage.getItem(sessionKey);
      if (activeSaved) {
        const parsed = JSON.parse(activeSaved);
        if(parsed?.accountUserId){sessionStorage.removeItem(sessionKey);
          // Session revocation is an external identity change.
          // oxlint-disable-next-line react/set-state-in-effect
          setParticipant(null);return;}
        if (parsed?.id && parsed?.name) {
          joinRoom(roomId, { participantId: parsed.id, participantToken: parsed.participantToken, name: parsed.name })
            .then((res) => {
              const restored = { ...res.participant, participantToken: res.participantToken || parsed.participantToken };
              persistIdentity(restored);
            })
            .catch(() => { sessionStorage.removeItem(sessionKey); setParticipant(null); });
        }
      }
    } catch {}
  }, [roomId, sessionKey, persistIdentity, user]);

  useEffect(()=>{sessionStorage.setItem("vyumi_current_room",roomId);if(deepProductId&&room?.id)document.getElementById(`product-card-${deepProductId}`)?.scrollIntoView({block:"start"});},[roomId,deepProductId,room]);

  const loadRoomData = useCallback(async () => {
    try {
      const data = await getRoom(roomId);
      setError(null);
      setRoom(data.room);
      if (data.summary) setSummary(data.summary);
      if (data.room?.id && data.room.id !== roomId) navigate(`/room/${data.room.id}`, { replace: true });
    } catch (err) {
      const msg = err.message || '';
      const type = /expired/i.test(msg) ? 'expired' : /not found/i.test(msg) ? 'not_found' : 'network';
      setError({ message: msg || 'Could not load room. Please check your connection and retry.', type });
    } finally {
      setLoading(false);
    }
  }, [roomId, navigate]);

  // Synchronize persisted server state after the room or guest identity changes.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadRoomData(); }, [loadRoomData]);

  useEffect(() => {
    const s = initRoomSocket({ auth: { roomId, participantId: participant?.id, token: participant?.participantToken } });
    socketRef.current = s;
    // The socket is an external connection shared with chat.
    // oxlint-disable-next-line react/set-state-in-effect
    setSocket(s);

    s.on('connect', () => {
      setConnectionStatus('connected');
      s.emit('room:join', { roomId, participantId: participant?.id, participantToken: participant?.participantToken });
      getRoom(roomId).then((data) => { setRoom(data.room); if (data.summary) setSummary(data.summary); }).catch(() => {});
    });
    s.on('connect_error', () => setConnectionStatus('reconnecting'));
    s.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    s.on('disconnect', () => setConnectionStatus('disconnected'));
    s.on('presence:update', (payload) => setOnlineParticipants(payload?.online || []));

    const syncRoom = (payload) => { if (payload?.room) setRoom(payload.room); };
    s.on('room:updated', syncRoom); s.on('product:added', syncRoom); s.on('product:removed', syncRoom);
    s.on('vote:updated', (payload) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const votes = { ...(prev.votes || {}) };
        if (!votes[payload.productId]) votes[payload.productId] = {};
        votes[payload.productId][payload.participantId] = payload.vote;
        const voteTotals = { ...(prev.voteTotals || {}) };
        voteTotals[payload.productId] = payload.totals;
        return { ...prev, votes, voteTotals };
      });
    });

    s.on('comment:added', (payload) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const comments = { ...(prev.comments || {}) };
        const prodComments = [...(comments[payload.productId] || []), payload.comment];
        return { ...prev, comments: { ...comments, [payload.productId]: prodComments } };
      });
    });

    s.on('summary:updated', (payload) => { if (payload?.summary) setSummary(payload.summary); });
    s.on('decision:made', (payload) => {
      setRoom((prev) => prev ? { ...prev, finalProductId: payload.finalProduct?.id } : prev);
      if (payload?.summary) setSummary(payload.summary);
    });

    s.on('participant:joined', (payload) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const existing = prev.participants || [];
        if (existing.some((p) => p.id === payload.participant?.id)) return prev;
        return { ...prev, participants: [...existing, payload.participant] };
      });
    });

    s.on('participant:updated', (payload) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const participants = (prev.participants || []).map((p) =>
          p.id === payload.participant?.id ? { ...p, ...payload.participant } : p
        );
        return { ...prev, participants };
      });
      setParticipant((prev) => (prev?.id === payload.participant?.id ? { ...prev, ...payload.participant } : prev));
    });

    return () => { s.disconnect(); };
  }, [roomId, participant?.id, participant?.participantToken]);

  const handleJoin = async (displayName) => {
    try {
      const res = await joinRoom(roomId, { name: displayName });
      const p = { ...res.participant, participantToken: res.participantToken };
      persistIdentity(p);
      if (socketRef.current?.connected) {
        socketRef.current.emit('room:join', { roomId, participantId: p.id, participantToken: p.participantToken });
      }
    } catch (err) { alert(err.message || 'Could not join room.'); }
  };

  const handleContinue = async (saved) => {
    try {
      const res = await joinRoom(roomId, { participantId: saved.id, participantToken: saved.participantToken, name: saved.name });
      const p = { ...res.participant, participantToken: res.participantToken || saved.participantToken };
      persistIdentity(p);
      if (socketRef.current?.connected) {
        socketRef.current.emit('room:join', { roomId, participantId: p.id, participantToken: p.participantToken });
      }
    } catch (err) {
      setActionMessage(err.message || 'Your guest session expired. Join with your name again.');
    }
  };

  const handleRename = async (newName) => {
    if (!participant) return;
    const res = await updateParticipantName(roomId, participant.id, newName, participant.participantToken);
    const updated = { ...participant, name: res.participant.name };
    persistIdentity(updated);
    setRoom((prev) => {
      if (!prev) return prev;
      const participants = (prev.participants || []).map((p) =>
        p.id === updated.id ? { ...p, name: updated.name } : p
      );
      return { ...prev, participants };
    });
  };

  const handleVote = async (productId, voteKey) => {
    if (!participant) return;
    try {
      const previous = room?.votes?.[productId]?.[participant.id];
      const result = await voteProduct(roomId, productId, { participantId: participant.id, participantToken: participant.participantToken, vote: voteKey });
      setRoom((prev) => ({ ...prev, votes: { ...prev.votes, [productId]: { ...prev.votes?.[productId], [participant.id]: result.vote } }, voteTotals: { ...prev.voteTotals, [productId]: result.totals } }));
      setActionMessage(previous && previous !== result.vote ? `You changed ${previous} to ${result.vote}.` : `Your ${result.vote} vote is saved.`);
    } catch (err) { setActionMessage(err.message || 'Failed to record vote. Please retry.'); }
  };

  const handleFinalChoice = async (productId) => {
    if (!creatorToken) return;
    try { await setFinalChoice(roomId, productId, creatorToken); }
    catch (err) { alert(err.message || 'Failed to set final choice.'); }
  };

  const navProps = {
    compact: true,
    leaderLabel: 'Host',
    currentParticipant: participant,
    isCreator,
    participants: room?.participants || [],
    onlineParticipantIds: onlineParticipants,
    onRename: handleRename,
  };

  if (loading) {
    return (
      <div className="room-page">
        <Navbar {...navProps} />
        <main className="room-state-container" role="status" aria-label="Loading shopping room">
          <LoadingSpinner size={32} /><p className="state-msg">Loading shopping room&hellip;</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-page">
        <Navbar {...navProps} />
        <main className="room-state-container room-state--error" role="alert">
          <span className="state-icon">⚠️</span>
          <h2 className="state-title">{error.type === 'expired' ? 'Room Expired' : 'Could Not Load Room'}</h2>
          <p className="state-msg">{error.message}</p>
          <button type="button" className="btn-primary" onClick={() => { setLoading(true); setError(null); loadRoomData(); }}>Try again</button>
        </main>
      </div>
    );
  }

  const products = room?.products || [];
  const selectedProduct=products.find(p=>p.id===(selectedId??deepProductId));

  return (
    <div className="room-page">
      <Navbar {...navProps} />
      <main className="room-layout-container">
        <button className="room-leave" onClick={()=>{socket?.disconnect();signOut();}}>Leave room / Log out</button>
        <RoomHeader
          compact
          title={room?.title}
          roomCode={room?.code || (room?.id ? room.id.slice(0, 6).toUpperCase() : '')}
          expiresAt={room?.expiresAt}
          participantsCount={(room?.participants || []).length}
          connectionStatus={connectionStatus}
          shareUrl={window.location.href}
        />

        {!participant && (
          <div className="room-join-banner">
            <ParticipantBar
              participant={participant}
              rememberedParticipant={rememberedParticipant}
              onJoin={handleJoin}
              onContinue={handleContinue}
              onUpdateName={handleRename}
            />
          </div>
        )}

        <p className="room-action-message" role="status">{actionMessage}</p>
        <div className="room-columns">
          <section className={`room-products-column ${mobileTab !== 'products' ? 'mobile-hidden' : ''}`}>

            {products.length === 0 ? (
              <div className="room-empty-products" role="region" aria-label="No products"><p>No products in this room yet.</p></div>
            ) : (
              <div className="room-products-grid" aria-label="Room products">
                {products.map((prod) => (
                  <RoomProductCard
                    onSelect={setSelectedId} selected={selectedProduct?.id===prod.id} key={prod.id} product={prod} roomId={room.id} participants={room.participants} votes={room.votes?.[prod.id]||{}} addedBy={room.creatorName||"Room creator"} winner={summary?.winner?.product?.id===prod.id}
                    totals={room?.voteTotals?.[prod.id] || {}}
                    userVote={participant ? room?.votes?.[prod.id]?.[participant.id] : null}
                    comments={room?.comments?.[prod.id] || []}
                    onVote={handleVote} participant={participant} isJoined={Boolean(participant)}
                    onPromptJoin={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  />
                ))}
              </div>
            )}
            {selectedProduct && <section id="selected-product-options" className="selected-product-options" key={selectedProduct.id} aria-label={`Options for ${selectedProduct.name}`}><header><div><p>Selected product</p><h2>{selectedProduct.name}</h2></div><button onClick={()=>setSelectedId("")} aria-label="Close product options">×</button></header><ProductDetails product={selectedProduct} roomId={room.id} participants={room.participants} votes={room.votes?.[selectedProduct.id]||{}} addedBy={room.creatorName||'Room creator'} participant={participant}/></section>}
          </section>

          <aside className={`room-sidebar-column ${mobileTab === 'products' ? 'mobile-sidebar-hidden' : ''}`}>
            <div className="sidebar-tab-switcher">
              <button type="button" className={`sidebar-tab-btn ${desktopSideTab === 'chat' ? 'sidebar-tab-btn--active' : ''}`} onClick={() => setDesktopSideTab('chat')}>Chat</button>
              <button type="button" className={`sidebar-tab-btn ${desktopSideTab === 'summary' ? 'sidebar-tab-btn--active' : ''}`} onClick={() => setDesktopSideTab('summary')}>Votes</button>
            </div>
            <div className={`sidebar-pane ${mobileTab === 'chat' || (mobileTab === 'products' && desktopSideTab === 'chat') ? '' : 'pane-hidden'}`}>
              <ChatPanel roomId={room?.id} participant={participant} participants={room?.participants || []} products={products} socket={socket} connected={connectionStatus === 'connected'} compact onUnreadChange={setChatUnread} />
            </div>
            <div className={`sidebar-pane ${mobileTab === 'summary' || (mobileTab === 'products' && desktopSideTab === 'summary') ? '' : 'pane-hidden'}`}>
              <RoomSummaryPanel room={room} participant={participant} onVote={handleVote} summary={summary} isCreator={isCreator} onSelectFinalChoice={handleFinalChoice} />
            </div>
          </aside>
        </div>

        <RoomMobileTabs activeTab={mobileTab} onChangeTab={setMobileTab} unreadChatCount={chatUnread} />
      </main>
    </div>
  );
}
