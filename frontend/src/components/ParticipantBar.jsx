import { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { getParticipantColor, getInitials, containsProfanity } from '../utils/identity';
import './ParticipantBar.css';

export default function ParticipantBar({
  participant,
  rememberedParticipant = null,
  participantsCount = 1,
  onJoin,
  onContinue,
  onUpdateName,
  loading = false,
}) {
  const [joinName, setJoinName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [formError, setFormError] = useState('');
  const [switchingUser, setSwitchingUser] = useState(false);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = joinName.trim();
    if (!trimmed) {
      setFormError('Please enter a display name to join.');
      return;
    }
    if (trimmed.length < 2) {
      setFormError('Display name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 24) {
      setFormError('Name must be 24 characters or fewer.');
      return;
    }
    if (containsProfanity(trimmed)) {
      setFormError('Please choose a different display name.');
      return;
    }
    onJoin(trimmed);
  };

  const handleStartEdit = () => {
    setEditName(participant?.name || '');
    setFormError('');
    setIsEditing(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = editName.trim();
    if (!trimmed) {
      setFormError('Display name cannot be empty.');
      return;
    }
    if (trimmed.length < 2) {
      setFormError('Display name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 24) {
      setFormError('Name must be 24 characters or fewer.');
      return;
    }
    if (containsProfanity(trimmed)) {
      setFormError('Please choose a different display name.');
      return;
    }
    onUpdateName(trimmed);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormError('');
  };

  // State A: Guest has not joined yet
  if (!participant) {
    // If we remember an identity from this browser, offer 1-click continue
    if (rememberedParticipant?.name && !switchingUser) {
      return (
        <div className="participant-join-card join-remembered-card" role="region" aria-label="Join Room">
          <div className="join-card-header">
            <span
              className="join-remembered-avatar"
              style={{ backgroundColor: getParticipantColor(rememberedParticipant.id) }}
            >
              {getInitials(rememberedParticipant.name)}
            </span>
            <div>
              <h3 className="join-title">Welcome back</h3>
              <p className="join-subtitle">
                Continue as <strong className="join-name-highlight">{rememberedParticipant.name}</strong> or join as someone else.
              </p>
            </div>
          </div>

          <div className="join-remembered-actions">
            <button
              type="button"
              className="btn-join-room btn-continue-identity"
              onClick={() => (onContinue ? onContinue(rememberedParticipant) : onJoin(rememberedParticipant.name))}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size={14} /> Joining&hellip;
                </>
              ) : (
                `Continue as ${rememberedParticipant.name}`
              )}
            </button>
            <button
              type="button"
              className="btn-switch-identity"
              onClick={() => setSwitchingUser(true)}
              disabled={loading}
            >
              Join as someone else
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="participant-join-card" role="region" aria-label="Join Room">
        <div className="join-card-header">
          <span className="join-icon">👋</span>
          <div>
            <h3 className="join-title">Join this Shopping Room</h3>
            <p className="join-subtitle">
              Enter a display name to vote on products and join the discussion. No account needed!
            </p>
          </div>
        </div>

        <form onSubmit={handleJoinSubmit} className="join-form">
          <div className="join-input-group">
            <div className="join-input-wrapper">
              <input
                type="text"
                className={`join-name-input ${formError ? 'input--error' : ''}`}
                placeholder="Enter your name or nickname..."
                value={joinName}
                maxLength={24}
                onChange={(e) => {
                  setJoinName(e.target.value);
                  if (formError) setFormError('');
                }}
                aria-label="Your display name"
                disabled={loading}
                autoFocus
              />
              <span className="join-char-counter">{joinName.trim().length}/24</span>
            </div>
            <button
              type="submit"
              className="btn-join-room"
              disabled={loading || !joinName.trim()}
            >
              {loading ? (
                <>
                  <LoadingSpinner size={14} /> Joining&hellip;
                </>
              ) : (
                'Join Room'
              )}
            </button>
          </div>
          {formError && <p className="join-error-msg">{formError}</p>}
          {rememberedParticipant?.name && switchingUser && (
            <button
              type="button"
              className="btn-switch-back"
              onClick={() => setSwitchingUser(false)}
            >
              ← Back to &ldquo;Continue as {rememberedParticipant.name}&rdquo;
            </button>
          )}
        </form>
      </div>
    );
  }

  // State B: Guest has joined
  return (
    <div className="participant-active-bar" role="status" aria-label="Participant identity">
      <div className="active-user-info">
        <span
          className="user-avatar-badge"
          style={{ backgroundColor: getParticipantColor(participant.id) }}
        >
          {getInitials(participant.name)}
        </span>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="inline-edit-form">
            <input
              type="text"
              className="edit-name-input"
              value={editName}
              maxLength={24}
              onChange={(e) => setEditName(e.target.value)}
              aria-label="Edit your display name"
              autoFocus
            />
            <button type="submit" className="btn-edit-save" disabled={loading || !editName.trim()}>
              Save
            </button>
            <button
              type="button"
              className="btn-edit-cancel"
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="user-display-row">
            <span className="user-greeting">
              Joined as <strong className="user-name-highlight">{participant.name}</strong>
            </span>
            <button
              type="button"
              className="btn-edit-name"
              onClick={handleStartEdit}
              title="Edit your display name"
              aria-label="Edit display name"
            >
              ✎ Edit name
            </button>
          </div>
        )}
      </div>

      <div className="room-participants-badge">
        <span className="participants-icon">👥</span>
        <span>
          <strong>{participantsCount}</strong> {participantsCount === 1 ? 'person' : 'people'} in room
        </span>
      </div>

      {formError && <p className="edit-error-msg">{formError}</p>}
    </div>
  );
}
