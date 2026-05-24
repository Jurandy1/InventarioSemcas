import "../../node_modules/react/umd/react.development.js";

const React = globalThis.React;

if (!React) {
  throw new Error("React UMD global não foi carregado.");
}

export default React;
export const Fragment = React.Fragment;
export const StrictMode = React.StrictMode;
export const createElement = React.createElement;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useRef = React.useRef;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const createContext = React.createContext;
export const useLayoutEffect = React.useLayoutEffect;
export const memo = React.memo;
export const forwardRef = React.forwardRef;
