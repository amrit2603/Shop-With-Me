import { safeProductUrl,productLink } from '../../utils/savedProducts';
import ProductActions from '../ProductActions';
import ProductImage from '../ProductImage';
import ProductVoting from '../ProductVoting';
import RoomProductHelp from './RoomProductHelp';
import './RoomProductCard.css';
import { RectangleButtons } from '../RectangleButtons';

export default function RoomProductCard({
  product,
  totals,
  userVote,
  onVote,
  isJoined,
  onPromptJoin,
  voteLoading = false,
  participant,
  roomId,
  participants = [],
  votes = {},
  addedBy = 'Room creator',
  winner = false,
  idPrefix = 'product-card',
  compact = false,
  onSelect,
  selected = false,
}) {
  return (
    <article className={`room-product-card ${onSelect ? "room-product-card--tile" : ""} ${selected ? "is-selected" : ""} ${compact ? "room-product-card--compact" : ""}`} id={`${idPrefix}-${product.id}`} aria-labelledby={`${idPrefix}-title-${product.id}`}>
      {winner&&<strong className="product-winner">Winner</strong>}
      <div className="card-media-box">
        <ProductImage src={product.imageUrl} alt={product.name} category={product.category} />
      </div>

      <div className="card-header-box">
        <div className="card-title-price">
          <h2 id={`${idPrefix}-title-${product.id}`} className="card-product-name">{product.name}</h2>
          <span className="card-product-price">{product.price == null ? 'Price unknown' : `₹${product.price}`}</span>
        </div>
        {compact && <p className="compact-vote-count">{Object.values(votes).filter(Boolean).length} votes</p>}
      </div>
      {onSelect && <div className="tile-actions"><a className="tile-buy" href={safeProductUrl(product.sourceUrl||product.product_url)||productLink(roomId,product.id)} target="_blank" rel="noopener noreferrer">Buy / View product</a><RectangleButtons mode="dark" hue={0} saturation={1} brightness={1} aria-expanded={selected} aria-controls="selected-product-options" onClick={()=>onSelect(product.id)}> {selected ? 'Selected' : 'Select product'} </RectangleButtons></div>}
      {/* The 4 Vote Pills per Spec */}
      <div className="card-voting-box">
        <ProductVoting
          productId={product.id}
          totals={totals}
          userVote={userVote}
          onVote={onVote}
          isJoined={isJoined}
          onPromptJoin={onPromptJoin}
          loading={voteLoading}
        />
      </div>

      {!onSelect && <details className="card-expanded-details"><summary>Product details</summary><ProductDetails product={product} roomId={roomId} participants={participants} votes={votes} addedBy={addedBy} participant={participant} /></details>}

    </article>
  );
}

export function ProductDetails({product,roomId,participants=[],votes={},addedBy,participant}) {
 return <div className="card-details-content">{!product.bullets?.includes(product.description)&&<p>{product.description}</p>}<ul className="product-specs">{(product.bullets||[]).map((spec,i)=><li key={i}>{spec}</li>)}</ul><p>Store/source: {safeProductUrl(product.sourceUrl||product.product_url)?<a href={safeProductUrl(product.sourceUrl||product.product_url)} target="_blank" rel="noopener noreferrer">Store link</a>:'Merchant link not provided'}</p><p>Added by: {addedBy}</p><p>Voted by: {Object.entries(votes).filter(([,v])=>v).map(([id,v])=>`${participants.find(p=>p.id===id)?.name||'A participant'} (${v})`).join(', ')||'No votes yet'}</p><ProductActions compact product={product} roomId={roomId}/>{participant&&<RoomProductHelp key={product.id} roomId={roomId} productId={product.id} participant={participant}/>}</div>;
}
