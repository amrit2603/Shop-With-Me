/**
 * Decision Summary Service for Shop With Me (Phase 6).
 * Computes deterministic product rankings, tie detection, and evidence-based comment summaries
 * based on persisted SQLite data.
 */

const SCORING_RULES = {
  Love: 3,
  Like: 2,
  'Need more info': 1,
  No: 0,
};

const TIE_BREAKER_CRITERIA = [
  'Highest total score',
  'Highest number of Love votes',
  'Highest total votes cast',
];

// Positive sentiment keywords for deterministic feedback categorization
const POSITIVE_KEYWORDS = [
  'great',
  'good',
  'love',
  'loved',
  'loves',
  'comfortable',
  'comfort',
  'high quality',
  'good quality',
  'great quality',
  'top quality',
  'quality build',
  'quality material',
  'quality product',
  'perfect',
  'stylish',
  'nice',
  'excellent',
  'solid',
  'sleek',
  'best',
  'durable',
  'durability',
  'lightweight',
  'clean',
  'recommend',
  'recommended',
  'worth',
  'premium',
  'spacious',
  'beautiful',
  'smooth',
  'fast',
  'impressive',
  'awesome',
  'fantastic',
  'super',
  'sturdy',
  'practical',
  'favorite',
  'favourite',
  'value',
  'reliable',
  'easy',
  'amazing',
  'wonderful',
  'brilliant',
];

// Negative sentiment keywords for concern categorization
const CONCERN_KEYWORDS = [
  'expensive',
  'pricey',
  'costly',
  'small',
  'heavy',
  'flimsy',
  'concern',
  'concerns',
  'doubt',
  'doubts',
  'issue',
  'issues',
  'hard',
  'rough',
  'bad',
  'slow',
  'break',
  'breaks',
  'broken',
  'poor',
  'defect',
  'defects',
  'defective',
  'fragile',
  'bulky',
  'scratch',
  'scratches',
  'stiff',
  'tight',
  'noisy',
  'cheap',
  'disappointed',
  'disappointing',
  'overpriced',
  'weak',
  'uncomfortable',
  'lacks',
  'lacking',
  'wobbly',
  'difficult',
  'problem',
  'problems',
  'lag',
  'flaw',
  'flaws',
  // Phase A additions — previously missing
  'too bright',
  'too dim',
  'too dark',
  'too loud',
  'too slow',
  'too big',
  'too small',
  'too large',
  'too heavy',
  'too light',
  'too tight',
  'too loose',
  'too long',
  'too short',
  'too wide',
  'too narrow',
  'too hot',
  'too cold',
  'too sharp',
  'too blunt',
  'less versatile',
  'not versatile',
  'seems loose',
  'feel loose',
  'feels loose',
  'fit seems loose',
  'fit is loose',
  'looks loose',
  'loose fit',
  'loose',
];

// Negation prefix and scoping pattern for deterministic feedback analysis
const NEGATION_PREFIX =
  '(?:not|never|hardly|barely|no|isn\'t|isnt|aren\'t|arent|wasn\'t|wasnt|weren\'t|werent|won\'t|wont|doesn\'t|doesnt|don\'t|dont|didn\'t|didnt|without)';
const NEGATION_PATTERN = `\\b${NEGATION_PREFIX}\\s+(?:(?!(?:but|however|although|though|issues?|problems?|concerns?|doubts?|defects?|flaws?)\\b)[a-zA-Z0-9']+\\s+){0,3}`;

