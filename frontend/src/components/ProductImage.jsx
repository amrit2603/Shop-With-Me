import { apiUrl } from '../services/api';
import { useState } from 'react';
import './ProductImage.css';

const CATEGORY_ICONS = {
  Furniture: '🪑',
  Electronics: '💻',
  Clothing: '👕',
  Accessories: '🎒',
};

export default function ProductImage({ src, alt, category, className = '' }) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`product-fallback-image ${className}`} aria-label={alt}>
        <span className="product-fallback-icon">{CATEGORY_ICONS[category] || '🛍️'}</span>
        <span className="product-fallback-category">{category || 'Product'}</span>
      </div>
    );
  }

  return (
    <img
      src={apiUrl(src)}
      alt={alt}
      loading="lazy"
      className={`product-real-image ${className}`}
      onError={() => setError(true)}
    />
  );
}
