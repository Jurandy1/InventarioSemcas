import React from "react";

export function ToastNotification({ message, isMobile }) {
  if (!message) return null;
  return (
    <div className={`gov-toast${isMobile ? " gov-toast--mobile" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
