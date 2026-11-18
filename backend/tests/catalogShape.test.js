import { describe, expect, it } from 'vitest';
const { getCatalog } = require('../src/data/products.js');

describe('shared VYUMI product shape', () => {
  it('provides demo identity, currency, image array, and bullet fields for every catalog item', () => {
    const catalog = getCatalog();
    expect(catalog).toHaveLength(24);
    for (const product of catalog) {
      expect(product.sku).toMatch(/^VY-DEMO-/);
      expect(product.brand).toBeTruthy();
      expect(product.currency).toBe('INR');
      expect(Array.isArray(product.images)).toBe(true);
      expect(product.images[0]).toBe(product.imageUrl);
      expect(Array.isArray(product.bullets)).toBe(true);
    }
  });
});
