import React from "react";
import { SmartImg } from "../SmartImg.jsx";
import { getItemFotos } from "../../utils/nomeCorrecao.js";

export function CorrecaoItemPhoto({ foundMap, itemId, onViewImage, size = 72 }) {
  const urls = getItemFotos(itemId, foundMap);
  const src = urls[0];
  if (!src) {
    return (
      <div className="correcao-photo correcao-photo--empty" style={{ width: size, height: size }}>
        Sem foto
      </div>
    );
  }
  return (
    <button
      type="button"
      className="correcao-photo"
      onClick={() => onViewImage?.(src)}
      title="Ampliar foto"
      style={{ width: size, height: size }}
    >
      <SmartImg
        src={src}
        alt=""
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 8 }}
      />
    </button>
  );
}
