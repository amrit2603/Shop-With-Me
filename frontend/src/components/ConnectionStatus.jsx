import './ConnectionStatus.css';

export default function ConnectionStatus({ status = 'connected' }) {
  const statusConfig = {
    connected: { label: 'Live', className: 'status-indicator--live' },
    reconnecting: { label: 'Reconnecting...', className: 'status-indicator--reconnecting' },
    disconnected: { label: 'Offline', className: 'status-indicator--offline' },
  };

  const current = statusConfig[status] || statusConfig.connected;

  return (
    <div
      className={`connection-status-pill ${current.className}`}
      role="status"
      aria-live="polite"
      title={`Real-time sync: ${current.label}`}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{current.label}</span>
    </div>
  );
}
