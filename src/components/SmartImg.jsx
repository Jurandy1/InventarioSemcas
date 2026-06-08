import React, { useEffect, useRef, useState } from "react";
import { getDisplayPhotoUrl } from "../services/storage.js";

export function SmartImg({ src, alt = "", style, ...rest }) {
  const ref = useRef(null);
  const [resolved, setResolved] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  useEffect(() => {
    if (!visible || !src) {
      setResolved("");
      return;
    }
    let alive = true;
    setResolved(src);
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (!alive) return;
      setResolved(next || src || "");
    })();
    return () => {
      alive = false;
    };
  }, [src, visible]);

  return (
    <img
      ref={ref}
      src={visible ? resolved || undefined : undefined}
      alt={alt}
      style={style}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}
