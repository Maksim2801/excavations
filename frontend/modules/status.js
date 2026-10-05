import { createContext, html, useCallback, useContext, useMemo, useState } from "./html.js";

const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [status, setStatusState] = useState({ text: "", kind: "" });
  const setStatus = useCallback((text, kind = "") => setStatusState({ text: text || "", kind }), []);
  const value = useMemo(() => ({ ...status, setStatus }), [status, setStatus]);
  return html`<${StatusContext.Provider} value=${value}>${children}<//>`;
}

export function useStatus() {
  const value = useContext(StatusContext);
  if (!value) throw new Error("Строка состояния не подключена");
  return value;
}
