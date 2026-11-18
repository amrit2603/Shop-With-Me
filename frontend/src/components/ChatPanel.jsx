import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRoomMessages, uploadRoomAttachments } from '../services/api';
import ChatMessageGroup from './ChatMessageGroup';
import ChatLightbox from './ChatLightbox';
import './ChatPanel.css';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_FILES = 3;

function groupMessages(messages) {
  const groups = [];
  let currentGroup = null;

  for (const msg of messages) {
    const msgTime = new Date(msg.createdAt).getTime();
    if (
      currentGroup &&
      currentGroup.participantId === msg.participantId &&
      msgTime - currentGroup.lastTime < 5 * 60 * 1000
    ) {
      currentGroup.messages.push(msg);
      currentGroup.lastTime = msgTime;
    } else {
      currentGroup = {
        id: msg.id,
        participantId: msg.participantId,
        participantName: msg.participantName,
        messages: [msg],
        lastTime: msgTime,
      };
      groups.push(currentGroup);
    }
  }
  return groups;
}

export default function ChatPanel({ roomId, participant, participants = [], products = [], socket, connected, isActive = true, compact=false, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [typingName, setTypingName] = useState('');
  const [online, setOnline] = useState([]);
  const [unread, setUnread] = useState(0);
  const [newMessages, setNewMessages] = useState(false);
  const [minimized, setCollapsed] = useState(false);
  const collapsed = !compact && minimized;
  const [hasEarlier, setHasEarlier] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const atBottom = useRef(true);
  const typingTimer = useRef(null);
  const dragCounter = useRef(0);
  const visible = isActive && !collapsed;

  const loadHistory = useCallback(async (before, prepend = false) => {
    await Promise.resolve();
    if (!participant?.id) { setLoading(false); return; }
    setLoadError('');
    try {
      const page = await getRoomMessages(roomId, { participantId: participant.id, participantToken: participant.participantToken, before, limit: 50 });
      setMessages((current) => {
        const combined = prepend ? [...page.messages, ...current] : [...current, ...page.messages];
        return Array.from(new Map(combined.map((m) => [m.id, m])).values())
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      });
      setHasEarlier(Boolean(page.nextBefore));
    } catch (error) {
      setLoadError(error.message || 'Could not load chat. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [roomId, participant]);

  // Synchronize persisted server state after the room or guest identity changes.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = ({ message }) => {
      if (!message?.id) return;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      });
      if (!visible) setUnread((c) => c + 1);
      else if (!atBottom.current) setNewMessages(true);
    };
    const handlePresence = ({ online: onlineIds = [] }) => setOnline(onlineIds);
    const handleTyping = ({ participantId, participantName, typing }) => {
      if (participantId === participant?.id) return;
      setTypingName(typing ? participantName : '');
      clearTimeout(typingTimer.current);
      if (typing) typingTimer.current = setTimeout(() => setTypingName(''), 1800);
    };
    const handleReaction = ({ messageId, reactions }) => setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message));
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:message', handleMessage);
    socket.on('presence:update', handlePresence);
    socket.on('chat:typing', handleTyping);
    const handleConnect = () => loadHistory();
    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:message', handleMessage);
      socket.off('presence:update', handlePresence);
      socket.off('chat:typing', handleTyping);
      clearTimeout(typingTimer.current);
    };
  }, [socket, participant?.id, visible, loadHistory]);

  useEffect(() => { onUnreadChange?.(visible ? 0 : unread); }, [unread, visible, onUnreadChange]);

  useEffect(() => {
    if (visible && atBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewMessages(false);
    }
  }, [messages.length, visible]);

  const validateAndStageFiles = (incomingFiles) => {
    const errors = [];
    const valid = [];
    const totalCount = stagedFiles.length + incomingFiles.length;

    if (totalCount > MAX_FILES) {
      errors.push(`You can attach at most ${MAX_FILES} files per message.`);
    }

    const availableSlots = Math.max(0, MAX_FILES - stagedFiles.length);
    const candidateFiles = incomingFiles.slice(0, availableSlots);

    for (const file of candidateFiles) {
      if (!ALLOWED_TYPES.has(file.type)) {
        errors.push(`"${file.name}": Only JPEG, PNG, WebP, and PDF files are allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds the 3 MB size limit.`);
        continue;
      }
      valid.push(file);
    }

    setFileErrors(errors);
    if (valid.length > 0) {
      setStagedFiles((prev) => [...prev, ...valid]);
    }
  };

  const removeStagedFile = (index) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileErrors([]);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      validateAndStageFiles(pastedFiles);
    }
  };

  const sendMessage = async () => {
    const cleanText = draft.trim();
    if ((!cleanText && stagedFiles.length === 0) || !socket || !connected || !participant) return;
    setSendError('');
    setIsUploading(true);

    try {
      let attachmentIds = [];
      if (stagedFiles.length > 0) {
        const uploadResult = await uploadRoomAttachments(roomId, {
          participantId: participant.id,
          participantToken: participant.participantToken,
          files: stagedFiles,
        });
        attachmentIds = (uploadResult.attachments || []).map((a) => a.id);
      }

      const payload = {
        text: cleanText,
        productId: selectedProductId || null,
      };
      if (attachmentIds.length > 0) {
        payload.attachmentIds = attachmentIds;
      }

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Send timed out. Please retry.')), 5000);
        socket.emit('chat:send', payload, (res) => {
          clearTimeout(timer);
          if (!res?.ok) reject(new Error(res?.error || 'Message failed to send.'));
          else resolve(res);
        });
      });

      setDraft('');
      setStagedFiles([]);
      setFileErrors([]);
      setSelectedProductId('');
    } catch (err) {
      setSendError(err.message || 'Could not send message. Please retry.');
    } finally {
      setIsUploading(false);
    }
  };

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  return (
    <section
      className={`${compact?"chat-panel--compact ":""}chat-panel ${collapsed ? 'chat-panel--collapsed' : ''}`}
      aria-label="Room chat"
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current += 1; setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); dragCounter.current -= 1; if (dragCounter.current <= 0) setIsDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        if (e.dataTransfer.files?.length) validateAndStageFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {isDragging && <div className="chat-dropzone-overlay"><p>📎 Drop files to attach (JPEG, PNG, WebP, PDF)</p></div>}
      {compact?<h2 className="sr-only">Room chat</h2>:<header className="chat-panel-header">
        <div>
          <h2 className={compact?'sr-only':undefined}>Room chat {unread > 0 && <span className="chat-unread-badge" aria-label={`${unread} unread messages`}>{unread}</span>}</h2>
          <p>{online.length} friend{online.length === 1 ? '' : 's'} online</p>
        </div>
        {!compact&&<button type="button" className="chat-collapse-button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          {collapsed ? 'Open chat' : 'Minimize'}
        </button>}
      </header>}

      {!collapsed && (
        <>
          {!connected && <div className="chat-reconnecting" role="status">Reconnecting… Chat is paused.</div>}
          <div className="chat-online-list" aria-label="Online participants">
            {participants.map((person) => (
              <span key={person.id} className={`chat-online-person ${online.includes(person.id) ? 'is-online' : ''}`}>
                <i aria-hidden="true" />{person.name}{person.id === participant?.id ? ' (You)' : ''}
              </span>
            ))}
          </div>

          {hasEarlier && <button type="button" className="chat-load-earlier" onClick={() => loadHistory(messages[0]?.id, true)}>Load earlier</button>}

          <div
            className="chat-message-list"
            role="log"
            aria-live="polite"
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              if (atBottom.current) setNewMessages(false);
            }}
          >
            {loading ? <div className="chat-loading-skeleton" aria-label="Loading chat history" />
              : loadError ? <div className="chat-empty-state" role="alert"><p>{loadError}</p><button type="button" onClick={() => loadHistory()}>Retry</button></div>
              : messages.length === 0 ? <p className="chat-empty-state">Say hi — your friends are deciding too.</p>
              : messageGroups.map((group) => (
                <ChatMessageGroup
                  key={group.id}
                  group={group}
                  participant={participant}
                  products={products}
                  onReact={connected && participant ? (messageId, emoji) => {
                    socket.timeout(5000).emit('chat:react', { messageId, emoji }, (err, result) => {
                      if (err || !result?.ok) setSendError(result?.error || 'Could not save reaction. Please retry.');
                    });
                  } : null}
                  onOpenImage={setLightboxImage}
                />
              ))}
          </div>

          {newMessages && (
            <button type="button" className="chat-new-messages" onClick={() => {
              atBottom.current = true;
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              setNewMessages(false);
            }}>
              New messages ↓
            </button>
          )}

          <div className="chat-presence-line" aria-live="polite">
            {typingName ? `${typingName} is typing…` : '\u00a0'}
          </div>

          {stagedFiles.length > 0 && (
            <div className="chat-staged-previews">
              {stagedFiles.map((file, idx) => (
                <div key={file.name + idx} className="chat-staged-chip">
                  <span className="chat-staged-icon">{file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                  <span className="chat-staged-name" title={file.name}>{file.name}</span>
                  <button type="button" onClick={() => removeStagedFile(idx)} aria-label={`Remove ${file.name}`}>✕</button>
                </div>
              ))}
            </div>
          )}

          {fileErrors.length > 0 && (
            <div className="chat-file-errors" role="alert">
              {fileErrors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}

          <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
            <label className="sr-only" htmlFor="room-chat-message">Message friends</label>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) validateAndStageFiles(Array.from(e.target.files));
                e.target.value = '';
              }}
            />

            {products.length > 0 && (
              <details className="chat-tag-details" open={!compact}><summary hidden={!compact}>Tag a product</summary><label className="chat-product-select-label">
                <span className="sr-only">Tag a product (optional)</span>
                <select
                  aria-label="Tag a product (optional)"
                  className="chat-product-picker"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={!connected}
                >
                  <option value="">No product tag</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label></details>
            )}

            <div className="chat-input-row">
              <button
                type="button"
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected || isUploading || stagedFiles.length >= MAX_FILES}
                title="Attach images or PDF (max 3 files, 3 MB each)"
                aria-label="Attach file"
              >
                📎
              </button>

              <textarea
                id="room-chat-message"
                value={draft}
                maxLength={500}
                placeholder="Message your friends…"
                onPaste={handlePaste}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (socket?.connected) {
                    socket.emit('chat:typing', { typing: true });
                    clearTimeout(typingTimer.current);
                    typingTimer.current = setTimeout(() => socket.emit('chat:typing', { typing: false }), 800);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form.requestSubmit();
                  }
                }}
                disabled={!connected || !participant || isUploading}
              />

              <button
                type="submit"
                className="chat-send-btn"
                disabled={!connected || !participant || isUploading || (!draft.trim() && stagedFiles.length === 0)}
              >
                {isUploading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>

          {sendError && (
            <div className="chat-send-error" role="alert">
              <span>{sendError}</span>
              <button type="button" onClick={sendMessage}>Retry</button>
            </div>
          )}
        </>
      )}

      {lightboxImage && (
        <ChatLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </section>
  );
}
