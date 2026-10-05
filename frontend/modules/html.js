import htm from "/vendor/htm.module.js";

const React = globalThis.React;

if (!React || !globalThis.ReactDOM) {
  throw new Error("Не загружены React и ReactDOM");
}

export const html = htm.bind(React.createElement);
export const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
  useRef,
  createContext,
  Fragment,
} = React;
export default React;
