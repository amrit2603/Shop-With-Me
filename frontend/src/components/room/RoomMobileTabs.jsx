import './RoomMobileTabs.css';

export default function RoomMobileTabs({ activeTab, onChangeTab, unreadChatCount = 0 }) {
  return (
    <nav className="room-mobile-tabs" role="tablist" aria-label="Room views">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'products'}
        className={`mobile-tab-btn ${activeTab === 'products' ? 'mobile-tab-btn--active' : ''}`}
        onClick={() => onChangeTab('products')}
      >
        <span className="tab-icon">🛍️</span>
        <span>Products</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'chat'}
        className={`mobile-tab-btn ${activeTab === 'chat' ? 'mobile-tab-btn--active' : ''}`}
        onClick={() => onChangeTab('chat')}
      >
        <span className="tab-icon">💬</span>
        <span>Chat</span>
        {unreadChatCount > 0 && <span className="tab-unread-dot" aria-label={`${unreadChatCount} unread`}>{unreadChatCount}</span>}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'summary'}
        className={`mobile-tab-btn ${activeTab === 'summary' ? 'mobile-tab-btn--active' : ''}`}
        onClick={() => onChangeTab('summary')}
      >
        <span className="tab-icon">⚖️</span>
        <span>Summary</span>
      </button>
    </nav>
  );
}
