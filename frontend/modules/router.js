import { createContext, html, useCallback, useContext, useEffect, useMemo, useState } from "./html.js";

const RouterContext = createContext(null);

export function Router({ children }) {
  const [url, setUrl] = useState(() => location.pathname + location.search);

  useEffect(() => {
    const onPop = () => setUrl(location.pathname + location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to) => {
    const next = to.startsWith("/") ? to : `/${to}`;
    if (next === location.pathname + location.search) {
      setUrl(next);
      return;
    }
    history.pushState({}, "", next);
    setUrl(next);
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => {
    const [path, query = ""] = url.split("?");
    return { url, path, search: new URLSearchParams(query), navigate };
  }, [url, navigate]);

  return html`<${RouterContext.Provider} value=${value}>${children}<//>`;
}

export function useRouter() {
  const value = useContext(RouterContext);
  if (!value) throw new Error("Маршрутизатор не подключён");
  return value;
}
