import { createContext, html, useCallback, useContext, useMemo, useState } from "./html.js";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [excavationId, setExcavationState] = useState(() => sessionStorage.getItem("excavationId") || "");
  const [layerId, setLayerState] = useState(() => sessionStorage.getItem("layerId") || "");

  const setExcavationId = useCallback((id) => {
    const value = id ? String(id) : "";
    sessionStorage.setItem("excavationId", value);
    setExcavationState(value);
    sessionStorage.removeItem("layerId");
    setLayerState("");
  }, []);

  const setLayerId = useCallback((id) => {
    const value = id ? String(id) : "";
    sessionStorage.setItem("layerId", value);
    setLayerState(value);
  }, []);

  const value = useMemo(
    () => ({ excavationId, layerId, setExcavationId, setLayerId }),
    [excavationId, layerId, setExcavationId, setLayerId],
  );

  return html`<${WorkspaceContext.Provider} value=${value}>${children}<//>`;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Рабочий контекст не подключён");
  return value;
}
