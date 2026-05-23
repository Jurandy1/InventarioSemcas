import React, { useState } from "react";

export function TInput({ initial, onVal, ...p }) {
  const [v, setV] = useState(initial || "");
  return <input {...p} value={v} onChange={(e) => { setV(e.target.value); onVal(e.target.value); }} />;
}

export function TArea({ initial, onVal, ...p }) {
  const [v, setV] = useState(initial || "");
  return <textarea {...p} value={v} onChange={(e) => { setV(e.target.value); onVal(e.target.value); }} />;
}

