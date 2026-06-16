# PATCH A — Câmera fica preta no celular

## Problema

No `CameraModal.jsx`, o `startCamera` faz:

```js
streamRef.current = s;
setStream(s);                // dispara re-render
setUseNativeCapture(false);
setCamError("");
if (videoRef.current) {      // ainda é null aqui — o <video> só renderiza quando stream != null
  videoRef.current.srcObject = s;
  await videoRef.current.play();
}
```

O `<video>` está dentro de um ramo condicional `{!preview && !useNativeCapture && stream && (<video .../>)}` — no momento em que `setStream(s)` é chamado, o React **ainda não re-renderizou**, então `videoRef.current` é `null`. O `if (videoRef.current)` falha silenciosamente, o `srcObject` nunca é atribuído, e a câmera mostra a tela preta.

A correção é mover a atribuição do `srcObject` para um `useEffect` que dispara quando `stream` muda — aí o ref já existe.

## Arquivo

`src/components/CameraModal.jsx`

## Mudanças

### 1. Remover a atribuição direta dentro do `startCamera`

**Localizar este bloco dentro de `startCamera`:**

```js
      streamRef.current = s;
      setStream(s);
      setUseNativeCapture(false);
      setCamError("");
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await videoRef.current.play();
        } catch {}
      }
      const track = s.getVideoTracks()[0];
```

**Substituir por:**

```js
      streamRef.current = s;
      setStream(s);
      setUseNativeCapture(false);
      setCamError("");
      // srcObject e play() são atribuídos no useEffect que escuta `stream`,
      // garantindo que o <video> já está montado no DOM (videoRef.current != null)
      const track = s.getVideoTracks()[0];
```

### 2. Adicionar useEffect que ancora o stream no `<video>` quando ambos existem

**Localizar este useEffect existente (o que tem `aliveRef.current = true`):**

```js
  useEffect(() => {
    aliveRef.current = true;
    if (canUseLiveCamera()) {
      startCamera(facingMode);
    } else {
```

**Adicionar IMEDIATAMENTE ANTES dele (após o `useEffect` de `capturedRef`):**

```js
  // Ancora o stream no elemento <video> assim que ambos existem.
  // Sem isso, em alguns celulares (especialmente iOS Safari e Chrome Android)
  // o vídeo fica preto porque o srcObject foi atribuído antes do elemento renderizar.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Alguns navegadores rejeitam play() até interação do usuário — ignoramos
        // pois o autoplay com muted geralmente funciona, e o tap de captura também destrava.
      });
    }
  }, [stream]);
```

### 3. (Recomendado) Garantir atributos no `<video>` para autoplay em iOS

**Localizar:**

```jsx
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
```

**Substituir por:**

```jsx
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
          />
```

O atributo `webkit-playsinline` é redundante em navegadores modernos mas ajuda em WebViews antigos. O `background: #000` mantém o fundo preto enquanto o frame não chega (em vez de transparente).

## Validação

Depois de aplicar:
1. No celular, abrir um item → "Tirar foto" → câmera deve mostrar o preview imediatamente.
2. Se o celular bloquear permissão, o fallback nativo (`useNativeCapture`) deve aparecer normalmente.
3. Trocar entre câmera frontal/traseira ("Trocar") não deve deixar preto.
