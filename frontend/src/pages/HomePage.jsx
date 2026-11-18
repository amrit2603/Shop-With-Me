import { RectangleButtons } from "../components/RectangleButtons";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import CreateRoomFlow from "../components/home/CreateRoomFlow";
import RoomReadyCard from "../components/home/RoomReadyCard";
import {
  getProducts,
  createRoom,
  addProductToRoom,
  addCustomProduct,
  uploadProductScreenshot,
} from "../services/api";
import "./HomePage.css";
import { useAuth } from "../services/auth";
import DemoEntry from "../components/DemoEntry";

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  useEffect(()=>{if(user && location.state?.invite)navigate(location.state.invite,{replace:true});},[user,location.state,navigate]);

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [shortlist, setShortlist] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [createdRoom, setCreatedRoom] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadCatalog() {
      try {
        const data = await getProducts();
        if (!ignore) setCatalog(data.products || []);
      } catch (err) {
        console.error("Failed to load demo catalog:", err);
      } finally {
        if (!ignore) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      ignore = true;
    };
  }, []);

  const handleJoinCode = (rawInput) => {
    setJoinError("");
    let code = rawInput.trim();
    if (code.includes("/room/")) {
      code = code.split("/room/")[1].split("/")[0].split("?")[0];
    }
    if (!code) {
      setJoinError("Please enter a valid room code or link.");
      return;
    }
    if (user) navigate(`/room/${code}`);
    else navigate("/", { replace: true, state: { invite: `/room/${code}`, invitation: rawInput.trim() } });
  };

  const handleToggleCatalog = (product) => {
    setShortlist((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 8) return prev;
      return [...prev, product];
    });
  };

  const handleAddCustomProduct = (customProduct) => {
    setShortlist((prev) => {
      if (prev.length >= 8) return prev;
      return [...prev, customProduct];
    });
  };

  const handleCreateRoom = async (title, expiresInHours) => {
    setFormError("");
    if (!user) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (shortlist.length < 2) {
      setFormError("Please select at least 2 products to create a room.");
      return;
    }

    setCreating(true);
    try {
      const finalTitle = title.trim();
      const data = await createRoom(finalTitle, expiresInHours);
      const newRoomId = data.room.id;

      if (data.creatorToken) {
        try {
          sessionStorage.setItem(`creator_token_${newRoomId}`, data.creatorToken);
        } catch {}
      }
      if (data.creatorId) {
        try {
          sessionStorage.setItem(`creator_id_${newRoomId}`, data.creatorId);
        } catch {}
      }

      for (const item of shortlist) {
        if (item.isCustom) {
          let imageUrl = item.imageUrl;
          if (item.source === "screenshot" && imageUrl?.startsWith("data:")) {
            const uploaded = await uploadProductScreenshot(newRoomId, imageUrl);
            imageUrl = uploaded.product.imageUrl;
          }
          await addCustomProduct(newRoomId, {
            name: item.name,
            category: item.category,
            price: item.price,
            description: item.description,
            imageUrl,
            source: item.source || "manual",
            sourceUrl: item.sourceUrl || "",
          });
        } else {
          await addProductToRoom(newRoomId, item.id);
        }
      }

      const shortCode =
        data.roomCode || data.room?.code || newRoomId.slice(0, 6).toUpperCase();
      const shareUrl = `${window.location.origin}/room/${newRoomId}`;
      setCreatedRoom({
        id: newRoomId,
        code: shortCode,
        shareUrl,
        title: data.room?.title || finalTitle,
      });

      setTimeout(() => {
        const el = document.getElementById("room-ready-card");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setFormError(err.message || "Failed to create room. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="vyumi-home">
      <Navbar compact />
      <main className="home-main">
        {!user ? (
          <DemoEntry invitation={location.state?.invitation || location.state?.invite || ""} invited={Boolean(location.state?.invite?.startsWith("/room/"))} onJoinCode={handleJoinCode} joinError={joinError} />
        ) : (
          !createdRoom && (
            <header className="simple-home-heading">
              <div>
                <h1>Choose together.</h1>
                <p>Pick your products, then invite your friends.</p>
              </div>
              <details className="simple-home-join">
                <summary>Join with a code</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinCode(new FormData(e.currentTarget).get("code"));
                  }}
                >
                  <label>
                    Room code or link
                    <input name="code" required />
                  </label>
                  <RectangleButtons>Join room</RectangleButtons>
                  {joinError && <p role="alert">{joinError}</p>}
                </form>
              </details>
            </header>
          )
        )}
        {user &&
          (createdRoom ? (
            <RoomReadyCard
              room={createdRoom}
              onEnterRoom={() => navigate(`/room/${createdRoom.id}`)}
            />
          ) : (
            <CreateRoomFlow
                catalog={catalog}
              catalogLoading={catalogLoading}
              shortlist={shortlist}
              onToggleCatalog={handleToggleCatalog}
              onAddCustomProduct={handleAddCustomProduct}
              onCreateRoom={handleCreateRoom}
              creating={creating}
              error={formError}
              submitLabel="Create room & get link"
            />
          ))}
      </main>
    </div>
  );
}
