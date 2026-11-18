import { RectangleButtons } from "./RectangleButtons";
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getParticipantColor, getInitials, validateDisplayName } from '../utils/identity';
import './Navbar.css';
import {useAuth} from '../services/auth';

export default function Navbar({
  onHowItWorksClick,
  compact=false,
  currentParticipant = null,
  isCreator = false,
  leaderLabel = 'Host',
  participants = [],
  onlineParticipantIds = [],
  onRename,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const menuRef = useRef(null);

  const {user,signOut}=useAuth();
  const isDemo=user?.demo||user?.email?.endsWith("@demo.invalid");

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleStartRename = () => {
    setRenameInput(currentParticipant?.name || '');
    setRenameError('');
    setIsRenaming(true);
    setMenuOpen(false);
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    const err = validateDisplayName(renameInput);
    if (err) {
      setRenameError(err);
      return;
    }
    if (onRename) {
      setRenameLoading(true);
      try {
        await onRename(renameInput.trim());
        setIsRenaming(false);
      } catch (err) {
        setRenameError(err.message || 'Failed to update name');
      } finally {
        setRenameLoading(false);
      }
    } else {
      setIsRenaming(false);
    }
  };

  const onlineSet = new Set(Array.isArray(onlineParticipantIds) ? onlineParticipantIds : []);

  // Sort participants: current user first, then online, then rest
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === currentParticipant?.id) return -1;
    if (b.id === currentParticipant?.id) return 1;
    const aOnline = onlineSet.has(a.id) ? 1 : 0;
    const bOnline = onlineSet.has(b.id) ? 1 : 0;
    return bOnline - aOnline;
  });

  const maxVisibleAvatars = 5;
  const visibleParticipants = sortedParticipants.slice(0, maxVisibleAvatars);
  const overflowCount = Math.max(0, sortedParticipants.length - maxVisibleAvatars);
  const overflowNames = sortedParticipants
    .slice(maxVisibleAvatars)
    .map((p) => p.name)
    .join(', ');

  return (
    <header className="vyumi-navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <div className="brand-logo-circle">V</div>
          <span className="brand-logo-text">VYUMI</span>
        </Link>

        {(user || currentParticipant) && <nav className="navbar-links">
          <Link className="navbar-link-btn" to="/saved">My saved</Link>
          {!compact&&<RectangleButtons
            type="button"
            className="navbar-link-btn"
            onClick={onHowItWorksClick || (() => {
              const el = document.getElementById('how-it-works-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            })}
          >
            How it works
          </RectangleButtons>}
        </nav>}

        <div className="navbar-user-area">
          {/* Room View: Show participants strip */}
          {participants.length > 0 && (
            <div className="navbar-participants-strip" aria-label="Room participants">
              {visibleParticipants.map((p) => {
                const isYou = p.id === currentParticipant?.id;
                const isOnline = onlineSet.has(p.id) || isYou;
                const color = getParticipantColor(p.id);
                return (
                  <div
                    key={p.id}
                    className={`strip-avatar-wrap ${isYou ? 'strip-avatar-wrap--you' : ''}`}
                    title={`${p.name}${isYou ? ' (You)' : ''}${isOnline ? ' • Online' : ''}`}
                  >
                    <div className="strip-avatar" style={{ backgroundColor: color }}>
                      {getInitials(p.name)}
                    </div>
                    <span
                      className={`strip-online-dot ${isOnline ? 'strip-online-dot--active' : ''}`}
                      aria-hidden="true"
                    />
                  </div>
                );
              })}

              {overflowCount > 0 && (
                <div
                  className="strip-avatar-wrap strip-avatar-overflow"
                  title={`+${overflowCount} more: ${overflowNames}`}
                >
                  <div className="strip-avatar strip-avatar--more">
                    +{overflowCount}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Room View: Current participant chip with menu */}
          {currentParticipant ? (
            <div className="navbar-current-user-chip" ref={menuRef}>
              <RectangleButtons
                type="button"
                className="current-user-chip-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-label={`Current participant: ${currentParticipant.name}. Click to change name.`}
              >
                <div
                  className="user-chip-avatar"
                  style={{ backgroundColor: getParticipantColor(currentParticipant.id) }}
                >
                  {getInitials(currentParticipant.name)}
                </div>
                <span className="user-chip-name">{currentParticipant.name}</span>
                {isCreator && <span className="host-badge">{leaderLabel}</span>}
                <svg
                  className={`menu-chevron ${menuOpen ? 'menu-chevron--open' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </RectangleButtons>

              {menuOpen && (
                <div className="navbar-chip-dropdown" role="menu">
                  <div className="dropdown-identity-info">
                    <span className="dropdown-label">In this room as</span>
                    <strong className="dropdown-username">{currentParticipant.name}</strong>
                    {isCreator && <span className="dropdown-host-tag">{leaderLabel==='Leading'?'Showing products to the group':'Room Creator / Host'}</span>}
                  </div>
                  <div className="dropdown-divider" />
                  {user && <RectangleButtons type="button" className="dropdown-action-btn dropdown-leave-btn" role="menuitem" onClick={signOut}>{isDemo?"Leave demo":"Sign out"}</RectangleButtons>}
                  <RectangleButtons
                    type="button"
                    className="dropdown-action-btn"
                    role="menuitem"
                    onClick={handleStartRename}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Change name
                  </RectangleButtons>
                </div>
              )}
            </div>
          ) : user ? (
            <div className="navbar-saved-chip"><div className="user-chip-avatar" style={{backgroundColor:getParticipantColor(user.id)}}>{getInitials(user.displayName)}</div><span>{user.displayName}</span><RectangleButtons onClick={signOut}>{isDemo?"Leave demo":"Sign out"}</RectangleButtons></div>
          ) : <Link className="navbar-link-btn" to="/">Enter your name</Link>}
        </div>
      </div>

      {/* Rename Dialog Modal */}
      {isRenaming && (
        <div className="rename-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rename-title">
          <div className="rename-modal-card">
            <h3 id="rename-title" className="rename-modal-title">Change Display Name</h3>
            <p className="rename-modal-subtitle">
              Your name will update for everyone in the room.
            </p>

            <form onSubmit={handleSaveRename}>
              <div className="rename-field">
                <input
                  type="text"
                  className={`rename-input ${renameError ? 'input--error' : ''}`}
                  value={renameInput}
                  onChange={(e) => {
                    setRenameInput(e.target.value);
                    if (renameError) setRenameError('');
                  }}
                  minLength={2}
                  maxLength={24}
                  autoFocus
                  placeholder="Enter your name (2-24 chars)"
                />
                <span className="rename-counter">{renameInput.trim().length}/24</span>
              </div>

              {renameError && (
                <p className="rename-error-text" role="alert">{renameError}</p>
              )}

              <div className="rename-actions">
                <RectangleButtons
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsRenaming(false)}
                  disabled={renameLoading}
                >
                  Cancel
                </RectangleButtons>
                <RectangleButtons
                  type="submit"
                  className="btn-primary"
                  disabled={renameLoading || !renameInput.trim()}
                >
                  {renameLoading ? 'Saving...' : 'Save name'}
                </RectangleButtons>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