/**
 * hasUnnegatedMatch: returns true when at least one occurrence of any keyword is
 * not immediately preceded by a negation word within the scoping window.
 * Multi-word phrases in the keyword list (e.g. "too bright") are matched verbatim
 * before single-word matching so that the phrase takes precedence.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function hasUnnegatedMatch(text, keywords) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  // Sort keywords longest-first so multi-word phrases are checked before their parts
  const sorted = [...keywords].sort((a, b) => b.length - a.length);

  return sorted.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Phrase keywords: match as substring (with word boundaries at start/end)
    const isPhrase = kw.includes(' ');
    const wordRegex = isPhrase
      ? new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'gi')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    const allMatches = lower.match(wordRegex);
    if (!allMatches) return false;

    const negRegex = new RegExp(`${NEGATION_PATTERN}${escaped}\\b`, 'gi');
    const negatedMatches = lower.match(negRegex) || [];
    return allMatches.length > negatedMatches.length;
  });
}

/**
 * Check if text contains negated positive evidence (e.g. "not comfortable", "not worth it").
 * @param {string} text
 * @returns {boolean}
 */
function hasNegatedPositiveEvidence(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  return POSITIVE_KEYWORDS.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${NEGATION_PATTERN}${escaped}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Check if comment has identifiable un-negated positive evidence.
 * @param {string} text
 * @returns {boolean}
 */
function hasPositiveEvidence(text) {
  return hasUnnegatedMatch(text, POSITIVE_KEYWORDS);
}

/**
 * Check if comment has identifiable concern evidence:
 * 1. Un-negated concern keywords (e.g., "expensive", but NOT "not expensive" or "not a concern").
 * 2. Negated positive statements (e.g., "not comfortable", "not worth it").
 * @param {string} text
 * @returns {boolean}
 */
function hasConcernEvidence(text) {
  if (hasUnnegatedMatch(text, CONCERN_KEYWORDS)) {
    return true;
  }
  if (hasNegatedPositiveEvidence(text)) {
    return true;
  }
  return false;
}

/**
 * Check if comment represents an inquiry or question.
 * @param {string} text
 * @returns {boolean}
 */
function isQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.includes('?')) {
    return true;
  }
  const lower = text.trim().toLowerCase();
  if (/^(?:do\s+not|don't|dont)\b/i.test(lower)) {
    return false;
  }
  return /^(?:is|does|how|can|what|where|when|why|will|should|would|could|do|are|has|have)\b/i.test(lower);
}

/**
 * Determine whether the *entire* comment is a bare interrogative sentence without a
 * preceding declarative clause. Examples of pure questions:
 *   "Is it comfortable?"
 *   "Does this fit standard doorways?"
 *   "How long does shipping take"
 * Examples that are NOT pure questions (mixed declarative + interrogative):
 *   "Love the color, but is it too heavy?"
 *   "Solid build, but heavy. How much does it weigh?"
 *
 * The heuristic: a comment is a pure question when it starts with an interrogative
 * word (or has no declarative clause before the first '?') and the text before
 * the first '?' contains no clause separator (comma, semicolon, sentence-ending
 * period, or the conjunctions 'but'/'however'/'although'/'though').
 *
 * @param {string} text - Already-trimmed comment text
 * @returns {boolean}
 */
function isPureInterrogative(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();

  const questionMark = trimmed.indexOf('?');
  // If there is no '?', rely on isQuestion()'s interrogative-word check:
  // those sentences are guaranteed to start with a question word with no prefix.
  if (questionMark === -1) {
    return /^(?:is|does|how|can|what|where|when|why|will|should|would|could|do|are|has|have)\b/i.test(trimmed);
  }

  // Everything before the first '?'
  const beforeQ = trimmed.slice(0, questionMark).trim();

  // If there's a clause separator or sentence delimiter before the '?', it's a mixed comment.
  if (/[,;!:\.]|\bbut\b|\bhowever\b|\balthough\b|\bthough\b/i.test(beforeQ)) {
    return false;
  }

  // Must begin with an interrogative word to be a pure interrogative sentence
  return /^(?:is|does|how|can|what|where|when|why|will|should|would|could|do|are|has|have)\b/i.test(beforeQ);
}

