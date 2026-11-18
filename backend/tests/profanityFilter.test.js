import { describe, expect, it } from 'vitest';
const { containsProfanity, normalizeForFilter, rejectProfanity, maskProfanity } = require('../src/services/profanityFilter.js');

describe('local profanity filter', () => {
  it('finds plain, leetspeak, punctuation, and repeated-letter forms', () => {
    expect(containsProfanity('that is shit')).toBe(true);
    expect(containsProfanity('f.u.c.k this')).toBe(true);
    expect(containsProfanity('shiiiit')).toBe(true);
    expect(containsProfanity('b1tch')).toBe(true);
    expect(normalizeForFilter('f.u.c.k')).toContain('fuck');
  });

  it('keeps common false positives such as Scunthorpe and class', () => {
    expect(containsProfanity('Scunthorpe United')).toBe(false);
    expect(containsProfanity('class project')).toBe(false);
    expect(containsProfanity('delicious cocktail')).toBe(false);
    expect(containsProfanity('peanut butter')).toBe(false);
    expect(containsProfanity('executive assistant')).toBe(false);
    expect(rejectProfanity('I love this')).toBe(true);
  });

  it('masks profanities accurately without altering harmless text', () => {
    expect(maskProfanity('hello world')).toBe('hello world');
    expect(maskProfanity('that is shit')).toBe('that is ****');
    expect(maskProfanity('Scunthorpe class')).toBe('Scunthorpe class');
  });
});
