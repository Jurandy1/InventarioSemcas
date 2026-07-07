import { useEffect, useState } from "react";

const MQ = "(max-width: 767px)";

function readMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MQ).matches;
}

/** Detecção de viewport mobile via matchMedia (sem listener de resize). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(readMobile);

  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function isMobileViewport() {
  return readMobile();
}
