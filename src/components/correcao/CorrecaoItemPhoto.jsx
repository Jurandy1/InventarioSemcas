import React from "react";
import { SmartImg } from "../SmartImg.jsx";
import { getItemFotos } from "../../utils/nomeCorrecao.js";

export function CorrecaoItemPhoto({ foundMap, itemId, onViewImage, onAddPhoto, size = 72 }) {
  const urls = getItemFotos(itemId, foundMap);
  const src = urls[0];
  if (!src) {
    if (onAddPhoto) {
      return (
        <button
          type="button"
          className="correcao-photo correcao-photo--empty correcao-photo--add"
          style={{ width: size, height: size, cursor: "pointer" }}
          onClick={onAddPhoto}
          title="Abrir o item para adicionar foto"
        >
          Sem foto
          <span style={{ display: "block", fontSize: 10, fontWeight: 700, marginTop: 2 }}>+ adicionar</span>
        </button>
      );
    }
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
