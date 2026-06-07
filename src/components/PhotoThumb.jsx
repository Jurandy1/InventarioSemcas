import React from "react";
import { SmartImg } from "./SmartImg.jsx";

export function PhotoThumb({ src, badge, size = 56, style, imgStyle, onClick, onImageClick }) {
  if (!src) return null;
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }}
      onClick={onClick}
    >
      <SmartImg
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: "cover",
          display: "block",
          cursor: onImageClick ? "zoom-in" : "inherit",
          ...imgStyle,
        }}
        onClick={(e) => {
          if (onImageClick) {
            e.stopPropagation();
            onImageClick();
          }
        }}
      />
      {badge ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(146, 64, 14, 0.92)",
            color: "#fff",
            fontSize: size >= 56 ? 7 : 6,
            fontWeight: 800,
            textAlign: "center",
            padding: "2px 3px",
            borderRadius: "0 0 8px 8px",
            lineHeight: 1.15,
            pointerEvents: "none",
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}
