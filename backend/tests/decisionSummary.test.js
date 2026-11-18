/**
 * Phase 6 Tests: Final Decision Summary
 * Tests scoring rules, tie-breaking, comment summarization, isolation,
 * real-time updates, and persistence across SQLite restarts.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-phase6-summary.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb } = require('../src/db/database.js');
const {
  saveRoom,
  getRoomById,
  addProductToRoom,
  removeProductFromRoom,
  addOrUpdateParticipant,
  recordVote,
  addComment,
  setRoomFinalChoice,
  clearRooms,
} = require('../src/store/roomStore.js');
const {
  computeDecisionSummary,
  calculateProductScore,
  analyzeComments,
  generateSummarySentence,
  hasPositiveEvidence,
  hasConcernEvidence,
  isQuestion,
  SCORING_RULES,
} = require('../src/services/decisionSummary.js');
const { products: catalogProducts } = require('../src/data/products.js');

describe('Phase 6: Final Decision Summary & Ranking Algorithm', () => {
  beforeEach(() => {
    initDb(TEST_DB_PATH);
    clearRooms();
  });

  afterAll(() => {
    closeDb();
    for (const ext of ['', '-wal', '-shm']) {
      const file = `${TEST_DB_PATH}${ext}`;
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
    }
  });

  describe('Point calculations for all four vote options', () => {
    it('accurately computes Love=3, Like=2, Need more info=1, No=0', () => {
      expect(SCORING_RULES['Love']).toBe(3);
      expect(SCORING_RULES['Like']).toBe(2);
      expect(SCORING_RULES['Need more info']).toBe(1);
      expect(SCORING_RULES['No']).toBe(0);

      const totals = {
        Love: 2, // 2 * 3 = 6
        Like: 3, // 3 * 2 = 6
        'Need more info': 4, // 4 * 1 = 4
        No: 5, // 5 * 0 = 0
      };
      const score = calculateProductScore(totals);
      expect(score).toBe(16);
    });
  });

  describe('Deterministic ranking order & tie detection', () => {
    it('ranks products by score, then Love votes, then total votes', () => {
      const room = saveRoom({ title: 'Ranking Test Room' });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];
      const p3 = catalogProducts[2];

      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);
      addProductToRoom(room.id, p3);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      addOrUpdateParticipant(room.id, { id: 'u2', name: 'Bob' });
      addOrUpdateParticipant(room.id, { id: 'u3', name: 'Charlie' });

      // P1: 2 Love = 6 pts (2 votes)
      recordVote(room.id, p1.id, 'u1', 'Love');
      recordVote(room.id, p1.id, 'u2', 'Love');

      // P2: 3 Like = 6 pts (3 votes, 0 Love)
      recordVote(room.id, p2.id, 'u1', 'Like');
      recordVote(room.id, p2.id, 'u2', 'Like');
      recordVote(room.id, p2.id, 'u3', 'Like');

      // P3: 1 Like = 2 pts (1 vote)
      recordVote(room.id, p3.id, 'u1', 'Like');

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      expect(summary.status).toBe('winner');
      // P1 wins tie-break over P2 because P1 has 2 Love votes vs 0 Love votes
      expect(summary.winner.product.id).toBe(p1.id);
      expect(summary.rankings[0].product.id).toBe(p1.id);
      expect(summary.rankings[0].rank).toBe(1);
      expect(summary.rankings[1].product.id).toBe(p2.id);
      expect(summary.rankings[1].rank).toBe(2);
      expect(summary.rankings[2].product.id).toBe(p3.id);
      expect(summary.rankings[2].rank).toBe(3);
    });

    it('reports an authentic tie when products have identical score, Love votes, and vote counts', () => {
      const room = saveRoom({ title: 'Tie Test Room' });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      addOrUpdateParticipant(room.id, { id: 'u2', name: 'Bob' });

      // Both P1 and P2 get 1 Love + 1 Like = 5 pts
      recordVote(room.id, p1.id, 'u1', 'Love');
      recordVote(room.id, p1.id, 'u2', 'Like');

      recordVote(room.id, p2.id, 'u1', 'Love');
      recordVote(room.id, p2.id, 'u2', 'Like');

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      expect(summary.status).toBe('tie');
      expect(summary.tiedWinners).toHaveLength(2);
      expect(summary.rankings[0].rank).toBe(1);
      expect(summary.rankings[1].rank).toBe(1);
    });
  });

  describe('Edge cases: No products and no votes', () => {
    it('returns no_products status for a room with zero products', () => {
      const room = saveRoom({ title: 'Empty Room' });
      const summary = computeDecisionSummary(room);

      expect(summary.status).toBe('no_products');
      expect(summary.winner).toBeNull();
      expect(summary.rankings).toEqual([]);
    });

    it('returns insufficient_data status when products exist but no votes have been cast', () => {
      const room = saveRoom({ title: 'Unvoted Room' });
      addProductToRoom(room.id, catalogProducts[0]);

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      expect(summary.status).toBe('insufficient_data');
      expect(summary.winner).toBeNull();
      expect(summary.rankings).toHaveLength(1);
      expect(summary.rankings[0].score).toBe(0);
      expect(summary.rankings[0].voteCount).toBe(0);
    });
  });

  describe('Comment counts and evidence-based feedback summarization', () => {
    it('categorizes highlights, concerns, and questions deterministically from actual text', () => {
      const room = saveRoom({ title: 'Comments Summary Room' });
      const p1 = catalogProducts[0];
      addProductToRoom(room.id, p1);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      addOrUpdateParticipant(room.id, { id: 'u2', name: 'Bob' });
      addOrUpdateParticipant(room.id, { id: 'u3', name: 'Charlie' });

      recordVote(room.id, p1.id, 'u1', 'Love');

      addComment(room.id, p1.id, {
        participantId: 'u1',
        text: 'Great quality and amazing modern design, definitely worth it',
      });
      addComment(room.id, p1.id, {
        participantId: 'u2',
        text: 'Expensive price and heavy to assemble',
      });
      addComment(room.id, p1.id, {
        participantId: 'u3',
        text: 'Does this fit standard doorways? Need warranty details.',
      });

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      const p1Summary = summary.rankings.find((r) => r.product.id === p1.id);
      expect(p1Summary.commentCount).toBe(3);
      expect(p1Summary.feedbackSummary.hasFeedback).toBe(true);

      expect(p1Summary.feedbackSummary.advantages).toContain(
        'Great quality and amazing modern design, definitely worth it'
      );
      expect(p1Summary.feedbackSummary.concerns).toContain(
        'Expensive price and heavy to assemble'
      );
      expect(p1Summary.feedbackSummary.unresolvedQuestions).toContain(
        'Does this fit standard doorways? Need warranty details.'
      );
    });

    it('states empty feedback when no comments are provided', () => {
      const room = saveRoom({ title: 'No Comments Room' });
      const p1 = catalogProducts[0];
      addProductToRoom(room.id, p1);
      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      recordVote(room.id, p1.id, 'u1', 'Love');

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      const p1Summary = summary.rankings[0];
      expect(p1Summary.commentCount).toBe(0);
      expect(p1Summary.feedbackSummary.hasFeedback).toBe(false);
      expect(p1Summary.feedbackSummary.advantages).toEqual([]);
      expect(p1Summary.feedbackSummary.concerns).toEqual([]);
      expect(p1Summary.feedbackSummary.unresolvedQuestions).toEqual([]);
      expect(p1Summary.feedbackSummary.otherFeedback).toEqual([]);
    });

    it('does not classify neutral comments as advantages and preserves them in otherFeedback/neutralComments', () => {
      const comments = [
        { text: 'I saw this at the retail store yesterday' },
        { text: 'Dimensions are 45cm x 60cm' },
        { text: 'Color option available is charcoal' },
      ];

      const result = analyzeComments(comments);

      expect(result.hasFeedback).toBe(true);
      // None of the neutral comments should appear under advantages
      expect(result.advantages).toHaveLength(0);
      expect(result.concerns).toHaveLength(0);
      expect(result.unresolvedQuestions).toHaveLength(0);

      // Preserved in otherFeedback and neutralComments
      expect(result.otherFeedback).toHaveLength(3);
      expect(result.otherFeedback).toContain('I saw this at the retail store yesterday');
      expect(result.otherFeedback).toContain('Dimensions are 45cm x 60cm');
      expect(result.otherFeedback).toContain('Color option available is charcoal');
      expect(result.neutralComments).toEqual(result.otherFeedback);
    });

    it('classifies only comments with identifiable positive evidence as advantages', () => {
      const comments = [
        { text: 'Extremely comfortable seating with excellent lumbar support' },
        { text: 'Love the stylish minimalist design, worth every penny' },
      ];

      const result = analyzeComments(comments);

      expect(result.advantages).toHaveLength(2);
      expect(result.advantages).toContain('Extremely comfortable seating with excellent lumbar support');
      expect(result.advantages).toContain('Love the stylish minimalist design, worth every penny');
      expect(result.concerns).toHaveLength(0);
      expect(result.otherFeedback).toHaveLength(0);
    });

    it('classifies comments with identifiable concerns as concerns', () => {
      const comments = [
        { text: 'Too expensive compared to other options' },
        { text: 'Materials feel flimsy and assembly was very hard' },
      ];

      const result = analyzeComments(comments);

      expect(result.concerns).toHaveLength(2);
      expect(result.concerns).toContain('Too expensive compared to other options');
      expect(result.concerns).toContain('Materials feel flimsy and assembly was very hard');
      expect(result.advantages).toHaveLength(0);
    });

    it('classifies questions and inquiries as unresolved questions', () => {
      const comments = [
        { text: 'Does it come with a 2-year warranty?' },
        { text: 'How long does standard shipping take' },
        { text: 'Can we adjust the armrest height?' },
      ];

      const result = analyzeComments(comments);

      expect(result.unresolvedQuestions).toHaveLength(3);
      expect(result.unresolvedQuestions).toContain('Does it come with a 2-year warranty?');
      expect(result.unresolvedQuestions).toContain('How long does standard shipping take');
      expect(result.unresolvedQuestions).toContain('Can we adjust the armrest height?');
      expect(result.advantages).toHaveLength(0);
      expect(result.otherFeedback).toHaveLength(0);
    });

    it('correctly handles comments that match more than one category', () => {
      // 1. Positive + Concern
      const mixed1 = [{ text: 'Great quality and stylish build, but the price is too expensive' }];
      const res1 = analyzeComments(mixed1);
      expect(res1.advantages).toContain('Great quality and stylish build, but the price is too expensive');
      expect(res1.concerns).toContain('Great quality and stylish build, but the price is too expensive');
      expect(res1.unresolvedQuestions).toHaveLength(0);
      expect(res1.otherFeedback).toHaveLength(0);

      // 2. Positive + Question
      const mixed2 = [{ text: 'Love the sleek look! Does it include a cable organizer?' }];
      const res2 = analyzeComments(mixed2);
      expect(res2.advantages).toContain('Love the sleek look! Does it include a cable organizer?');
      expect(res2.unresolvedQuestions).toContain('Love the sleek look! Does it include a cable organizer?');
      expect(res2.concerns).toHaveLength(0);

      // 3. Concern + Question
      const mixed3 = [{ text: 'A bit bulky for small rooms. Can the feet be folded?' }];
      const res3 = analyzeComments(mixed3);
      expect(res3.concerns).toContain('A bit bulky for small rooms. Can the feet be folded?');
      expect(res3.unresolvedQuestions).toContain('A bit bulky for small rooms. Can the feet be folded?');
      expect(res3.advantages).toHaveLength(0);

      // 4. Positive + Concern + Question
      const mixed4 = [{ text: 'Solid construction and beautiful finish, but somewhat heavy. How much does it weigh?' }];
      const res4 = analyzeComments(mixed4);
      expect(res4.advantages).toHaveLength(1);
      expect(res4.concerns).toHaveLength(1);
      expect(res4.unresolvedQuestions).toHaveLength(1);
    });

    it('classifies negated positive remarks as concerns rather than advantages', () => {
      const comments = [
        { text: 'Not comfortable at all for longer work sessions' },
        { text: 'Definitely not worth the high price tag' },
      ];

      const result = analyzeComments(comments);

      expect(result.advantages).toHaveLength(0);
      expect(result.concerns).toHaveLength(2);
      expect(result.concerns).toContain('Not comfortable at all for longer work sessions');
      expect(result.concerns).toContain('Definitely not worth the high price tag');
    });

    it('preserves the original comment text without alteration', () => {
      const text = '  Exact capitalization and punctuation preserved! 123  ';
      const result = analyzeComments([{ text }]);

      // Preserves original trimmed string
      expect(result.unresolvedQuestions).toEqual([]);
      expect(result.advantages).toHaveLength(0);
      expect(result.otherFeedback).toContain('Exact capitalization and punctuation preserved! 123');
    });
  });

  describe('Phase 7.1 Regression: Negation handling and edge cases in comment analysis', () => {
    // 1. Negated positive keywords
    it('1. correctly classifies negated positive keywords as concerns and not advantages', () => {
      const comments = [
        { text: 'Not comfortable at all' },
        { text: 'Definitely not worth it' },
        { text: 'Never durable in my experience' },
        { text: 'This isn\'t reliable for daily use' },
      ];

      const res = analyzeComments(comments);
      expect(res.advantages).toHaveLength(0);
      expect(res.concerns).toHaveLength(4);
      expect(res.concerns).toContain('Not comfortable at all');
      expect(res.concerns).toContain('Definitely not worth it');
      expect(res.concerns).toContain('Never durable in my experience');
      expect(res.concerns).toContain('This isn\'t reliable for daily use');
      expect(hasPositiveEvidence('Not comfortable at all')).toBe(false);
      expect(hasConcernEvidence('Not comfortable at all')).toBe(true);
    });

    // 2. Negated concern keywords
    it('2. does not treat negated concern keywords as concerns', () => {
      const comments = [
        { text: 'This is not expensive' },
        { text: 'This is not a concern' },
        { text: 'Without any issues' },
        { text: 'No problem at all' },
        { text: 'Not too heavy to carry' },
      ];

      const res = analyzeComments(comments);
      expect(res.concerns).toHaveLength(0);
      expect(res.advantages).toHaveLength(0);
      // All 5 should be preserved as neutral feedback
      expect(res.otherFeedback).toHaveLength(5);
      expect(res.otherFeedback).toContain('This is not expensive');
      expect(res.otherFeedback).toContain('This is not a concern');
      expect(res.otherFeedback).toContain('Without any issues');
      expect(res.otherFeedback).toContain('No problem at all');
      expect(res.otherFeedback).toContain('Not too heavy to carry');

      expect(hasConcernEvidence('This is not expensive')).toBe(false);
      expect(hasConcernEvidence('This is not a concern')).toBe(false);
      expect(hasConcernEvidence('Without any issues')).toBe(false);
      expect(hasConcernEvidence('No problem at all')).toBe(false);
    });

    // 3. Positive and negative evidence in one comment
    it('3. places comments with both positive and negative evidence into advantages and concerns', () => {
      const comments = [
        { text: 'This is good but expensive' },
        { text: 'Great quality, but somewhat noisy fan' },
      ];

      const res = analyzeComments(comments);
      expect(res.advantages).toHaveLength(2);
      expect(res.concerns).toHaveLength(2);
      expect(res.advantages).toContain('This is good but expensive');
      expect(res.concerns).toContain('This is good but expensive');
      expect(res.advantages).toContain('Great quality, but somewhat noisy fan');
      expect(res.concerns).toContain('Great quality, but somewhat noisy fan');
      expect(res.otherFeedback).toHaveLength(0);
      expect(res.unresolvedQuestions).toHaveLength(0);
    });

    // 4. Neutral comments
    it('4. preserves neutral comments without positive or concern evidence in otherFeedback/neutralComments', () => {
      const comments = [
        { text: 'The delivery arrives on Friday' },
        { text: 'Product arrived in a blue cardboard box' },
        { text: 'Assembly manual is on page 4' },
      ];

      const res = analyzeComments(comments);
      expect(res.advantages).toHaveLength(0);
      expect(res.concerns).toHaveLength(0);
      expect(res.unresolvedQuestions).toHaveLength(0);
      expect(res.otherFeedback).toHaveLength(3);
      expect(res.otherFeedback).toContain('The delivery arrives on Friday');
      expect(res.otherFeedback).toContain('Product arrived in a blue cardboard box');
      expect(res.otherFeedback).toContain('Assembly manual is on page 4');
      expect(res.neutralComments).toEqual(res.otherFeedback);
    });

    // 5. Questions mixed with positive or negative evidence
    it('5. classifies questions mixed with positive and/or negative evidence accurately', () => {
      const comments = [
        { text: 'Love the color, but is it too heavy?' },
        { text: 'Great finish, but how long is the warranty?' },
        { text: 'Why is this so expensive?' },
      ];

      const res = analyzeComments(comments);

      // 1st comment has Love (positive), heavy (concern), and 'is it...' ? (question)
      expect(res.advantages).toContain('Love the color, but is it too heavy?');
      expect(res.concerns).toContain('Love the color, but is it too heavy?');
      expect(res.unresolvedQuestions).toContain('Love the color, but is it too heavy?');

      // 2nd comment has Great finish (positive) and 'how long...' ? (question)
      expect(res.advantages).toContain('Great finish, but how long is the warranty?');
      expect(res.unresolvedQuestions).toContain('Great finish, but how long is the warranty?');

      // 3rd comment has expensive (concern) and 'why is...' ? (question)
      expect(res.concerns).toContain('Why is this so expensive?');
      expect(res.unresolvedQuestions).toContain('Why is this so expensive?');
    });

    // 6. Empty strings and whitespace-only comments
    it('6. safely ignores empty strings and whitespace-only comments without corrupting counts', () => {
      const comments = [
        { text: '' },
        { text: '   ' },
        { text: '\t\n' },
        { text: 'Solid performance and sleek frame' },
      ];

      const res = analyzeComments(comments);
      expect(res.totalComments).toBe(1);
      expect(res.hasFeedback).toBe(true);
      expect(res.advantages).toEqual(['Solid performance and sleek frame']);
      expect(res.concerns).toEqual([]);
      expect(res.unresolvedQuestions).toEqual([]);
      expect(res.otherFeedback).toEqual([]);

      // Completely empty array or only whitespace comments
      const emptyRes = analyzeComments([{ text: '   ' }, { text: '' }]);
      expect(emptyRes.totalComments).toBe(0);
      expect(emptyRes.hasFeedback).toBe(false);
      expect(emptyRes.advantages).toEqual([]);
    });

    // 7. Duplicate comments
    it('7. deduplicates identical comment text in category arrays while preserving total comment count', () => {
      const comments = [
        { text: 'Solid performance and sleek frame' },
        { text: 'Solid performance and sleek frame' },
        { text: 'Too expensive' },
        { text: 'Too expensive' },
      ];

      const res = analyzeComments(comments);
      expect(res.totalComments).toBe(4);
      expect(res.hasFeedback).toBe(true);
      expect(res.advantages).toHaveLength(1);
      expect(res.advantages).toEqual(['Solid performance and sleek frame']);
      expect(res.concerns).toHaveLength(1);
      expect(res.concerns).toEqual(['Too expensive']);
    });

    // 8. Original comment text preservation
    it('8. preserves the original comment text exactly without modifying casing, punctuation, or numbers', () => {
      const rawSample = '  This is GOOD, but costs $399.99 (Expensive!!)?  ';
      const res = analyzeComments([{ text: rawSample }]);

      const expectedPreserved = 'This is GOOD, but costs $399.99 (Expensive!!)?';
      expect(res.advantages).toContain(expectedPreserved);
      expect(res.concerns).toContain(expectedPreserved);
      expect(res.unresolvedQuestions).toContain(expectedPreserved);
      // Ensure text was not lowercased or altered
      expect(res.advantages[0]).toBe(expectedPreserved);
    });
  });

  describe('Isolation, removals, and vote modifications', () => {
    it('isolates summary data strictly by room', () => {
      const roomA = saveRoom({ title: 'Room A' });
      const roomB = saveRoom({ title: 'Room B' });

      const p1 = catalogProducts[0];
      addProductToRoom(roomA.id, p1);
      addProductToRoom(roomB.id, p1);

      addOrUpdateParticipant(roomA.id, { id: 'uA', name: 'User A' });
      addOrUpdateParticipant(roomB.id, { id: 'uB', name: 'User B' });

      recordVote(roomA.id, p1.id, 'uA', 'Love');
      recordVote(roomB.id, p1.id, 'uB', 'No');

      const summaryA = computeDecisionSummary(getRoomById(roomA.id));
      const summaryB = computeDecisionSummary(getRoomById(roomB.id));

      expect(summaryA.rankings[0].score).toBe(3);
      expect(summaryB.rankings[0].score).toBe(0);
    });

    it('excludes products no longer selected in the room', () => {
      const room = saveRoom({ title: 'Product Removal Room' });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      recordVote(room.id, p1.id, 'u1', 'Love');
      recordVote(room.id, p2.id, 'u1', 'Like');

      // Remove p1
      removeProductFromRoom(room.id, p1.id);

      const updated = getRoomById(room.id);
      const summary = computeDecisionSummary(updated);

      expect(summary.rankings).toHaveLength(1);
      expect(summary.rankings[0].product.id).toBe(p2.id);
      expect(summary.winner.product.id).toBe(p2.id);
    });

    it('recalculates summary correctly after a participant changes their vote', () => {
      const room = saveRoom({ title: 'Vote Change Room' });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });

      recordVote(room.id, p1.id, 'u1', 'Love'); // p1 = 3 pts
      recordVote(room.id, p2.id, 'u1', 'Like'); // p2 = 2 pts

      let summary = computeDecisionSummary(getRoomById(room.id));
      expect(summary.winner.product.id).toBe(p1.id);

      // Alice changes vote on p2 to Love, and p1 to No
      recordVote(room.id, p1.id, 'u1', 'No'); // p1 = 0 pts
      recordVote(room.id, p2.id, 'u1', 'Love'); // p2 = 3 pts

      summary = computeDecisionSummary(getRoomById(room.id));
      expect(summary.winner.product.id).toBe(p2.id);
      expect(summary.rankings[0].score).toBe(3);
      expect(summary.rankings[1].score).toBe(0);
    });

    it('updates comment summary immediately after a comment is added', () => {
      const room = saveRoom({ title: 'Comment Addition Room' });
      const p1 = catalogProducts[0];
      addProductToRoom(room.id, p1);
      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      recordVote(room.id, p1.id, 'u1', 'Love');

      let summary = computeDecisionSummary(getRoomById(room.id));
      expect(summary.rankings[0].commentCount).toBe(0);

      addComment(room.id, p1.id, {
        participantId: 'u1',
        text: 'Super fast delivery and elegant design!',
      });

      summary = computeDecisionSummary(getRoomById(room.id));
      expect(summary.rankings[0].commentCount).toBe(1);
      expect(summary.rankings[0].feedbackSummary.advantages).toHaveLength(1);
    });
  });

  describe('Persistence across database restarts', () => {
    it('produces identical correct decision summary after closing and reopening SQLite', () => {
      const room = saveRoom({ title: 'Restart Persistence Room' });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      addOrUpdateParticipant(room.id, { id: 'u2', name: 'Bob' });

      recordVote(room.id, p1.id, 'u1', 'Love');
      recordVote(room.id, p1.id, 'u2', 'Like');
      recordVote(room.id, p2.id, 'u1', 'No');

      addComment(room.id, p1.id, {
        participantId: 'u1',
        text: 'Comfortable fabric and looks perfect in my room',
      });

      const preRestartSummary = computeDecisionSummary(getRoomById(room.id));

      // Close and reopen database
      closeDb();
      initDb(TEST_DB_PATH);

      const reloadedRoom = getRoomById(room.id);
      expect(reloadedRoom).not.toBeNull();

      const postRestartSummary = computeDecisionSummary(reloadedRoom);

      expect(postRestartSummary.status).toBe(preRestartSummary.status);
      expect(postRestartSummary.winner.product.id).toBe(preRestartSummary.winner.product.id);
      expect(postRestartSummary.winner.score).toBe(preRestartSummary.winner.score);
      expect(postRestartSummary.rankings[0].commentCount).toBe(1);
      expect(postRestartSummary.rankings[0].feedbackSummary.advantages).toEqual(
        preRestartSummary.rankings[0].feedbackSummary.advantages
      );
    });
  });

  describe('Phase A: Specific Comment Analysis Regression Suite', () => {
    it('"No issues with quality" must not automatically be classified as a concern', () => {
      const res = analyzeComments([{ text: 'No issues with quality' }]);
      expect(res.concerns).toHaveLength(0);
      expect(hasConcernEvidence('No issues with quality')).toBe(false);
      // Preserved as neutral feedback
      expect(res.otherFeedback).toContain('No issues with quality');
    });

    it('"Is it comfortable?" must be classified as a question', () => {
      const res = analyzeComments([{ text: 'Is it comfortable?' }]);
      expect(res.unresolvedQuestions).toContain('Is it comfortable?');
      expect(res.advantages).toHaveLength(0);
      expect(res.concerns).toHaveLength(0);
    });

    it('"Too bright", "Looks less versatile", "The fit seems loose" are classified as concerns', () => {
      const comments = [
        { text: 'Too bright' },
        { text: 'Looks less versatile' },
        { text: 'The fit seems loose' },
      ];
      const res = analyzeComments(comments);
      expect(res.concerns).toHaveLength(3);
      expect(res.concerns).toContain('Too bright');
      expect(res.concerns).toContain('Looks less versatile');
      expect(res.concerns).toContain('The fit seems loose');
      expect(res.advantages).toHaveLength(0);
      expect(res.unresolvedQuestions).toHaveLength(0);
    });

    it('"This is not expensive" must not automatically be classified as a concern', () => {
      const res = analyzeComments([{ text: 'This is not expensive' }]);
      expect(res.concerns).toHaveLength(0);
      expect(hasConcernEvidence('This is not expensive')).toBe(false);
      expect(res.otherFeedback).toContain('This is not expensive');
    });

    it('"It is good but expensive" = advantage + concern', () => {
      const res = analyzeComments([{ text: 'It is good but expensive' }]);
      expect(res.advantages).toContain('It is good but expensive');
      expect(res.concerns).toContain('It is good but expensive');
      expect(res.unresolvedQuestions).toHaveLength(0);
      expect(res.otherFeedback).toHaveLength(0);
    });

    it('"The delivery arrives on Friday" = neutral feedback (otherFeedback/neutralComments)', () => {
      const res = analyzeComments([{ text: 'The delivery arrives on Friday' }]);
      expect(res.advantages).toHaveLength(0);
      expect(res.concerns).toHaveLength(0);
      expect(res.unresolvedQuestions).toHaveLength(0);
      expect(res.otherFeedback).toContain('The delivery arrives on Friday');
      expect(res.neutralComments).toContain('The delivery arrives on Friday');
    });
  });

  describe('Phase B: Deterministic Summary Sentence & Final Choice Persistence', () => {
    it('generates accurate summary sentence for empty data (0 products or 0 votes)', () => {
      // 0 products
      const emptySentence = generateSummarySentence({ participants: [] }, null);
      expect(emptySentence).toBe('No products to evaluate in this room yet.');

      // 0 votes with participants
      const unvotedSentence = generateSummarySentence(
        { participants: [{ id: 'u1' }, { id: 'u2' }] },
        { product: catalogProducts[0], voteCount: 0, breakdown: { Love: 0, Like: 0 } }
      );
      expect(unvotedSentence).toBe('No participants have voted on this product yet.');
    });

    it('generates accurate summary sentence for four of six participants with Price feedback theme', () => {
      const room = {
        participants: [
          { id: 'u1' },
          { id: 'u2' },
          { id: 'u3' },
          { id: 'u4' },
          { id: 'u5' },
          { id: 'u6' },
        ],
      };

      const item = {
        product: catalogProducts[0],
        voteCount: 5,
        breakdown: {
          Love: 2,
          Like: 2,
          'Need more info': 1,
          No: 0,
        },
        feedbackSummary: {
          hasFeedback: true,
          advantages: ['Great quality and stylish build'],
          concerns: ['The price is too expensive for our budget', 'Expensive shipping cost'],
          unresolvedQuestions: [],
          otherFeedback: [],
        },
      };

      const sentence = generateSummarySentence(room, item);
      expect(sentence).toContain('Four of six participants gave this product a Love or Like.');
      expect(sentence).toContain('Price was the most frequently mentioned feedback theme.');
    });

    it('generates accurate summary sentence for ties without falsifying data', () => {
      const room = {
        participants: [{ id: 'u1' }, { id: 'u2' }],
      };
      const item = {
        product: catalogProducts[0],
        score: 6,
        voteCount: 2,
        breakdown: { Love: 2, Like: 0, 'Need more info': 0, No: 0 },
        feedbackSummary: {},
      };

      const sentence = generateSummarySentence(room, item, { isTie: true });
      expect(sentence).toContain('All two participants gave this product a Love or Like.');
      expect(sentence).toContain('This product is tied for the top consensus ranking with 6 points.');
    });

    it('generates accurate summary sentence for unanimous endorsement', () => {
      const room = {
        participants: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
      };
      const item = {
        product: catalogProducts[0],
        score: 9,
        voteCount: 3,
        breakdown: { Love: 3, Like: 0, 'Need more info': 0, No: 0 },
        feedbackSummary: {},
      };

      const sentence = generateSummarySentence(room, item);
      expect(sentence).toBe('All three participants gave this product a Love or Like.');
    });

    it('persists final choice and summary across SQLite database restarts', () => {
      const room = saveRoom({
        title: 'Restart Final Choice Room',
        creatorId: 'creator-123',
        creatorToken: 'secret-token-abc',
      });
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];
      addProductToRoom(room.id, p1);
      addProductToRoom(room.id, p2);

      addOrUpdateParticipant(room.id, { id: 'u1', name: 'Alice' });
      recordVote(room.id, p1.id, 'u1', 'Love');

      // Creator chooses p1 as final choice
      const choiceResult = setRoomFinalChoice(room.id, p1.id, 'secret-token-abc');
      expect(choiceResult.success).toBe(true);
      expect(choiceResult.room.finalProductId).toBe(p1.id);

      const preSummary = computeDecisionSummary(getRoomById(room.id));
      expect(preSummary.finalChoice).toBeDefined();
      expect(preSummary.finalChoice.product.id).toBe(p1.id);
      expect(preSummary.finalChoice.summarySentence).toBeDefined();

      // Restart SQLite database
      closeDb();
      initDb(TEST_DB_PATH);

      const reloadedRoom = getRoomById(room.id);
      expect(reloadedRoom).not.toBeNull();
      expect(reloadedRoom.finalProductId).toBe(p1.id);

      const postSummary = computeDecisionSummary(reloadedRoom);
      expect(postSummary.finalChoice).toBeDefined();
      expect(postSummary.finalChoice.product.id).toBe(p1.id);
      expect(postSummary.finalChoice.summarySentence).toBe(preSummary.finalChoice.summarySentence);
      expect(postSummary.summarySentence).toBe(preSummary.summarySentence);
    });
  });
});

