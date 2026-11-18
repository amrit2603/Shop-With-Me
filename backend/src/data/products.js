/**
 * Demo product catalog for Shop With Me.
 * Contains products across Furniture, Electronics, Clothing, and Accessories.
 * Prices are in INR.
 */

const products = [
  {
    id: 'prod-beauty-arkive',
    name: 'ARKIVE Future Youth Haircare Duo',
    category: 'Beauty',
    price: 48,
    description: 'Nourishing treatment mask and hybrid hair oil for glossy, healthy strands',
    imageUrl: '/products/arkive-haircare-duo.jpg',
  },
  {
    id: 'prod-beauty-brings',
    name: 'Brings MI Radiance Glow Serum',
    category: 'Beauty',
    price: 34,
    description: '70% concentrated hydrating essence with peony extract for glass skin radiance',
    imageUrl: '/products/brings-radiance-serum.jpg',
  },
  {
    id: 'prod-audio-boat',
    name: 'boAt Stone Rugged Bluetooth Speaker',
    category: 'Audio',
    price: 59,
    description: 'Deep bass cylinder speaker with RGB ambient light ring and IPX7 water resistance',
    imageUrl: '/products/boat-stone-speaker.jpg',
  },
  {
    id: 'prod-beauty-laneige',
    name: 'LANEIGE Water Sleeping Mask EX',
    category: 'Beauty',
    price: 32,
    description: 'Overnight hydrating sleeping pack formulated with Sleeping Microbiome™ for supple, refreshed skin',
    imageUrl: '/products/laneige-sleeping-mask.jpg',
  },
  {
    id: 'prod-fragrance-bella-vita',
    name: 'Bella Vita Luxury Eau De Parfum',
    category: 'Fragrance',
    price: 42,
    description: 'Sophisticated woody and oriental unisex fragrance in a minimalist matte flacon',
    imageUrl: '/products/bella-vita-perfume.jpg',
  },
  {
    id: 'prod-demo-audio-01',
    name: 'QuietForm Studio Headphones',
    category: 'Audio',
    price: 289,
    description: 'Adaptive noise control with 32-hour battery',
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-demo-home-01',
    name: 'Aster Arc Floor Lamp',
    category: 'Home',
    price: 164,
    description: 'Warm dimmable light with a compact steel base',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-demo-travel-01',
    name: 'Cove Carry-On',
    category: 'Travel',
    price: 248,
    description: 'Hard shell, front pocket, and silent spinner wheels',
    imageUrl: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-demo-home-02',
    name: 'Morrow Cloud Chair',
    category: 'Home',
    price: 420,
    description: 'Deep foam seat in textured woven fabric',
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-demo-tech-01',
    name: 'Field Notes Camera',
    category: 'Tech',
    price: 699,
    description: '24 MP sensor and tactile manual dials',
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-demo-style-01',
    name: 'Common Ground Sneakers',
    category: 'Style',
    price: 138,
    description: 'Cushioned everyday sole in soft leather',
    imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-fur-01',
    name: 'Ergonomic High-Back Office Chair',
    category: 'Furniture',
    price: 8999,
    description: 'Breathable mesh back with adjustable lumbar support, 3D armrests, and smooth-rolling casters.',
    imageUrl: 'https://images.unsplash.com/photo-1580481077144-84d4b14d59f7?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-fur-02',
    name: 'Solid Sheesham Wood Coffee Table',
    category: 'Furniture',
    price: 6499,
    description: 'Handcrafted natural teak finish coffee table with lower open storage shelf for living rooms.',
    imageUrl: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-fur-03',
    name: '5-Tier Modular Bookshelf',
    category: 'Furniture',
    price: 4299,
    description: 'Industrial open display shelving unit with matte black metal frame and rustic wood grain shelves.',
    imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-elec-01',
    name: 'Active Noise-Cancelling Wireless Headphones',
    category: 'Electronics',
    price: 12499,
    description: 'Over-ear headphones with 40-hour battery life, transparency mode, and ultra-plush memory foam.',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-elec-02',
    name: '27-inch 4K UHD IPS Designer Monitor',
    category: 'Electronics',
    price: 24999,
    description: 'Color-accurate 99% sRGB display with 65W USB-C power delivery, HDR10, and ultra-thin bezels.',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-elec-03',
    name: 'Hot-Swappable Mechanical Wireless Keyboard',
    category: 'Electronics',
    price: 5499,
    description: 'Compact 75% layout with pre-lubed tactile brown switches, RGB per-key backlighting, and dual-mode Bluetooth.',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-elec-04',
    name: 'Waterproof 360° Portable Bluetooth Speaker',
    category: 'Electronics',
    price: 3299,
    description: 'IP67 dust and waterproof outdoor speaker with deep bass, 16-hour playtime, and party pairing mode.',
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-cloth-01',
    name: 'Pure Breathable Linen Button-Down Shirt',
    category: 'Clothing',
    price: 1899,
    description: 'Premium lightweight woven European linen shirt in natural sky blue, tailored for casual or formal wear.',
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-cloth-02',
    name: 'All-Weather Insulated Hooded Parka',
    category: 'Clothing',
    price: 4499,
    description: 'Windproof, water-resistant winter parka with thermal micro-fleece lining and storm flap protection.',
    imageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-cloth-03',
    name: 'Relaxed Fit Stretch Cotton Chinos',
    category: 'Clothing',
    price: 2199,
    description: 'Versatile beige chinos tailored with 98% organic cotton and 2% elastane for day-long comfort.',
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-acc-01',
    name: 'Full-Grain Vintage Leather Messenger Bag',
    category: 'Accessories',
    price: 3799,
    description: 'Handcrafted distressed brown leather satchel with padded 15-inch laptop compartment and brass hardware.',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-acc-02',
    name: 'Minimalist Sapphire Chronograph Watch',
    category: 'Accessories',
    price: 6999,
    description: 'Japanese quartz movement with scratch-resistant sapphire crystal and interchangeable mesh band.',
    imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-acc-03',
    name: 'Polarized Matte Titanium Sunglasses',
    category: 'Accessories',
    price: 1699,
    description: 'UV400 anti-glare polarized lenses with ultra-lightweight flexible titanium frame and travel case.',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80',
  },
];

