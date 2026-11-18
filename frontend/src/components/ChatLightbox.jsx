import { useEffect } from 'react';

export default function ChatLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div className="chat-lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Image preview" onClick={onClose}>
      <div className="chat-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="chat-lightbox-header">
          <span className="chat-lightbox-title">{image.originalName || 'Attachment image'}</span>
          <div className="chat-lightbox-actions">
            <a
              href={image.url}
              download={image.originalName || 'attachment'}
              target="_blank"
              rel="noopener noreferrer"
              className="chat-lightbox-download"
              aria-label="Download image"
            >
              Download
            </a>
            <button
              type="button"
              className="chat-lightbox-close"
              onClick={onClose}
              aria-label="Close image preview"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="chat-lightbox-body">
          <img src={image.url} alt={image.originalName || 'Chat attachment'} />
        </div>
      </div>
    </div>
  );
}
