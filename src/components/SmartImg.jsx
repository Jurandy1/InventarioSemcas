import React, { useEffect, useState } from "react";
import { getDisplayPhotoUrl } from "../services/storage.js";

export function SmartImg({ src, alt = "", style, ...rest }) {
  const [resolved, setResolved] = useState(src || "");
  useEffect(() => {
    let alive = true;
    setResolved(src || "");
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (!alive) return;
      setResolved(next || src || "");
    })();
    return () => {
      alive = false;
    };
  }, [src]);
  return <img src={resolved} alt={alt} style={style} loading="lazy" decoding="async" {...rest} />;
}