// The demo catalog has no merchant inventory feed, so stable synthetic SKUs are used.
// These identifiers are for the prototype only and do not claim real merchant SKUs.
for (const product of products) {
  product.sku = product.sku || `VY-DEMO-${product.id.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
  product.brand = product.brand || 'Demo';
  product.currency = product.currency || 'INR';
  product.images = product.images || (product.imageUrl ? [product.imageUrl] : []);
  product.bullets = product.bullets || (product.description ? [product.description] : []);
}

/**
 * Get all products in the catalog.
 * @returns {Array<object>}
 */
function getCatalog() {
  return products;
}

/**
 * Find a catalog product by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
function getCatalogProductById(id) {
  return products.find((p) => p.id === id);
}

/**
 * Find a custom product by ID from the database.
 * @param {string} id
 * @returns {object|undefined}
 */
function getCustomProductById(id) {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const row = db.prepare(
      'SELECT id, name, category, price, description, image_url AS imageUrl, source, source_url AS sourceUrl FROM custom_products WHERE id = ?'
    ).get(id);
    if (!row) return undefined;
    return {
      ...row,
      sku: `VY-CUSTOM-${row.id.replace(/[^a-z0-9]/gi, '').toUpperCase()}`,
      brand: 'Custom',
      currency: 'INR',
      images: row.imageUrl ? [row.imageUrl] : [],
      bullets: row.description ? [row.description] : [],
    };
  } catch {
    return undefined;
  }
}

/**
 * Save a custom product to the database.
 * @param {object} product - { id, name, category, price, description, imageUrl, source, sourceUrl }
 * @returns {object} saved product
 */
function saveCustomProduct(product) {
  const { getDb } = require('../db/database');
  const db = getDb();
  const { v4: uuidv4 } = require('uuid');

  const id = product.id || `custom-${uuidv4()}`;
  const name = (product.name || 'Unnamed Product').trim();
  const category = (product.category || 'Custom').trim();
  const price = typeof product.price === 'number' ? product.price : null;
  const description = (product.description || '').trim();
  const imageUrl = (product.imageUrl || '').trim();
  const source = (product.source || 'manual').trim();
  const sourceUrl = (product.sourceUrl || '').trim();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO custom_products (id, name, category, price, description, image_url, source, source_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      description = excluded.description,
      image_url = excluded.image_url,
      source = excluded.source,
      source_url = excluded.source_url
  `).run(id, name, category, price, description, imageUrl, source, sourceUrl, createdAt);

  return {
    id,
    name,
    category,
    price,
    description,
    imageUrl,
    source,
    sourceUrl,
    sku: `VY-CUSTOM-${id.replace(/[^a-z0-9]/gi, '').toUpperCase()}`,
    brand: 'Custom',
    currency: 'INR',
    images: imageUrl ? [imageUrl] : [],
    bullets: description ? [description] : [],
  };
}

/**
 * Find a product by ID — checks catalog first, then custom products.
 * @param {string} id
 * @returns {object|undefined}
 */
function getProductById(id) {
  const catalogProduct = getCatalogProductById(id);
  if (catalogProduct) return catalogProduct;
  return getCustomProductById(id);
}

module.exports = {
  products,
  getCatalog,
  getProductById,
  getCatalogProductById,
  getCustomProductById,
  saveCustomProduct,
};

