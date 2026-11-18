import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import SavedPage from './pages/SavedPage';
import './CompactShop.css';
import './World.css';
function RoomEntry({children}) {
  const {user,loading}=useAuth();
  const location=useLocation();
  if(loading)return <p role="status">Loading session…</p>;
  return user ? (children||<RoomPage />) : <Navigate to="/" replace state={{invite:location.pathname}} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Routes>
        <Route path="/signin" element={<Navigate to="/" replace />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/saved" element={<RoomEntry><SavedPage /></RoomEntry>} />
        <Route path="/room/:roomId" element={<RoomEntry />} />
        <Route path="/room/:roomId/product/:productId" element={<RoomEntry />} />
      </Routes></AuthProvider>
    </BrowserRouter>
  );
}
