const crypto = require('node:crypto');
const express = require('express');
const { getCatalog } = require('../data/products');

const router = express.Router();

let catalogEtag = null;
function getCatalogEtag(products) {
  if (!catalogEtag) {
    catalogEtag = `W/"${crypto.createHash('md5').update(JSON.stringify(products)).digest('hex')}"`;
  }
  return catalogEtag;
}

/**
 * GET /api/products
 * Returns the demo product catalog with ETag caching.
 */
router.get('/', (req, res) => {
  const products = getCatalog();
  const etag = getCatalogEtag(products);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  return res.status(200).json({ products });
});

module.exports = router;
