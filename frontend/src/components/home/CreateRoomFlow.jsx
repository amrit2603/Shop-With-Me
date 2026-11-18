import { RectangleButtons } from "../RectangleButtons";
import { useState, useRef } from "react";
import ProductImage from "../ProductImage";
import LoadingSpinner from "../LoadingSpinner";
import { extractProductFromUrl } from "../../services/api";
import { validateRoomTitle } from "../../utils/identity";
import "./CreateRoomFlow.css";

const MIN_PRODUCTS = 2;
const MAX_PRODUCTS = 8;

const QUICK_PICKS = [
  { label: "Outfit", starter: "Help me choose my wedding outfit" },
  { label: "Gift", starter: "Help me pick a birthday gift" },
  { label: "Gadget", starter: "Which phone should I get?" },
  { label: "Home", starter: "Living room decor shortlist" },
];

export default function CreateRoomFlow({
  catalog = [],
  catalogLoading = false,
  shortlist = [],
  onToggleCatalog,
  onAddCustomProduct,
  onCreateRoom,
  creating = false,
  error = "",
  submitLabel = "Create room & get link",
  options = null,
  initialTitle = "",
}) {
  const [draftTitle, setDraftTitle] = useState(null);
  const title = draftTitle ?? initialTitle ?? "";
  const setTitle = setDraftTitle;
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [urlProduct, setUrlProduct] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const filteredCatalog = catalog.filter((product) =>
    `${product.name} ${product.category}`
      .toLowerCase()
      .includes(catalogQuery.toLowerCase()),
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [selectedSource, setSelectedSource] = useState("catalog");
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [customError, setCustomError] = useState("");
  const [shotFile, setShotFile] = useState(null);
  const [shotName, setShotName] = useState("");
  const [shotPrice, setShotPrice] = useState("");

  const titleInputRef = useRef(null);

  const titleValidationError = validateRoomTitle(title);
  const isTitleValid = !titleValidationError;
  const showTitleError = (titleTouched || Boolean(error)) && !isTitleValid;

  const handleQuickPick = (starter) => {
    setTitle(starter);
    setTitleTouched(true);
    titleInputRef.current?.focus();
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (!titleTouched) setTitleTouched(true);
  };

  const handleCreateClick = () => {
    if (!isTitleValid) {
      setTitleTouched(true);
      titleInputRef.current?.focus();
      return;
    }
    onCreateRoom(title, expiresInHours);
  };

  const handleExtractUrl = async () => {
    setCustomError("");
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setCustomError("Please enter a product URL.");
      return;
    }
    setUrlLoading(true);
    try {
      const data = await extractProductFromUrl("preview", trimmed);
      if (!data.extracted)
        setCustomError(data.message || "Enter product details below.");
      setUrlProduct({
        ...data.product,
        name: data.product?.name || "",
        price: "",
      });
    } catch {
      setCustomError(
        "We could not read this page. Please enter details or pick from catalog.",
      );
    } finally {
      setUrlLoading(false);
    }
  };

  const handleUploadScreenshot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setCustomError("Image must be under 2 MB.");
      return;
    }
    setCustomError("");
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setCustomError("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setShotFile(event.target.result);
      setShotName(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    };
    reader.readAsDataURL(file);
  };

  const handleAddScreenshot = () => {
    if (!shotFile) {
      setCustomError("Please upload an image.");
      return;
    }
    if (!shotName.trim()) {
      setCustomError("Please enter a product name.");
      return;
    }
    if (
      shotPrice !== "" &&
      (!Number.isFinite(Number(shotPrice)) || Number(shotPrice) < 0)
    ) {
      setCustomError("Enter a valid price or leave it blank.");
      return;
    }
    onAddCustomProduct({
      id: `custom-shot-${Date.now()}`,
      name: shotName.trim(),
      category: "Custom",
      price: shotPrice === "" ? null : Number(shotPrice),
      description: "Uploaded product screenshot",
      imageUrl: shotFile,
      source: "screenshot",
      isCustom: true,
    });
    setShotFile(null);
    setShotName("");
    setShotPrice("");
    setSelectedSource("catalog");
  };

  return (
    <section
      className="create-flow"
      id="create-flow-section"
      aria-labelledby="create-title"
    >
      <div className="create-flow-header">
        <h2 id="create-title" className="create-heading">
          Your shortlist
        </h2>
      </div>

      {/* Decision Name Input with Quick Picks & Validation */}
      <div className="flow-step-box">
        <div className="step-label-row">
          <label htmlFor="room-title-input" className="step-label-title">
            Room name <span className="label-required">*</span>
          </label>
          <span className="title-char-counter" aria-live="polite">
            {title.trim().length}/60
          </span>
        </div>

        <div className="title-input-wrapper">
          <input
            ref={titleInputRef}
            id="room-title-input"
            type="text"
            className={`step-input-large ${showTitleError ? "input--error" : ""}`}
            placeholder="Help me choose my wedding outfit"
            value={title}
            maxLength={60}
            onChange={handleTitleChange}
            onBlur={() => setTitleTouched(true)}
            aria-invalid={showTitleError}
            aria-describedby={showTitleError ? "title-error-msg" : undefined}
          />
        </div>

        {/* Quick Pick Starter Chips */}
        <details
          className="quick-picks-container"
          aria-label="Suggested starter titles"
        >
          <summary>Suggested room names</summary>
          <div className="quick-pick-chips">
            {QUICK_PICKS.map((qp) => (
              <RectangleButtons
                key={qp.label}
                type="button"
                className="quick-pick-chip"
                onClick={() => handleQuickPick(qp.starter)}
              >
                {qp.label}
              </RectangleButtons>
            ))}
          </div>
        </details>

        {showTitleError && (
          <p id="title-error-msg" className="title-error-text" role="alert">
            {titleValidationError}
          </p>
        )}

        <p className="step-input-hint">
          Give your room a descriptive name so friends know what you're
          deciding. Add 2–8 products.
        </p>
      </div>

      {/* Choose a Source Selector */}
      <div className="source-selector-section">
        <div className="source-header-row">
          <div>
            <h3 className="section-subheading">Add products</h3>
          </div>
          <span className="shortlist-count-badge" aria-live="polite">
            {shortlist.length} / {MAX_PRODUCTS} selected
          </span>
        </div>

        <div className="source-cards-grid" role="tablist">
          <RectangleButtons
            type="button"
            className={`source-card ${selectedSource === "catalog" ? "source-card--active" : ""}`}
            onClick={() => setSelectedSource("catalog")}
          >
            <span className="source-icon">📦</span>
            <h4 className="source-title">Browse demo catalog</h4>
            <p className="source-desc">Reliable products, ready to add.</p>
          </RectangleButtons>

          <RectangleButtons
            type="button"
            className={`source-card ${selectedSource === "url" ? "source-card--active" : ""}`}
            onClick={() => setSelectedSource("url")}
          >
            <span className="source-icon">🔗</span>
            <h4 className="source-title">Paste a product URL</h4>
            <p className="source-desc">
              Review what we can find before adding.
            </p>
          </RectangleButtons>

          <RectangleButtons
            type="button"
            className={`source-card ${selectedSource === "screenshot" ? "source-card--active" : ""}`}
            onClick={() => setSelectedSource("screenshot")}
          >
            <span className="source-icon">🖼️</span>
            <h4 className="source-title">Upload a screenshot</h4>
            <p className="source-desc">Keep the image and fill in details.</p>
          </RectangleButtons>
        </div>
      </div>

      {/* Source Form: URL or Screenshot */}
      {selectedSource === "url" && (
        <div className="custom-source-panel">
          <h4 className="custom-panel-title">Add product from web page</h4>
          <div className="custom-input-row">
            <input
              type="url"
              className="hero-input step-input"
              placeholder="https://example.com/product"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <RectangleButtons
              type="button"
              className="btn-primary"
              onClick={handleExtractUrl}
              disabled={urlLoading}
            >
              {urlLoading ? "Checking..." : "Add to room"}
            </RectangleButtons>
          </div>
          {urlProduct && (
            <div className="shot-fields-grid">
              <label>
                Product name
                <input
                  className="hero-input"
                  value={urlProduct.name}
                  maxLength={200}
                  onChange={(e) =>
                    setUrlProduct({ ...urlProduct, name: e.target.value })
                  }
                />
              </label>
              <label>
                Price in INR (optional)
                <input
                  className="hero-input"
                  type="number"
                  min="0"
                  value={urlProduct.price}
                  onChange={(e) =>
                    setUrlProduct({ ...urlProduct, price: e.target.value })
                  }
                />
              </label>
              <RectangleButtons
                type="button"
                className="btn-primary"
                disabled={
                  !urlProduct.name.trim() ||
                  (urlProduct.price !== "" && Number(urlProduct.price) < 0)
                }
                onClick={() => {
                  onAddCustomProduct({
                    ...urlProduct,
                    id: `custom-url-${Date.now()}`,
                    price:
                      urlProduct.price === "" ? null : Number(urlProduct.price),
                    isCustom: true,
                  });
                  setUrlProduct(null);
                  setUrlInput("");
                  setSelectedSource("catalog");
                }}
              >
                Confirm product
              </RectangleButtons>
            </div>
          )}
          {customError && (
            <p className="custom-error" role="alert">
              {customError}
            </p>
          )}
        </div>
      )}

      {selectedSource === "screenshot" && (
        <div className="custom-source-panel">
          <h4 className="custom-panel-title">Upload product screenshot</h4>
          <input
            type="file"
            accept="image/*"
            onChange={handleUploadScreenshot}
            aria-label="Upload photo"
          />
          {shotFile && (
            <div className="shot-fields-grid">
              <input
                type="text"
                placeholder="Product name"
                value={shotName}
                onChange={(e) => setShotName(e.target.value)}
                className="hero-input"
              />
              <input
                type="number"
                placeholder="Price in INR (optional)"
                min="0"
                value={shotPrice}
                onChange={(e) => setShotPrice(e.target.value)}
                className="hero-input"
              />
              <RectangleButtons
                type="button"
                className="btn-primary"
                onClick={handleAddScreenshot}
              >
                Add to room
              </RectangleButtons>
            </div>
          )}
          {customError && (
            <p className="custom-error" role="alert">
              {customError}
            </p>
          )}
        </div>
      )}

      {/* Catalog Cards Grid */}
      <div className="catalog-section">
        <div className="catalog-header-row">
          <h3 className="section-subheading">Demo catalog</h3>
          <span className="catalog-badge">Reliable for every session</span>
        </div>

        <label className="catalog-search">
          Find a product
          <input
            className="hero-input"
            type="search"
            placeholder="Search clothing, gadgets, home…"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
          />
        </label>
        {catalogLoading ? (
          <div
            className="catalog-skeleton"
            role="status"
            aria-label="Loading products"
          >
            <LoadingSpinner size={24} />
            <p>Loading catalog&hellip;</p>
          </div>
        ) : (
          <div className="catalog-cards-grid">
            {filteredCatalog
              .slice(0, showAll || catalogQuery ? catalog.length : 3)
              .map((product) => {
                const isSelected = shortlist.some((p) => p.id === product.id);
                return (
                  <article
                    key={product.id}
                    className={`product-card ${isSelected ? "product-card--selected" : ""}`}
                  >
                    <div className="product-card-media">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        category={product.category}
                      />
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-name">{product.name}</h3>
                      <p className="product-card-meta">
                        {product.price == null
                          ? "Price unknown"
                          : `₹${product.price}`}{" "}
                        &bull; {product.category}
                      </p>
                      <p className="product-card-desc">
                        {product.description || "Quality curated item"}
                      </p>
                      <RectangleButtons
                        type="button"
                        className={`btn-card-action ${isSelected ? "btn-card-action--added" : ""}`}
                        onClick={() => onToggleCatalog(product)}
                        disabled={
                          !isSelected && shortlist.length >= MAX_PRODUCTS
                        }
                      >
                        {isSelected ? "✓ Added" : "+ Add to room"}
                      </RectangleButtons>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </div>

      {filteredCatalog.length > 3 && !catalogQuery && (
        <RectangleButtons
          type="button"
          className="btn-action-outline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show fewer products"
            : `Browse all ${catalog.length} products`}
        </RectangleButtons>
      )}
      {!catalogLoading && filteredCatalog.length === 0 && (
        <p role="status">
          No matching demo products. Try another search or add a screenshot.
        </p>
      )}
      <details className="create-room-options">
        <summary>Room options</summary>
        {options}{" "}
        <label className="deadline-select">
          Decide by
          <select
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value))}
          >
            <option value={1}>In 1 hour</option>
            <option value={6}>In 6 hours</option>
            <option value={24}>Tomorrow (24 hours)</option>
            <option value={72}>In 3 days</option>
            <option value={168}>In 7 days</option>
          </select>
        </label>
      </details>
      {/* Shortlist Bar & Submit Button */}
      <div className="shortlist-summary-bar">
        <div className="shortlist-title-box">

          <h3 className="shortlist-status-heading">
            {shortlist.length === 0
              ? "Nothing added yet"
              : `${shortlist.length} of ${MAX_PRODUCTS} products`}
          </h3>
          <p className="shortlist-hint">
            {!isTitleValid
              ? "Enter a valid room name above."
              : shortlist.length < MIN_PRODUCTS
                ? "Choose at least two products to create a shareable room."
                : "Ready to create room!"}
          </p>
        </div>

        <RectangleButtons
          type="button"
          className="btn-primary btn-create-inline"
          disabled={
            shortlist.length < MIN_PRODUCTS || !isTitleValid || creating
          }
          onClick={handleCreateClick}
          aria-disabled={
            shortlist.length < MIN_PRODUCTS || !isTitleValid || creating
          }
        >
          {creating ? (
            <>
              <LoadingSpinner size={16} /> Creating room&hellip;
            </>
          ) : (
            submitLabel
          )}
        </RectangleButtons>
      </div>

      {/* Shortlist Thumbnails List */}
      {shortlist.length > 0 && (
        <div className="shortlist-items-strip">
          {shortlist.map((item) => (
            <div key={item.id} className="shortlist-item-chip">
              <div className="chip-thumb">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.name}
                  category={item.category}
                />
                <RectangleButtons
                  type="button"
                  className="btn-remove-chip"
                  onClick={() => onToggleCatalog(item)}
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name}`}
                >
                  &times;
                </RectangleButtons>
              </div>
              <div className="chip-info">
                <h5 className="chip-name">{item.name}</h5>
                <span className="chip-price">
                  {item.price == null ? "Price unknown" : `₹${item.price}`}{" "}
                  &bull; {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="create-flow-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
