// oxlint-disable react/only-export-components -- Auth context and its provider are consumed together.
import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "./api";
import { tabFetch, USER_KEY, TOKEN_KEY } from "./tabSession";
const AuthContext = createContext({ user: null, loading: true });
export async function authRequest(action, body) {
  const response = await tabFetch(`${API_BASE}/api/auth/${action}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || data.error || "Please try again.");
  if (data.sessionToken) sessionStorage.setItem(TOKEN_KEY, data.sessionToken);
  return data;
}
export function AuthProvider({ children }) {
  const [user, updateUser] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(sessionStorage.getItem(TOKEN_KEY)),
  );
  const setUser = (next) => {
    if (next) sessionStorage.setItem(USER_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(USER_KEY);
    updateUser(next);
  };
  useEffect(() => {
    const tabKey = "vyumi_tab_id";
    if (!sessionStorage.getItem(tabKey))
      sessionStorage.setItem(tabKey, crypto.randomUUID());
    const documentId = crypto.randomUUID(),
      token = sessionStorage.getItem(TOKEN_KEY);
    let active = true,
      duplicate = false,
      ready = !token,
      timer;
    const channel =
      typeof BroadcastChannel === "function"
        ? new BroadcastChannel("vyumi-tab-ownership")
        : null;
    const load = () => {
      ready = true;
      if (!token) return;
      authRequest("me")
        .then((d) => {
          if (active && !duplicate) {
            setUser(d.user);
            if (!d.user) sessionStorage.removeItem(TOKEN_KEY);
          }
        })
        .catch(() => {
          if (active && !duplicate) setUser(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    if (channel) {
      channel.onmessage = ({ data }) => {
        if (data?.tabId !== sessionStorage.getItem(tabKey)) return;
        if (data.type === "claim" && ready && data.documentId !== documentId)
          channel.postMessage({
            type: "occupied",
            tabId: data.tabId,
            forDocument: data.documentId,
          });
        if (data.type === "occupied" && data.forDocument === documentId) {
          duplicate = true;
          clearTimeout(timer);
          sessionStorage.clear();
          sessionStorage.setItem(tabKey, crypto.randomUUID());
          ready = true;
          setUser(null);
          setLoading(false);
        }
      };
      if (token) {
        channel.postMessage({
          type: "claim",
          tabId: sessionStorage.getItem(tabKey),
          documentId,
        });
        timer = setTimeout(load, 150);
      }
    } else if (token && window.opener) {
      sessionStorage.clear();
      queueMicrotask(() => {
        if (active) setLoading(false);
      });
    } else load();
    return () => {
      active = false;
      clearTimeout(timer);
      channel?.close();
    };
  }, []);

  const signOut = async () => {
    try {
      await authRequest("logout", {});
    } catch {
      /* Local logout also works offline. */
    } finally {
      sessionStorage.clear();
      window.location.replace("/");
    }
  };
  return (
    <AuthContext.Provider value={{ user, setUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
