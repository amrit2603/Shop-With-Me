import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import './RoomChat.css';

export default function RoomChat({
  messages = [], currentParticipant = null, onSendMessage,
  onlineParticipants = [], typingUsers = [], onTyping,
  isConnected = true, products = [], isJoined = false, onPromptJoin,
}) {
  const [inputText, setInputText] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sendError, setSendError] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) setShowNewMessagesPill(false);
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
    setShowNewMessagesPill(false);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (isAtBottomRef.current) scrollToBottom(false);
      else if (messages.length > 0) setShowNewMessagesPill(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    if (onTyping && isJoined) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 1500);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!isJoined) { if (onPromptJoin) onPromptJoin(); return; }
    const trimmed = inputText.trim();
    if (!trimmed || sending || !isConnected) return;
    if (trimmed.length > 500) { setSendError('Message must be 500 characters or fewer.'); return; }

    setSending(true);
    setSendError(null);
    try {
      if (onTyping) onTyping(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      await onSendMessage(trimmed, selectedProductId || null);
      setInputText('');
      setSelectedProductId('');
      setLastFailedMessage(null);
      isAtBottomRef.current = true;
      scrollToBottom(true);
    } catch (err) {
      setSendError(err.message || 'Failed to send message. Please retry.');
      setLastFailedMessage({ text: trimmed, productId: selectedProductId });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      setInputText(lastFailedMessage.text);
      setSelectedProductId(lastFailedMessage.productId || '');
      setSendError(null);
    }
  };

  const getProductName = (prodId) => products.find((p) => p.id === prodId)?.name || null;
  const formatTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const activeTyping = typingUsers.filter((u) => !currentParticipant || u.participantId !== currentParticipant.id);

  return (
    <div className="room-chat-panel" role="region" aria-label="Live Room Chat">
      <div className="chat-header">
        <div className="chat-title-group"><span className="chat-icon">💬</span><h3 className="chat-title">Live Room Chat</h3></div>
        <div className="chat-presence-badge" title="Participants currently connected">
          <span className={`presence-dot ${isConnected ? 'presence-dot--online' : 'presence-dot--offline'}`}></span>
          <span className="presence-count">{onlineParticipants.length} online</span>
        </div>
      </div>

      {!isConnected && (
        <div className="chat-disconnected-banner" role="alert">
          <LoadingSpinner size={12} /><span>Reconnecting to live chat...</span>
        </div>
      )}

      <div className="chat-messages-container" ref={scrollContainerRef} onScroll={handleScroll} tabIndex={0} aria-label="Message history">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <span className="chat-empty-icon">👋</span>
            <p className="chat-empty-text">Say hi - your friends are deciding too</p>
            <span className="chat-empty-hint">Chat updates live in real-time for everyone in the room.</span>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((msg) => {
              const isOwn = currentParticipant && msg.participantId === currentParticipant.id;
              const productName = getProductName(msg.productId);
              return (
                <div key={msg.id} className={`chat-message-item ${isOwn ? 'chat-message--own' : 'chat-message--other'}`}>
                  {!isOwn && <span className="chat-message-sender">{msg.participantName || 'Guest'}</span>}
                  {productName && <span className="chat-product-tag" title={`Tagged: ${productName}`}>About: {productName}</span>}
                  <p className="chat-message-text">{msg.text}</p>
                  <span className="chat-message-time">{formatTime(msg.createdAt)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {showNewMessagesPill && (
        <button type="button" className="chat-new-messages-pill" onClick={() => scrollToBottom(true)} aria-label="Scroll to new messages">
          ↓ New messages
        </button>
      )}

      {activeTyping.length > 0 && (
        <div className="chat-typing-row" aria-live="polite">
          <span className="typing-dots"><span>•</span><span>•</span><span>•</span></span>
          <span className="typing-label">{activeTyping.map((u) => u.participantName).join(', ')} {activeTyping.length === 1 ? 'is' : 'are'} typing...</span>
        </div>
      )}

      {sendError && (
        <div className="chat-error-banner" role="alert">
          <span>{sendError}</span>
          {lastFailedMessage && <button type="button" className="btn-chat-retry" onClick={handleRetry}>Retry</button>}
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSend}>
        {products.length > 0 && (
          <div className="chat-product-selector">
            <select
              value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}
              aria-label="Attach to product (optional)" disabled={!isConnected || !isJoined || sending}
            >
              <option value="">Tag a product (optional)...</option>
              {products.map((p) => <option key={p.id} value={p.id}>About: {p.name}</option>)}
            </select>
          </div>
        )}
        <div className="chat-input-row">
          <input
            type="text" className="chat-input-field"
            placeholder={!isJoined ? 'Join this room to start chatting...' : isConnected ? 'Type a message (Press Enter to send)...' : 'Connecting to chat...'}
            value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown}
            disabled={!isConnected || !isJoined || sending} maxLength={500} aria-label="Chat message"
          />
          {!isJoined ? (
            <button type="button" className="btn-chat-join" onClick={onPromptJoin}>Join to Chat</button>
          ) : (
            <button type="submit" className="btn-chat-send" disabled={!isConnected || sending || !inputText.trim()} aria-label="Send message">
              {sending ? <LoadingSpinner size={12} /> : 'Send'}
            </button>
          )}
        </div>
        {inputText.length > 400 && <span className="chat-char-counter">{inputText.length} / 500</span>}
      </form>
    </div>
  );
}
