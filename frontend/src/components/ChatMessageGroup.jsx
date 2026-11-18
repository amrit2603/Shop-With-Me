import { getParticipantColor, getInitials } from '../utils/identity';

const API_BASE = import.meta.env.VITE_API_URL || '';

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatMessageGroup({ group, participant, products, onOpenImage, onReact }) {
  const isOwn = group.participantId === participant?.id;
  const avatarColor = getParticipantColor(group.participantId);
  const initials = getInitials(group.participantName);

  return (
    <div className={`chat-group ${isOwn ? 'chat-group--own' : 'chat-group--other'}`}>
      {!isOwn && (
        <div className="chat-group-avatar" style={{ backgroundColor: avatarColor }} title={group.participantName}>
          {initials}
        </div>
      )}
      <div className="chat-group-messages">
        {!isOwn && <span className="chat-group-author">{group.participantName}</span>}
        {group.messages.map((message) => {
          const authParams = participant?.participantToken
            ? `?participantId=${encodeURIComponent(participant.id)}&token=${encodeURIComponent(participant.participantToken)}`
            : '';
          const product = message.productId ? products.find((p) => p.id === message.productId) : null;

          return (
            <article
              key={message.id}
              className={`chat-bubble ${isOwn ? 'chat-bubble--own' : 'chat-bubble--other'}`}
            >
              {message.text && <p className="chat-bubble-text">{message.text}</p>}

              {message.attachments && message.attachments.length > 0 && (
                <div className="chat-attachments-grid">
                  {message.attachments.map((att) => {
                    const fullUrl = `${API_BASE}${att.url}${authParams}`;
                    const isPdf = att.mime === 'application/pdf';

                    if (isPdf) {
                      return (
                        <a
                          key={att.id}
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.originalName}
                          className="chat-attachment-card chat-attachment-card--pdf"
                          title={`Download ${att.originalName}`}
                        >
                          <div className="chat-pdf-icon" aria-hidden="true">PDF</div>
                          <div className="chat-pdf-info">
                            <span className="chat-pdf-name">{att.originalName}</span>
                            <span className="chat-pdf-size">{formatFileSize(att.size)}</span>
                          </div>
                          <span className="chat-pdf-download-btn" aria-hidden="true">↓</span>
                        </a>
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={att.id}
                        className="chat-attachment-thumb-btn"
                        onClick={() => onOpenImage({ url: fullUrl, originalName: att.originalName })}
                        aria-label={`View full image ${att.originalName}`}
                      >
                        <img src={fullUrl} alt={att.originalName} loading="lazy" />
                        <span className="chat-attachment-zoom" aria-hidden="true">🔍</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="chat-reactions" aria-label="Message reactions">
                {['❤️', '👍', '😂'].map((emoji) => {
                  const people = message.reactions?.[emoji] || [];
                  return <button key={emoji} type="button" aria-label={`React ${emoji}`} aria-pressed={people.includes(participant?.id)} disabled={!onReact} onClick={() => onReact(message.id, emoji)}>{emoji} {people.length || ''}</button>;
                })}
              </div>
              <footer className="chat-bubble-footer">
                {product && (
                  <span className="chat-product-badge">
                    🏷️ {product.name}
                  </span>
                )}
                <time className="chat-bubble-time">{formatTime(message.createdAt)}</time>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
