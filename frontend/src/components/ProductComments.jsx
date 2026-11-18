import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import './ProductComments.css';

const MAX_COMMENT_LENGTH = 500;

export default function ProductComments({
  productId,
  comments = [],
  onPostComment,
  isJoined,
  onPromptJoin,
  loading = false,
  defaultExpanded = false,
  compact = false,
}) {
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const thread = useRef(null);
  useEffect(() => {
    if (compact && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [compact, comments.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCommentError('');

    if (!isJoined) {
      if (onPromptJoin) onPromptJoin();
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setCommentError(`Comment exceeds ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    try {
      await onPostComment(productId, trimmed);
      setCommentText('');
    } catch (err) {
      setCommentError(err.message || 'Failed to post thought.');
    }
  };

  const formatCommentDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`product-discussion-container ${compact ? "product-discussion--compact" : ""}`}>
      <div className="discussion-header" hidden={compact}>
        <button className="discussion-title" type="button" aria-label={`Comments ${comments.length}`}
          aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          &#128172; Comments (<span>{comments.length}</span>)
        </button>
      </div>

      {expanded && <>
      <form className="discussion-form" onSubmit={handleSubmit}>
        <div className="discussion-input-wrapper">
          <textarea
            aria-label="Write a comment or question"
            className="discussion-input"
            rows={compact ? 1 : undefined}
            placeholder={compact ? "Write a comment for your friends" : "Write a comment or question"}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form.requestSubmit();}}}
            disabled={loading}
            maxLength={MAX_COMMENT_LENGTH}
          />
          <button
            type="submit"
            className="btn-send-thought"
            disabled={loading || !commentText.trim()}
          >
            {loading ? <LoadingSpinner size={12} /> : 'Post comment'}
          </button>
        </div>
        <span className="comment-counter">{commentText.length} / {MAX_COMMENT_LENGTH}</span>
        {commentError && <p role="alert" className="discussion-error">{commentError}</p>}
      </form>

      {comments.length > 0 && (
        <div className="discussion-comments-list" ref={thread} role={compact ? "log" : undefined} aria-label={compact ? "Product comment thread" : undefined}>
          {[...comments].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).map((comment) => (
            <div key={comment.id} className="discussion-comment-item">
              <div className="comment-user-row">
                <span className="comment-username">{comment.participantName}</span>
                <time className="comment-time" dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
              </div>
              <p className="comment-message">{comment.text}</p>
            </div>
          ))}
        </div>
      )}
      {comments.length === 0 && <p className="discussion-empty">No comments yet</p>}
      </>}
    </div>
  );
}