/**
 * Categorize comments deterministically into advantages, concerns, questions, and neutral feedback.
 * Only uses actual user comments without inventing data.
 *
 * Classification rules:
 * - A comment with identifiable un-negated concern evidence → concerns.
 * - A comment whose entire body is an interrogative sentence (starts with a question word
 *   and/or ends with '?') → unresolvedQuestions. Positive keywords that appear exclusively
 *   *within* a pure question are NOT counted as positive evidence for that question.
 * - A comment with identifiable positive evidence → advantages (only if its positive
 *   keywords appear outside a pure-question clause, i.e. the comment is not a bare question).
 * - Mixed: a comment can appear in multiple categories simultaneously.
 * - Neutral: not matched by any rule → otherFeedback.
 *
 * @param {Array<object|string>} comments
 * @returns {{ hasFeedback: boolean, advantages: string[], concerns: string[], unresolvedQuestions: string[], otherFeedback: string[], neutralComments: string[], totalComments: number }}
 */
function analyzeComments(comments = []) {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return {
      hasFeedback: false,
      advantages: [],
      concerns: [],
      unresolvedQuestions: [],
      otherFeedback: [],
      neutralComments: [],
      totalComments: 0,
    };
  }

  const advantages = [];
  const concerns = [];
  const unresolvedQuestions = [];
  const otherFeedback = [];
  let validCommentCount = 0;

  for (const c of comments) {
    const rawText = (c && typeof c === 'object') ? (c.text || '') : (typeof c === 'string' ? c : '');
    if (typeof rawText !== 'string') continue;

    const text = rawText.trim();
    if (!text) continue;

    validCommentCount++;
    let matchedAny = false;

    // 1. Check for questions or unresolved inquiries
    const isQ = isQuestion(text);
    if (isQ) {
      matchedAny = true;
      if (!unresolvedQuestions.includes(text)) {
        unresolvedQuestions.push(text);
      }
    }

    // 2. Check for identifiable concerns
    if (hasConcernEvidence(text)) {
      matchedAny = true;
      if (!concerns.includes(text)) {
        concerns.push(text);
      }
    }

    // 3. Check for identifiable positive evidence.
    //    A "pure question" — where the entire comment is a single interrogative sentence
    //    (i.e. no non-question prefix) — must not be counted as an advantage even when a
    //    positive keyword appears in the question body (e.g. "Is it comfortable?").
    //    A comment qualifies for advantages only when it has un-negated positive evidence
    //    AND is not a bare interrogative without any declarative positive clause.
    const isPureQuestion = isQ && isPureInterrogative(text);
    if (!isPureQuestion && hasPositiveEvidence(text)) {
      matchedAny = true;
      if (!advantages.includes(text)) {
        advantages.push(text);
      }
    }

    // 4. Neutral comments (only when not positive, not a concern, not a question)
    if (!matchedAny) {
      if (!otherFeedback.includes(text)) {
        otherFeedback.push(text);
      }
    }
  }

  return {
    hasFeedback: validCommentCount > 0,
    advantages,
    concerns,
    unresolvedQuestions,
    otherFeedback,
    neutralComments: otherFeedback,
    totalComments: validCommentCount,
  };
}

/**
 * Calculate the deterministic consensus score for a product's vote totals.
 * @param {object} prodTotals - { Love, Like, 'Need more info', No }
 * @returns {number} Score
 */
function calculateProductScore(prodTotals = {}) {
  const loveCount = prodTotals.Love || 0;
  const likeCount = prodTotals.Like || 0;
  const needInfoCount = prodTotals['Need more info'] || 0;
  const noCount = prodTotals.No || 0;

  return (
    loveCount * SCORING_RULES.Love +
    likeCount * SCORING_RULES.Like +
    needInfoCount * SCORING_RULES['Need more info'] +
    noCount * SCORING_RULES.No
  );
}

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 0 && n < NUMBER_WORDS.length) {
    return NUMBER_WORDS[n];
  }
  return String(n);
}

