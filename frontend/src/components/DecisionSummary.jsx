import { useState } from 'react';
import ProductImage from './ProductImage';
import LeaderboardCard from './LeaderboardCard';
import './DecisionSummary.css';

export default function DecisionSummary({
  summary,
  onScrollToProduct,
  isCreator = false,
  finalProductId = null,
  onSelectFinalChoice,
  settingFinalChoice = false,
}) {
  const [showFormula, setShowFormula] = useState(false);

  if (!summary) return null;

  const { status, winner, tiedWinners, rankings = [], finalChoice } = summary;

  if (status === 'no_products') {
    return (
      <section className="decision-section" aria-labelledby="decision-heading">
        <div className="section-header">
          <div>
            <h2 id="decision-heading" className="section-title">Final Decision Summary</h2>
            <p className="section-subtitle">Consensus rankings and participant feedback</p>
          </div>
        </div>
        <div className="decision-card decision-card--empty">
          <span className="decision-status-icon">⚖️</span>
          <h3>No products to evaluate</h3>
          <p>Add products to this room and cast votes to see group consensus and ranking.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="decision-section" aria-labelledby="decision-heading">
      <div className="section-header">
        <div>
          <div className="decision-title-row">
            <h2 id="decision-heading" className="section-title">Final Decision Summary</h2>
            <button
              type="button"
              className="btn-toggle-formula"
              onClick={() => setShowFormula(!showFormula)}
              aria-expanded={showFormula}
            >
              ℹ️ How ranking works {showFormula ? '▲' : '▼'}
            </button>
          </div>
          <p className="section-subtitle">
            Consensus score calculated deterministically from group votes and comments
          </p>
          {summary.aiSummary && (
            <div className="ai-summary-card">
              <strong>{summary.aiSummary.label}</strong>
              <p>{summary.aiSummary.paragraph}</p>
              {summary.aiSummary.topReasons?.length > 0 && (
                <ul>{summary.aiSummary.topReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              )}
            </div>
          )}
        </div>
      </div>

      {showFormula && (
        <div className="scoring-formula-card" role="region" aria-label="Ranking formula explanation">
          <h4>Formula & Scoring Rules</h4>
          <div className="formula-rules-grid">
            <div className="formula-rule-item"><span className="rule-vote">❤️ Love</span><span className="rule-points">+3 points</span></div>
            <div className="formula-rule-item"><span className="rule-vote">👍 Like</span><span className="rule-points">+2 points</span></div>
            <div className="formula-rule-item"><span className="rule-vote">🤔 Need info</span><span className="rule-points">+1 point</span></div>
            <div className="formula-rule-item"><span className="rule-vote">👎 No</span><span className="rule-points">0 points</span></div>
          </div>
          <div className="formula-tiebreakers">
            <strong>Tie-Breaking Criteria:</strong>
            <ol>
              <li>Highest total score</li>
              <li>Highest number of &quot;Love&quot; votes</li>
              <li>Highest total votes cast</li>
              <li>If all criteria are equal, reported as an authentic tie</li>
            </ol>
          </div>
        </div>
      )}

      {finalChoice?.product && (
        <div className="decision-card decision-card--final-choice" role="region" aria-label="Official Final Choice">
          <div className="final-choice-badge">🎯 Official Final Choice</div>
          <div className="winner-grid">
            <div className="winner-media">
              <ProductImage src={finalChoice.product.imageUrl} alt={finalChoice.product.name} category={finalChoice.product.category} />
            </div>
            <div className="winner-details">
              <span className="winner-category">{finalChoice.product.category}</span>
              <h3 className="winner-title">{finalChoice.product.name}</h3>
              {typeof finalChoice.product.price === 'number' && (
                <div className="winner-price">₹{finalChoice.product.price.toLocaleString('en-IN')}</div>
              )}
              {finalChoice.summarySentence && <p className="final-choice-sentence">&ldquo;{finalChoice.summarySentence}&rdquo;</p>}
              <div className="winner-score-pill">
                ⭐ Consensus Score: <strong>{finalChoice.score} pts</strong> ({finalChoice.voteCount} {finalChoice.voteCount === 1 ? 'vote' : 'votes'})
              </div>
              <div className="winner-vote-tags">
                <span className="vote-tag vote-tag--love">❤️ {finalChoice.breakdown.Love} Love</span>
                <span className="vote-tag vote-tag--like">👍 {finalChoice.breakdown.Like} Like</span>
                <span className="vote-tag vote-tag--info">🤔 {finalChoice.breakdown['Need more info']} Need info</span>
                <span className="vote-tag vote-tag--no">👎 {finalChoice.breakdown.No} No</span>
              </div>
            </div>
          </div>
          {finalChoice.feedbackSummary?.hasFeedback && (
            <div className="final-choice-feedback-themes">
              <h4 className="feedback-themes-title">Relevant Feedback Themes</h4>
              <div className="feedback-themes-grid">
                {finalChoice.feedbackSummary.advantages?.length > 0 && (
                  <div className="feedback-theme-column feedback-theme-column--pros">
                    <span className="feedback-theme-heading">👍 Highlights:</span>
                    <ul>{finalChoice.feedbackSummary.advantages.map((adv, idx) => <li key={idx}>&ldquo;{adv}&rdquo;</li>)}</ul>
                  </div>
                )}
                {finalChoice.feedbackSummary.concerns?.length > 0 && (
                  <div className="feedback-theme-column feedback-theme-column--concerns">
                    <span className="feedback-theme-heading">⚠️ Concerns:</span>
                    <ul>{finalChoice.feedbackSummary.concerns.map((con, idx) => <li key={idx}>&ldquo;{con}&rdquo;</li>)}</ul>
                  </div>
                )}
                {finalChoice.feedbackSummary.unresolvedQuestions?.length > 0 && (
                  <div className="feedback-theme-column feedback-theme-column--questions">
                    <span className="feedback-theme-heading">❓ Questions:</span>
                    <ul>{finalChoice.feedbackSummary.unresolvedQuestions.map((q, idx) => <li key={idx}>&ldquo;{q}&rdquo;</li>)}</ul>
                  </div>
                )}
                {finalChoice.feedbackSummary.otherFeedback?.length > 0 && (
                  <div className="feedback-theme-column feedback-theme-column--other">
                    <span className="feedback-theme-heading">💬 Notes:</span>
                    <ul>{finalChoice.feedbackSummary.otherFeedback.map((note, idx) => <li key={idx}>&ldquo;{note}&rdquo;</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(!finalChoice || !finalChoice.product) && (
        <div className="winner-banner-wrapper">
          {status === 'winner' && winner && (
            <div className="decision-card decision-card--winner" role="region" aria-label="Group Winner">
              <div className="winner-badge">🏆 Group Favorite</div>
              <div className="winner-grid">
                <div className="winner-media">
                  <ProductImage src={winner.product.imageUrl} alt={winner.product.name} category={winner.product.category} />
                </div>
                <div className="winner-details">
                  <span className="winner-category">{winner.product.category}</span>
                  <h3 className="winner-title">{winner.product.name}</h3>
                  {typeof winner.product.price === 'number' && (
                    <div className="winner-price">₹{winner.product.price.toLocaleString('en-IN')}</div>
                  )}
                  {winner.summarySentence && <p className="winner-sentence">&ldquo;{winner.summarySentence}&rdquo;</p>}
                  <div className="winner-score-pill">
                    ⭐ Consensus Score: <strong>{winner.score} pts</strong> ({winner.voteCount} {winner.voteCount === 1 ? 'vote' : 'votes'})
                  </div>
                  <div className="winner-vote-tags">
                    <span className="vote-tag vote-tag--love">❤️ {winner.breakdown.Love} Love</span>
                    <span className="vote-tag vote-tag--like">👍 {winner.breakdown.Like} Like</span>
                    <span className="vote-tag vote-tag--info">🤔 {winner.breakdown['Need more info']} Need info</span>
                    <span className="vote-tag vote-tag--no">👎 {winner.breakdown.No} No</span>
                  </div>
                </div>
              </div>
              {winner.tieBreakReason && (
                <div className="winner-tiebreak-note">
                  <span className="tiebreak-icon">⚖️</span>
                  <span><strong>Tie-Break Decision:</strong> {winner.tieBreakReason}</span>
                </div>
              )}
            </div>
          )}

          {status === 'tie' && tiedWinners?.length > 1 && (
            <div className="decision-card decision-card--tie" role="region" aria-label="Authentic Tie">
              <div className="tie-badge">🤝 Tie for #1 Choice</div>
              <p className="tie-description">
                The group is evenly split! Across {tiedWinners.length} products with an identical score of {tiedWinners[0].score} points:
              </p>
              <div className="tied-products-row">
                {tiedWinners.map((tw) => (
                  <div key={tw.product.id} className="tied-product-chip">
                    <div className="tied-chip-media">
                      <ProductImage src={tw.product.imageUrl} alt={tw.product.name} category={tw.product.category} />
                    </div>
                    <div className="tied-chip-info">
                      <span className="tied-chip-name">{tw.product.name}</span>
                      <span className="tied-chip-score">{tw.score} pts ({tw.voteCount} votes)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(status === 'no_votes' || status === 'insufficient_data') && (
            <div className="decision-card decision-card--no-votes">
              <span className="decision-status-icon">🗳️</span>
              <h3>Not enough voting data yet</h3>
              <p>Products are selected, but no participants have voted yet. Cast your vote to see consensus calculations.</p>
            </div>
          )}
        </div>
      )}

      <div className="decision-leaderboard-section">
        <h3 className="leaderboard-heading">Comprehensive Rankings & Participant Feedback</h3>
        <div className="leaderboard-cards-stack">
          {rankings.map((item) => {
            const isWinner = status === 'winner' && winner && item.product.id === winner.product.id;
            const isTied = status === 'tie' && tiedWinners?.some((tw) => tw.product.id === item.product.id);
            const effectiveFinalId = finalProductId || summary?.finalProductId || finalChoice?.product?.id;
            const isSelectedFinal = effectiveFinalId === item.product.id;
            const feedback = item.feedbackSummary || { hasFeedback: false };

            return (
              <LeaderboardCard
                key={item.product.id}
                item={item}
                feedback={feedback}
                isWinner={isWinner}
                isTied={isTied}
                isSelectedFinal={isSelectedFinal}
                isCreator={isCreator}
                settingFinalChoice={settingFinalChoice}
                onSelectFinalChoice={onSelectFinalChoice}
                onScrollToProduct={onScrollToProduct}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
