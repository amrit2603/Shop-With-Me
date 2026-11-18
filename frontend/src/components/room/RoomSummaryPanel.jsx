import { downloadDecisionCard } from '../../utils/decisionCard';
import { useState } from 'react';
import ProductImage from '../ProductImage';
import RoomProductCard from './RoomProductCard';
import './RoomSummaryPanel.css';

export default function RoomSummaryPanel({
  summary,
  isCreator = false,
  onSelectFinalChoice,
  settingFinalChoice = false,
  room,
  participant,
  onVote,
  onComment,
}) {
  const [exportError, setExportError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  if (!summary) return null;

  const { status, winner, rankings = [], finalChoice, aiSummary } = summary;

  // Format winner statement plainly per spec: "Product X is winning: 4 of 5 friends"
  let headline = 'Voting in progress';
  if (status === 'winner' && winner) {
    headline = `${winner.product.name} is winning: ${winner.score} pts`;
  } else if (status === 'tie') {
    headline = 'It is currently a tie';
  } else if (status === 'no_votes') {
    headline = 'No votes cast yet. Cast the first vote!';
  }

  return (
    <section className="room-summary-panel" aria-labelledby="summary-panel-heading">
      <div className="summary-header">
        <h2 id="summary-panel-heading" className="summary-title">Group Decision</h2>
      </div>

      {/* Official Final Choice Card if Selected */}
      {finalChoice?.product ? (
        <div className="decision-card decision-card--final-choice" role="region" aria-label="Official Final Choice">
          <div className="final-choice-badge">🎯 Official Final Choice</div>
          <div className="final-choice-body">
            <div className="final-choice-media">
              <ProductImage src={finalChoice.product.imageUrl} alt={finalChoice.product.name} category={finalChoice.product.category} />
            </div>
            <div className="final-choice-details">
              <h3 className="final-choice-name">{finalChoice.product.name}</h3>
              <p className="final-choice-price">{finalChoice.product.price == null ? 'Price unknown' : `₹${finalChoice.product.price}`}</p>
              {finalChoice.summarySentence && <p className="final-choice-sentence">&ldquo;{finalChoice.summarySentence}&rdquo;</p>}
              <div className="final-choice-counts">
                <span>❤️ {finalChoice.breakdown?.Love || 0} Love</span> &bull;
                <span>👍 {finalChoice.breakdown?.Like || 0} Like</span>
              </div>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={() => downloadDecisionCard(finalChoice).catch((err) => setExportError(err.message))}>Download decision card ↓</button>
          {exportError && <p role="alert">{exportError}</p>}
        </div>
      ) : (
        /* Winner Banner */
        <div className="winner-banner">
          <div className="winner-banner-text">
            <span className="winner-tag">CURRENT CONSENSUS</span>
            <p className="winner-statement">{headline}</p>
            {summary.summarySentence && <p className="winner-subsentence">&ldquo;{summary.summarySentence}&rdquo;</p>}
          </div>

          {/* Creator Final Choice Button */}
          {isCreator && winner && (
            <button
              type="button"
              className="btn-primary btn-final-choice"
              onClick={() => onSelectFinalChoice(winner.product.id)}
              disabled={settingFinalChoice}
            >
              {settingFinalChoice ? 'Confirming...' : '🎯 My Final Choice'}
            </button>
          )}
        </div>
      )}

      {/* Optional AI summary card if present */}
      {aiSummary?.paragraph && (
        <div className="ai-summary-card">
          <span className="ai-summary-badge">AI-generated summary</span>
          <p className="ai-summary-text">{aiSummary.paragraph}</p>
        </div>
      )}

      {room&&<div className="vote-product-cards" aria-label="Shortlist and votes">{room.products.map(product=><RoomProductCard compact idPrefix="vote-card" key={product.id} product={product} roomId={room.id} totals={room.voteTotals?.[product.id]||{}} votes={room.votes?.[product.id]||{}} userVote={room.votes?.[product.id]?.[participant?.id]} participants={room.participants} addedBy={room.creatorName||'Room creator'} comments={room.comments?.[product.id]||[]} onVote={onVote} onComment={onComment} isJoined={Boolean(participant)} winner={winner?.product?.id===product.id}/>)}</div>}
      {/* "See details" Expander */}
      <div className="details-expander-box">
        <button
          type="button"
          className="btn-toggle-details"
          onClick={() => setShowDetails(!showDetails)}
          aria-expanded={showDetails}
        >
          {showDetails ? '▲ Hide breakdown' : '▼ See details & ranking'}
        </button>

        {showDetails && (
          <div className="rankings-table-box">
            <ol className="rankings-list">
              {rankings.map((item, idx) => (
                <li key={item.product.id} className="ranking-item">
                  <span className="ranking-pos">#{idx + 1}</span>
                  <div className="ranking-info">
                    <span className="ranking-name">{item.product.name}</span>
                    <span className="ranking-score">{item.score} pts &bull; {item.voteCount} votes</span>
                  </div>
                  {isCreator && !finalChoice && (
                    <button
                      type="button"
                      className="btn-select-final-small"
                      onClick={() => onSelectFinalChoice(item.product.id)}
                      disabled={settingFinalChoice}
                    >
                      🎯 My Final Choice
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
