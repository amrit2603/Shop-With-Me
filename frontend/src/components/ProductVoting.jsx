import LoadingSpinner from './LoadingSpinner';
import './ProductVoting.css';

const VOTE_OPTIONS = [
  { key: 'Love', label: 'Love', icon: '♡', activeClass: 'vote-btn--love' },
  { key: 'Like', label: 'Like', icon: '☺', activeClass: 'vote-btn--like' },
  { key: 'No', label: 'No', icon: 'ⓘ', activeClass: 'vote-btn--no' },
  { key: 'Need more info', label: 'Need info', icon: '?', activeClass: 'vote-btn--info' },
];

export default function ProductVoting({
  productId,
  totals = { Love: 0, Like: 0, No: 0, 'Need more info': 0 },
  userVote = null,
  onVote,
  isJoined,
  onPromptJoin,
  loading = false,
}) {
  const handleVoteClick = (voteKey) => {
    if (!isJoined) {
      if (onPromptJoin) onPromptJoin();
      return;
    }
    onVote(productId, voteKey);
  };

  const loveCount = totals.Love || 0;
  const likeCount = totals.Like || 0;
  const noCount = totals.No || 0;
  const infoCount = totals['Need more info'] || 0;
  const totalVotesCast = loveCount + likeCount + noCount + infoCount;

  const lovePct = totalVotesCast > 0 ? (loveCount / totalVotesCast) * 100 : 0;
  const likePct = totalVotesCast > 0 ? (likeCount / totalVotesCast) * 100 : 0;
  const infoPct = totalVotesCast > 0 ? (infoCount / totalVotesCast) * 100 : 0;
  const noPct = totalVotesCast > 0 ? (noCount / totalVotesCast) * 100 : 0;

  return (
    <div className="product-voting-container">
      {/* 2x2 Voting Buttons Grid */}
      <div className="voting-buttons-grid">
        {VOTE_OPTIONS.map(({ key, label, icon, activeClass }) => {
          const isSelected = userVote === key;

          return (
            <button
              key={key}
              type="button"
              className={`vote-btn ${isSelected ? `vote-btn--selected ${activeClass}` : ''}`}
              onClick={() => handleVoteClick(key)}
              disabled={loading}
              title={!isJoined ? 'Join room to vote' : `Vote ${key}`}
              aria-label={`Vote ${key}`}
              aria-pressed={isSelected}
            >
              <span className="vote-icon">{icon}</span>
              <span className="vote-btn-label">{label}</span>
              <span className="vote-count">{totals[key] || 0}</span>
              {loading && isSelected && <LoadingSpinner size={10} />}
            </button>
          );
        })}
      </div>

      {/* Segmented Progress Bar */}
      <div className="voting-progress-bar">
        {totalVotesCast === 0 ? (
          <div className="bar-segment bar-segment--empty" style={{ width: '100%' }}></div>
        ) : (
          <>
            {lovePct > 0 && <div className="bar-segment bar-segment--love" style={{ width: `${lovePct}%` }}></div>}
            {likePct > 0 && <div className="bar-segment bar-segment--like" style={{ width: `${likePct}%` }}></div>}
            {infoPct > 0 && <div className="bar-segment bar-segment--info" style={{ width: `${infoPct}%` }}></div>}
            {noPct > 0 && <div className="bar-segment bar-segment--no" style={{ width: `${noPct}%` }}></div>}
          </>
        )}
      </div>

      <p className="voting-tally-line">{totalVotesCast} {totalVotesCast === 1 ? 'vote' : 'votes'}</p>
    </div>
  );
}