/**
 * Generate a deterministic summary sentence from persisted votes and comments.
 * Uses real counts and theme frequencies without inventing reasons or falsifying rankings.
 *
 * Examples:
 *   "Four of six participants gave this product a Love or Like."
 *   "Price was the most frequently mentioned feedback theme."
 *
 * @param {object} room - Room object containing participants
 * @param {object} item - Product stats item (product, score, voteCount, breakdown, feedbackSummary)
 * @param {object} [options] - Optional flags ({ isTie: boolean })
 * @returns {string}
 */
function generateSummarySentence(room, item, options = {}) {
  if (!item || !item.product) {
    return 'No products to evaluate in this room yet.';
  }

  const participantsCount = room && Array.isArray(room.participants) ? room.participants.length : 0;
  const breakdown = item.breakdown || { Love: 0, Like: 0, 'Need more info': 0, No: 0 };
  const positiveVotes = (breakdown.Love || 0) + (breakdown.Like || 0);
  const totalProductVotes = item.voteCount || 0;
  const feedback = item.feedbackSummary || {};

  // Part 1: Voting Sentence
  let voteSentence = '';

  if (totalProductVotes === 0) {
    if (participantsCount === 0) {
      voteSentence = 'No participants have joined or voted on this product yet.';
    } else {
      voteSentence = 'No participants have voted on this product yet.';
    }
  } else if (participantsCount > 0) {
    if (positiveVotes === participantsCount && participantsCount >= 2) {
      voteSentence = `All ${formatNumber(participantsCount).toLowerCase()} participants gave this product a Love or Like.`;
    } else if (positiveVotes === 0) {
      voteSentence = `None of the ${formatNumber(participantsCount).toLowerCase()} participants gave this product a Love or Like.`;
    } else {
      voteSentence = `${formatNumber(positiveVotes)} of ${formatNumber(participantsCount).toLowerCase()} participants gave this product a Love or Like.`;
    }
  } else {
    const pWord = formatNumber(positiveVotes);
    voteSentence = `${pWord} participant${positiveVotes === 1 ? '' : 's'} gave this product a Love or Like.`;
  }

  // Handle tie scenario explicitly if requested
  if (options.isTie) {
    voteSentence += ` This product is tied for the top consensus ranking with ${item.score} points.`;
  }

  // Part 2: Feedback Theme Sentence
  let themeSentence = '';
  const rawComments = [];
  if (feedback.advantages) rawComments.push(...feedback.advantages);
  if (feedback.concerns) rawComments.push(...feedback.concerns);
  if (feedback.unresolvedQuestions) rawComments.push(...feedback.unresolvedQuestions);
  if (feedback.otherFeedback) rawComments.push(...feedback.otherFeedback);

  if (rawComments.length > 0) {
    const combinedText = rawComments.join(' ').toLowerCase();

    const themes = [
      { name: 'Price', regex: /\b(?:price|expensive|cost|costly|budget|affordable|cheap|overpriced)\b/i },
      { name: 'Quality', regex: /\b(?:quality|durable|durability|sturdy|build|materials?|flimsy|fragile)\b/i },
      { name: 'Comfort', regex: /\b(?:comfort|comfortable|uncomfortable|ergonomic|soft|seating)\b/i },
      { name: 'Design', regex: /\b(?:design|stylish|style|look|looks|sleek|color|finish|aesthetic|modern)\b/i },
      { name: 'Size and fit', regex: /\b(?:size|fit|dimensions|bulky|space|loose|tight|compact|weight|heavy)\b/i },
    ];

    let maxCount = 0;
    let topTheme = null;

    for (const t of themes) {
      const matches = combinedText.match(new RegExp(t.regex.source, 'gi'));
      const count = matches ? matches.length : 0;
      if (count > maxCount) {
        maxCount = count;
        topTheme = t.name;
      }
    }

    if (topTheme && maxCount >= 1) {
      themeSentence = `${topTheme} was the most frequently mentioned feedback theme.`;
    } else if (feedback.concerns && feedback.concerns.length > 0) {
      const cCount = feedback.concerns.length;
      themeSentence = `Participants noted ${cCount} ${cCount === 1 ? 'concern' : 'concerns'} regarding this product.`;
    } else if (feedback.advantages && feedback.advantages.length > 0) {
      themeSentence = 'Participants highlighted positive advantages in their feedback.';
    } else if (feedback.unresolvedQuestions && feedback.unresolvedQuestions.length > 0) {
      themeSentence = 'Participants raised questions regarding this product.';
    }
  }

  if (themeSentence) {
    return `${voteSentence} ${themeSentence}`.trim();
  }

  return voteSentence;
}

