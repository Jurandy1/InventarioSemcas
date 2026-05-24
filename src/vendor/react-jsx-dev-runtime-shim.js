import React from "./react-shim.js";

export const Fragment = React.Fragment;

function withKey(props, key) {
  if (key === undefined) return props || {};
  return { ...(props || {}), key };
}

export function jsxDEV(type, props, key) {
  return React.createElement(type, withKey(props, key));
}
