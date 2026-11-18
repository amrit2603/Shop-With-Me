import '../party/PartyStage.css';
import { useState } from 'react';
import ShoppingHostPanel from '../party/ShoppingHostPanel';
import { API_BASE } from '../../services/api';
import { tabFetch } from '../../services/tabSession';
export default function RoomProductHelp({roomId,productId,participant}) {
  const [reply,setReply]=useState(null),[error,setError]=useState(''),[room,setRoom]=useState(null),[busy,setBusy]=useState(false);
  async function load() {
    try {
      const response=await tabFetch(`${API_BASE}/api/rooms/${roomId}`);
      const data=await response.json();
      if(!response.ok) throw new Error('Could not load product help. Try again.');
      setRoom(data.room);
      setError('');
    } catch(e) {setError(e.message);}
  }
  async function send(_,payload) {
    setBusy(true);setError('');
    try {
      const response=await tabFetch(`${API_BASE}/api/rooms/${roomId}/help`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...participant,participantId:participant.id,action:payload.action,productId,otherProductId:payload.b,query:payload.query})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error?.message||'Could not get product help.');
      setReply(data.reply);
    } catch(e){setError(e.message);} finally {setBusy(false);}
  }
  return <div className="room-product-help">{room?<ShoppingHostPanel room={room} currentProductId={productId} disabled={busy} send={send} hostNote={reply} onDismiss={()=>setReply(null)}/>:<button onClick={load}>Ask or compare products</button>}{error&&<p role="alert">{error}</p>}</div>;
}