/**
 * Compute the decision summary for a given serialized room.
 * @param {object} room - Serialized room object from getRoomById
 * @returns {object} Structured decision summary
 */
function computeDecisionSummary(room) {
  if (!room) {
    return null;
  }

  const products = Array.isArray(room.products) ? room.products : [];
  const votes = room.votes || {};
  const voteTotals = room.voteTotals || {};
  const comments = room.comments || {};

  // Case 1: Room has no products
  if (products.length === 0) {
    return {
      roomId: room.id,
      roomTitle: room.title,
      algorithm: {
        name: 'Weighted Consensus Ranking',
        rules: SCORING_RULES,
        tieBreakers: TIE_BREAKER_CRITERIA,
      },
      status: 'no_products',
      message: 'No products have been added to this room yet.',
      winner: null,
      tiedWinners: null,
      finalChoice: null,
      finalProductId: room.finalProductId || null,
      rankings: [],
      totalVotesCast: 0,
      totalParticipants: (room.participants || []).length,
      summarySentence: 'No products to evaluate in this room yet.',
    };
  }

  // Calculate scores for each selected product
  let totalVotesInRoom = 0;

  const productStats = products.map((product) => {
    const prodTotals = voteTotals[product.id] || {
      Love: 0,
      Like: 0,
      No: 0,
      'Need more info': 0,
    };

    const loveCount = prodTotals.Love || 0;
    const likeCount = prodTotals.Like || 0;
    const needInfoCount = prodTotals['Need more info'] || 0;
    const noCount = prodTotals.No || 0;

    const voteCount = loveCount + likeCount + needInfoCount + noCount;
    totalVotesInRoom += voteCount;

    // Deterministic weighted formula
    const score =
      loveCount * SCORING_RULES.Love +
      likeCount * SCORING_RULES.Like +
      needInfoCount * SCORING_RULES['Need more info'] +
      noCount * SCORING_RULES.No;

    const prodComments = comments[product.id] || [];
    const feedbackSummary = analyzeComments(prodComments);

    return {
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        imageUrl: product.imageUrl,
        description: product.description,
      },
      score,
      voteCount,
      breakdown: {
        Love: loveCount,
        Like: likeCount,
        'Need more info': needInfoCount,
        No: noCount,
      },
      commentCount: prodComments.length,
      feedbackSummary,
    };
  });

  // Case 2: Products exist, but zero votes have been cast
  if (totalVotesInRoom === 0) {
    const unvotedRankings = productStats.map((item, idx) => ({
      rank: idx + 1,
      ...item,
      summarySentence: generateSummarySentence(room, item),
    }));

    let finalChoice = null;
    if (room.finalProductId) {
      const fcItem = unvotedRankings.find((r) => r.product.id === room.finalProductId);
      if (fcItem) {
        finalChoice = { ...fcItem };
      }
    }

    return {
      roomId: room.id,
      roomTitle: room.title,
      algorithm: {
        name: 'Weighted Consensus Ranking',
        rules: SCORING_RULES,
        tieBreakers: TIE_BREAKER_CRITERIA,
      },
      status: 'insufficient_data',
      message: 'No votes have been cast yet. Cast votes to see the decision summary.',
      winner: null,
      tiedWinners: null,
      finalChoice,
      finalProductId: room.finalProductId || null,
      rankings: unvotedRankings,
      totalVotesCast: 0,
      totalParticipants: (room.participants || []).length,
      summarySentence: finalChoice ? finalChoice.summarySentence : 'No votes have been cast yet.',
    };
  }

  // Sort products according to deterministic ranking rules:
  // 1. Highest total score (descending)
  // 2. Highest Love count (descending)
  // 3. Highest vote count (descending)
  productStats.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.breakdown.Love !== a.breakdown.Love) {
      return b.breakdown.Love - a.breakdown.Love;
    }
    return b.voteCount - a.voteCount;
  });

  // Assign ranks (handling ties in rank assignment)
  const rankings = [];
  for (let i = 0; i < productStats.length; i++) {
    const curr = productStats[i];
    let rank = i + 1;

    // Check if tied with previous
    if (i > 0) {
      const prev = productStats[i - 1];
      if (
        curr.score === prev.score &&
        curr.breakdown.Love === prev.breakdown.Love &&
        curr.voteCount === prev.voteCount
      ) {
        rank = rankings[i - 1].rank;
      }
    }

    rankings.push({
      rank,
      ...curr,
    });
  }

  // Determine top status: Single winner vs Tie
  const topProduct = rankings[0];
  const topTied = rankings.filter((r) => r.rank === 1);

  let status = 'winner';
  let winner = topProduct;
  let tiedWinners = null;

  if (topTied.length > 1) {
    status = 'tie';
    winner = null;
    tiedWinners = topTied;
  }

  let tieBreakReason = null;
  if (status === 'winner' && rankings.length > 1 && rankings[0].score === rankings[1].score) {
    if (rankings[0].breakdown.Love > rankings[1].breakdown.Love) {
      tieBreakReason = 'Highest number of Love votes';
    } else if (rankings[0].voteCount > rankings[1].voteCount) {
      tieBreakReason = 'Highest total votes cast';
    }
  }

  // Populate summary sentences for all ranked items
  for (const item of rankings) {
    item.summarySentence = generateSummarySentence(room, item, {
      isTie: status === 'tie' && item.rank === 1,
    });
  }

  if (winner) {
    winner.summarySentence = generateSummarySentence(room, winner);
    if (tieBreakReason) winner.tieBreakReason = tieBreakReason;
  }

  // Build feedback map for convenient lookup
  const feedback = {};
  for (const item of rankings) {
    feedback[item.product.id] = {
      highlights: item.feedbackSummary?.advantages || [],
      concerns: item.feedbackSummary?.concerns || [],
      questions: item.feedbackSummary?.unresolvedQuestions || [],
      topKeywords: item.feedbackSummary?.topKeywords || [],
      sentiment: item.feedbackSummary?.sentiment || 'neutral',
    };
  }

  // Determine final choice if set by creator
  let finalChoice = null;
  if (room.finalProductId) {
    const fcItem = rankings.find((r) => r.product.id === room.finalProductId);
    if (fcItem) {
      finalChoice = {
        ...fcItem,
        summarySentence: generateSummarySentence(room, fcItem),
      };
    }
  }

  const overallSentence = finalChoice
    ? finalChoice.summarySentence
    : (winner ? winner.summarySentence : (topTied[0] ? topTied[0].summarySentence : ''));

  return {
    roomId: room.id,
    roomTitle: room.title,
    algorithm: {
      name: 'Weighted Consensus Ranking',
      rules: SCORING_RULES,
      tieBreakers: TIE_BREAKER_CRITERIA,
    },
    status,
    winner,
    tiedWinners,
    tieBreakReason,
    finalChoice,
    finalProductId: room.finalProductId || null,
    rankings,
    feedback,
    totalVotesCast: totalVotesInRoom,
    totalParticipants: (room.participants || []).length,
    summarySentence: overallSentence,
  };
}

module.exports = {
  SCORING_RULES,
  TIE_BREAKER_CRITERIA,
  calculateProductScore,
  analyzeComments,
  generateSummarySentence,
  computeDecisionSummary,
  hasPositiveEvidence,
  hasConcernEvidence,
  isQuestion,
  isPureInterrogative,
};
