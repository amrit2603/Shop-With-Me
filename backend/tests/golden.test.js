import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { computeDecisionSummary } = require('../src/services/decisionSummary');

const goldenDir = path.resolve(__dirname, 'golden');
const fixtureFiles = fs.readdirSync(goldenDir).filter((file) => file.endsWith('.json')).sort();

describe('Golden Test Set (Spec 8.4): Hand-Checked Decision Room Fixtures', () => {
  it('contains at least 20 hand-checked golden fixtures', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(20);
  });

  for (const file of fixtureFiles) {
    const fixturePath = path.join(goldenDir, file);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    it(`evaluates golden room ${fixture.id}: "${fixture.title}" accurately`, () => {
      // Build normalized room object matching store output
      const voteTotals = {};
      for (const item of fixture.items) {
        voteTotals[item.id] = { Love: 0, Like: 0, No: 0, 'Need more info': 0 };
        const prodVotes = fixture.votes[item.id] || {};
        for (const vote of Object.values(prodVotes)) {
          if (voteTotals[item.id][vote] !== undefined) {
            voteTotals[item.id][vote]++;
          }
        }
      }

      const room = {
        id: fixture.id,
        title: fixture.title,
        products: fixture.items,
        votes: fixture.votes || {},
        voteTotals,
        comments: fixture.comments || {},
      };

      const summary = computeDecisionSummary(room);

      // 1. Assert status
      expect(summary.status).toBe(fixture.expected.status);

      // 2. Assert winner if expected
      if (fixture.expected.winnerId) {
        expect(summary.winner).toBeDefined();
        expect(summary.winner.product.id).toBe(fixture.expected.winnerId);
      }

      // 3. Assert tied products if expected
      if (fixture.expected.tiedProductIds) {
        expect(summary.tiedWinners).toBeDefined();
        const tiedIds = summary.tiedWinners.map((t) => t.product.id).sort();
        expect(tiedIds).toEqual(fixture.expected.tiedProductIds.slice().sort());
      }

      // 4. Assert tie-break reason if specified
      if (fixture.expected.tieBreakReason) {
        expect(summary.tieBreakReason).toBeDefined();
        expect(summary.tieBreakReason.toLowerCase()).toContain(fixture.expected.tieBreakReason.toLowerCase());
      }

      // 5. Assert feedback categorization if specified
      if (fixture.expected.feedbackCategory === 'highlights') {
        const prodId = fixture.items[0].id;
        expect(summary.feedback[prodId]?.highlights?.length).toBeGreaterThan(0);
      } else if (fixture.expected.feedbackCategory === 'concerns') {
        const prodId = fixture.items[0].id;
        expect(summary.feedback[prodId]?.concerns?.length).toBeGreaterThan(0);
      } else if (fixture.expected.feedbackCategory === 'questions') {
        const prodId = fixture.items[0].id;
        expect(summary.feedback[prodId]?.questions?.length).toBeGreaterThan(0);
      }
    });
  }
});
