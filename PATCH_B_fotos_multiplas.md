# PATCH B — Várias fotos quebram / desaparecem

## Problema

No `onCameraCapture` em `App.jsx`:

```js
if (target === "manual") {
  revokeBlobUrls(formRef.current.manPhotos || []);  // <-- revoga tudo
  formRef.current.manPhotos = photoArray || [];     // <-- atribui o novo array
}
```

O `CameraModal` recebe `existingPhotos={formRef.current.manPhotos || []}` e devolve um array que **inclui as mesmas blob URLs anteriores mais as novas**. Como `revokeBlobUrls` é chamado antes da atribuição, mas as URLs revogadas são as MESMAS que estão no novo array, todas as fotos antigas viram blobs inválidos (aparecem quebradas ou somem).

Mesmo problema acontece com `stPhotos` e `detNewBase64`.

## Arquivo

`src/app/App.jsx`

## Mudanças

### 1. Criar helper que revoga só o que está saindo

**Localizar a função `revokeBlobUrls` existente:**

```js
  const revokeBlobUrls = (arr) => {
    for (const s of arr || []) {
      const v = String(s || "");
      if (v.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(v);
        } catch {}
      }
    }
  };
```

**Adicionar logo depois dela:**

```js
  // Revoga apenas as blob URLs que estavam no array antigo e NÃO estão no novo.
  // Evita o bug clássico de revogar fotos que continuam em uso (e ficam quebradas).
  const revokeRemovedBlobs = (oldArr, newArr) => {
    const keep = new Set((newArr || []).map((s) => String(s || "")));
    for (const s of oldArr || []) {
      const v = String(s || "");
      if (v.startsWith("blob:") && !keep.has(v)) {
        try {
          URL.revokeObjectURL(v);
        } catch {}
      }
    }
  };
```

### 2. Trocar `revokeBlobUrls` por `revokeRemovedBlobs` em `onCameraCapture`

**Localizar:**

```js
  const onCameraCapture = async (photoArray) => {
    const resume = loadUiResume();
    const target = cameraTargetRef.current || resume?.cameraTarget || "detalhe";
    ensureDetFormFromResume(resume);

    if (target === "manual") {
      revokeBlobUrls(formRef.current.manPhotos || []);
      formRef.current.manPhotos = photoArray || [];
    } else if (target === "semTombo") {
      revokeBlobUrls(formRef.current.stPhotos || []);
      formRef.current.stPhotos = photoArray || [];
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("semTombo");
      bumpFt();
      return;
    } else {
      revokeBlobUrls(formRef.current.detNewBase64 || []);
      formRef.current.detNewBase64 = photoArray || [];
    }
```

**Substituir por:**

```js
  const onCameraCapture = async (photoArray) => {
    const resume = loadUiResume();
    const target = cameraTargetRef.current || resume?.cameraTarget || "detalhe";
    ensureDetFormFromResume(resume);
    const incoming = Array.isArray(photoArray) ? photoArray : [];

    if (target === "manual") {
      revokeRemovedBlobs(formRef.current.manPhotos, incoming);
      formRef.current.manPhotos = incoming;
    } else if (target === "semTombo") {
      revokeRemovedBlobs(formRef.current.stPhotos, incoming);
      formRef.current.stPhotos = incoming;
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("semTombo");
      bumpFt();
      return;
    } else {
      revokeRemovedBlobs(formRef.current.detNewBase64, incoming);
      formRef.current.detNewBase64 = incoming;
    }
```

### 3. Garantir conversão imediata para data: URL no CameraModal (defesa extra)

Mesmo com a correção acima, blob URLs podem ser revogadas pelo próprio navegador em casos extremos (memória baixa, troca de aba longa em mobile). O ideal é converter para data URL no momento da captura — fica em memória controlada pelo React.

`src/components/CameraModal.jsx`

**Localizar:**

```js
function canvasToJpegObjectUrl(canvas, quality = 0.8) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(canvas.toDataURL("image/jpeg", quality));
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        "image/jpeg",
        quality
      );
    } catch {
      resolve(canvas.toDataURL("image/jpeg", quality));
    }
  });
}
```

**Substituir por:**

```js
// Antes usávamos URL.createObjectURL (blob: URL), mais leve em memória,
// mas blob URLs podem ser revogadas inadvertidamente ou expirarem em sessões
// longas/mobile com memória baixa, deixando fotos quebradas. Data URL é mais
// pesado mas sobrevive ao ciclo de vida da sessão sem nenhum gerenciamento.
function canvasToJpegObjectUrl(canvas, quality = 0.8) {
  return new Promise((resolve) => {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    } catch {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve("");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          quality
        );
      } catch {
        resolve("");
      }
    }
  });
}
```

> Nota: depois disso, os helpers `revokeBlobUrls` e `revokeRemovedBlobs` ainda funcionam (vão simplesmente não encontrar nenhum `blob:` para revogar). Pode deixá-los — servem de proteção se algum lugar legado ainda gerar blob URLs.

## Validação

1. Tirar 5 fotos seguidas em um item — todas devem aparecer no preview e no salvar.
2. Tirar 2 fotos, sair, voltar pra câmera, tirar mais 2 — total deve ser 4 visíveis.
3. Trocar de aba do navegador por 30s e voltar — fotos da sessão atual continuam visíveis.
