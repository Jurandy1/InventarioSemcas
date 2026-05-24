import "./react-shim.js";
import "../../node_modules/react-dom/umd/react-dom.development.js";

const ReactDOM = globalThis.ReactDOM;

if (!ReactDOM?.createRoot) {
  throw new Error("ReactDOM.createRoot não foi carregado.");
}

export const createRoot = ReactDOM.createRoot.bind(ReactDOM);
export const hydrateRoot = ReactDOM.hydrateRoot
  ? ReactDOM.hydrateRoot.bind(ReactDOM)
  : undefined;
