import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductActions from '../components/ProductActions';
import { readSavedProducts, downloadBlob } from '../utils/savedProducts';

export default function SavedPage() {
  const [items, setItems] = useState(readSavedProducts);
  useEffect(() => {
    const update = () => setItems(readSavedProducts());
    window.addEventListener('vyumi:saved', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('vyumi:saved', update); window.removeEventListener('storage', update); };
  }, []);
  return <><Navbar /><main className="saved-page">
    <Link to="/">← Shop With Me</Link><h1>Good finds, kept for you.</h1>
    <p>Your private list in this tab. Saving does not change the shared shortlist or votes. Export a copy before logging out or closing the tab.</p>
    {items.length ? <button className="btn-primary" type="button" onClick={() => downloadBlob(new Blob([JSON.stringify(items, null, 2)], { type:'application/json' }), 'vyumi-saved-products.json')}>Export saved items ↓</button> : <p>No saved products yet. Open a room and choose “Save for me”.</p>}
    <div className="saved-grid">{items.map((product) => <article className="saved-card" key={product.id}>
      {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" />}
      <h2>{product.name}</h2><p>{product.price == null ? 'Price unknown' : `₹${product.price}`}</p><ProductActions product={product} />
    </article>)}</div>
  </main></>;
}
