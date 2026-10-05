import { createContext, html, useCallback, useContext, useEffect, useMemo, useState } from "./html.js";
import { authApi, detectMode, getMode, setMode, setToken } from "../services/api.js";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState(getMode());

  useEffect(() => {
    let cancel = false;
    (async () => {
      const next = await detectMode();
      if (cancel) return;
      setModeState(next);
      try {
        if (localStorage.getItem("arch_token")) setUser(await authApi.me());
      } catch {
        setToken("");
        setUser(null);
      }
      if (!cancel) setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const applyAuth = useCallback((result) => {
    setToken(result.access_token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* локальный выход всё равно завершает сессию */ }
    setToken("");
    setUser(null);
  }, []);

  const changeMode = useCallback((next) => {
    setToken("");
    setUser(null);
    if (next === "auto") setMode("");
    else setMode(next);
    location.reload();
  }, []);

  const value = useMemo(
    () => ({ user, setUser, ready, mode, applyAuth, logout, changeMode }),
    [user, ready, mode, applyAuth, logout, changeMode],
  );

  return html`<${SessionContext.Provider} value=${value}>${children}<//>`;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Сессия не подключена");
  return value;
}
