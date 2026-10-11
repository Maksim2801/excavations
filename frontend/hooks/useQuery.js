import { useCallback, useEffect, useRef, useState } from "../modules/html.js";

export function useQuery(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader();
      if (request === sequence.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (request === sequence.current) setState((current) => ({ data: error.status === 0 ? current.data : null, error, loading: false }));
    }
  }, deps);
  useEffect(() => {
    reload();
    window.addEventListener("online", reload);
    return () => { sequence.current++; window.removeEventListener("online", reload); };
  }, [reload]);
  return { ...state, reload };
}
