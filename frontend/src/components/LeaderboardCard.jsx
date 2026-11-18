import ProductImage from './ProductImage';

export default function LeaderboardCard({
  item,
  feedback,
  isWinner,
  isTied,
  isSelectedFinal,
  isCreator,
  settingFinalChoice,
  onSelectFinalChoice,
  onScrollToProduct,
}) {
  return (
    <article
      className={`leaderboard-card ${isWinner ? 'leaderboard-card--winner' : ''} ${isTied ? 'leaderboard-card--tied' : ''} ${isSelectedFinal ? 'leaderboard-card--final' : ''}`}
    >
      <div className="leaderboard-rank-badge">#{item.rank}</div>
      <div className="leaderboard-media">
        <ProductImage src={item.product.imageUrl} alt={item.product.name} category={item.product.category} />
      </div>
      <div className="leaderboard-info">
        <div className="leaderboard-title-row">
          <h4 className="leaderboard-product-name">{item.product.name}</h4>
          {typeof item.product.price === 'number' && (
            <span className="leaderboard-price">₹{item.product.price.toLocaleString('en-IN')}</span>
          )}
        </div>
        <div className="leaderboard-stats-row">
          <span className="leaderboard-score">⭐ <strong>{item.score}</strong> pts</span>
          <span className="leaderboard-votes-breakdown">
            ❤️ {item.breakdown.Love} &bull; 👍 {item.breakdown.Like} &bull; 🤔 {item.breakdown['Need more info']} &bull; 👎 {item.breakdown.No}
          </span>
        </div>
        {item.summarySentence && <p className="leaderboard-summary-sentence">{item.summarySentence}</p>}

        <div className="leaderboard-feedback">
          {feedback.hasFeedback &&
          (feedback.advantages?.length > 0 ||
            feedback.concerns?.length > 0 ||
            feedback.unresolvedQuestions?.length > 0 ||
            feedback.otherFeedback?.length > 0) ? (
            <div className="feedback-summary-content">
              {feedback.advantages?.length > 0 && (
                <div className="feedback-group feedback-group--advantages">
                  <span className="feedback-label">👍 Highlights:</span>
                  <ul>{feedback.advantages.slice(0, 2).map((adv, idx) => <li key={idx}>&quot;{adv}&quot;</li>)}</ul>
                </div>
              )}
              {feedback.concerns?.length > 0 && (
                <div className="feedback-group feedback-group--concerns">
                  <span className="feedback-label">⚠️ Concerns:</span>
                  <ul>{feedback.concerns.slice(0, 2).map((con, idx) => <li key={idx}>&quot;{con}&quot;</li>)}</ul>
                </div>
              )}
              {feedback.unresolvedQuestions?.length > 0 && (
                <div className="feedback-group feedback-group--questions">
                  <span className="feedback-label">❓ Questions:</span>
                  <ul>{feedback.unresolvedQuestions.slice(0, 2).map((q, idx) => <li key={idx}>&quot;{q}&quot;</li>)}</ul>
                </div>
              )}
              {feedback.otherFeedback?.length > 0 && (
                <div className="feedback-group feedback-group--other">
                  <span className="feedback-label">💬 Notes:</span>
                  <ul>{feedback.otherFeedback.slice(0, 2).map((note, idx) => <li key={idx}>&quot;{note}&quot;</li>)}</ul>
                </div>
              )}
            </div>
          ) : (
            <p className="no-feedback-notice">No written comments submitted yet for this product.</p>
          )}
        </div>
      </div>

      <div className="leaderboard-actions">
        {isCreator && onSelectFinalChoice && (
          <button
            type="button"
            className={`btn-final-choice ${isSelectedFinal ? 'btn-final-choice--selected' : ''}`}
            onClick={() => onSelectFinalChoice(item.product.id)}
            disabled={settingFinalChoice}
            title={isSelectedFinal ? 'Currently selected as final choice' : 'Select as official final choice'}
          >
            {isSelectedFinal ? '✓ Final Choice' : settingFinalChoice ? 'Saving...' : '🎯 My Final Choice'}
          </button>
        )}
        {onScrollToProduct && (
          <button
            type="button"
            className="btn-inspect-comments"
            onClick={() => onScrollToProduct(item.product.id)}
            title="Inspect original product votes and comments"
          >
            💬 View in Room ({item.commentCount})
          </button>
        )}
      </div>
    </article>
  );
}
