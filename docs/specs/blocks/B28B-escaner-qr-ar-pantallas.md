# BLOQUE 28B: Escáner QR, Overlay AR y Pantallas de Resonancia
- Depende de: 23, 28A, 41
- Modifica: Conecta `BagScene.ts` (`soul_fragment`, `soul_fragment_brilliant`) y `WorkshopScene.ts` con la nueva escena `GachaResonanceScene.ts` y `QrScannerService.ts`
- Estado: COMPLETO (SPEC) · Spec: v1.0

## Objetivo
Construir la experiencia visual, interactiva y de cámara en dispositivo del sistema de **Resonancia de Fragmentos de Alma (Gacha por QR)** sobre la lógica pura ya verificada en el Bloque 28A (`GachaService.ts`), integrando:
1. Un **Escáner QR 100% en dispositivo (`QrScannerService.ts`)** con fallback sin cámara (subida de imagen y código/semilla manual) que cumple estrictamente el **Invariante I-14** (privacidad y seguridad: el payload nunca se abre ni se ejecuta como URL/script).
2. Un **Overlay AR y cinemática de resonancia** con retícula de bronce, partículas de ki y revelación por rareza.
3. La pantalla **`GachaResonanceScene.ts`** construida íntegramente con el **Souldolls UI Kit (Bloque 41)** y tokens de `theme.json`, mostrando probabilidades exactas, contador de *pity*, progreso `x/5` de piezas de cuerpo e historial de códigos escaneados (`scanLedger`).

---

## 1. Huecos detectados y resolución

1. **Punto de entrada diegético (cumplimiento de Invariante I-11):**
   - *Hueco:* No estaba fijado desde dónde abre el jugador la pantalla de Resonancia sin violar I-11 (prohibido añadir accesos a servicios en el HUD del overworld).
   - *Resolución:* Se accede de dos formas legítimas **[PROPUESTA]**:
     1. Desde la **Mochila (`BagScene`)** al seleccionar `Fragmento de alma` (`soul_fragment`) o `Fragmento de alma brillante` (`soul_fragment_brilliant`) y pulsar *"USAR / RESONAR"*.
     2. Desde la **Máquina de Resonancia / Altar del Taller de Artífices (`WorkshopScene` / `interior_center`)** mediante un botón dedicado *"RESONAR FRAGMENTO QR"*.
2. **Arquitectura del Escáner QR y Fallbacks en iFrame / Desktop / Móvil (`QrScannerService.ts`):**
   - *Hueco:* En navegadores móviles o dentro de un iFrame de previsualización, `BarcodeDetector` puede no estar soportado o el usuario puede denegar el permiso de cámara (`NotAllowedError` / `NotFoundError`).
   - *Resolución:* Flujo en 3 capas 100% local en el dispositivo **[PROPUESTA]**:
     1. **Cámara en vivo (`getUserMedia`):** Solicita `{ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }`. Escanea a `10 Hz` (cada `100 ms`) usando `BarcodeDetector` nativo o un analizador matricial de contraste sobre `OffscreenCanvas` / `<canvas>` oculto.
     2. **Fallback 1 — Imagen local (`<input type="file" accept="image/*">`):** Permite seleccionar o fotografiar un QR desde la galería; extrae los píxeles en memoria y obtiene el payload determinista sin subir nada a ningún servidor.
     3. **Fallback 2 — Sello / Código de Resonancia manual (`KitModal` `TextPrompt`):** Permite escribir o pegar cualquier código alfanumérico (máx. `128` caracteres) o elegir uno de los **Sellos de Prueba del Gremio** para entornos sin cámara.
3. **Sanitización estricta del Payload QR (Invariante I-14):**
   - *Hueco:* Un código QR real en la calle suele contener URLs (`https://...`, `javascript:...`, `mailto:...`, `data:...`).
   - *Resolución:* `QrScannerService.sanitizeQrPayload(raw)` **[PROPUESTA]** recorta a máx. `256` caracteres, elimina caracteres de control (`\x00-\x1F`) y transforma el contenido en una huella opaca de texto (`SOULQR::<sha/cyrb53>`) antes de pasarlo a `GachaService.rollFromScan`. Nunca se invoca `window.open`, `location.href`, `fetch` ni `eval` con el contenido del QR (*fuente: Invariante I-14*).
4. **Layout de `GachaResonanceScene` en el UI Kit (Bloque 41):**
   - *Hueco:* Faltaba definir la estructura de pestañas/tarjetas en móvil vertical (`< 840 px`) y escritorio (`>= 840 px`), así como la visualización obligatoria de probabilidades y *pity* (*fuente: Invariante I-14 y B28A*).
   - *Resolución:* `ScreenFrame` con 3 pestañas del UI Kit (`KitTabBar`) **[PROPUESTA]**:
     - **Pestaña 1 — `ESCANEAR QR`:** Selector de fragmento (`Estándar` vs `Brillante`), visor AR con retícula de bronce (`220x220 px` mín.), estado de cámara, botones de *"ACTIVAR CÁMARA"*, *"SUBIR IMAGEN QR"* e *"INTRODUCIR CÓDIGO"*, y barra de *Pity* actual (`x/10` o `x/5`).
     - **Pestaña 2 — `PIEZAS Y CUERPOS (x/5)`:** Lista con `KitListRow` y `KitBar` del progreso `x/5` de los 8 tipos de Cuerpo contenedor (`piece_madera_t1` a `piece_arcano_t5`) y botón para ensamblar manualmente si alguno alcanza `5/5`.
     - **Pestaña 3 — `PROBABILIDADES Y REGISTRO`:** Tabla de transparencia oficial desde `GachaService.getTableTransparencyInfo(tableId)` (`Común 55.0%`, `Poco común 28.0%`, `Rara 13.0%`, `Épica 4.0%` en estándar; `20.0% / 35.0% / 30.0% / 15.0%` en brillante), reglas de *pity*, conversión de pergaminos duplicados en Polvo de Ki (`15 / 30 / 60 / 120`) y últimos códigos del `scanLedger`.
5. **Casos límite (Edge Cases):**
   - *Hueco:* Denegación de cámara, pérdida de foco/cierre de escena con cámara activa (fuga de `MediaStreamTrack`), QR repetido, límite diario alcanzado (`10/día`) o 0 fragmentos disponibles.
   - *Resolución:* Especificados en la Sección 3. Al salir o pausar `GachaResonanceScene`, se ejecuta siempre `QrScannerService.stopCamera()` deteniendo todos los `MediaStreamTrack` activos.

---

## 2. Requisitos (numerados y medibles)

### R1. Servicio de Escáner QR y Privacidad en Dispositivo (`src/services/QrScannerService.ts`)
1. **Cumplimiento de Invariante I-14:**
   - Jamás realiza peticiones de red (`fetch` / `XMLHttpRequest`), ni abre enlaces (`window.open` / `location`), ni ejecuta código a partir del payload escaneado.
   - Expone `sanitizeQrPayload(raw: string): { valid: boolean; sanitized: string; displayCode: string; reason?: string }`:
     - Rechaza cadenas vacías o de solo espacios (`valid: false, reason: 'EMPTY'`).
     - Elimina caracteres de control (`[\x00-\x1F\x7F]`) y limita la longitud a `256` caracteres.
     - Neutraliza cualquier esquema ejecutable o URL (`http://`, `https://`, `javascript:`, `data:`, `file:`) convirtiéndolo en texto plano inerte prefijado (`QR_SAFE::<hash>`) conservando 100% su entropía determinista para `GachaService.hashPayload`.
2. **Ciclo de vida de Cámara (`MediaStream`):**
   - `startCamera(onDetect: (payload: string) => void): Promise<{ active: boolean; mode: 'camera' | 'fallback'; error?: string }>`:
     - En entorno navegador con `navigator.mediaDevices?.getUserMedia`, crea un elemento `<video playsinline muted>` oculto o acoplado al visor y captura frames a `10 FPS` en un `<canvas>` de `320x240` para dibujar el feed pixelado en una textura de PixiJS con `NearestFilter` (estética 2.5D coherente con el juego) y detectar códigos QR.
     - Si el permiso es denegado o no hay cámara disponible, no lanza excepción no controlada: devuelve `{ active: false, mode: 'fallback', error: 'CAMERA_UNAVAILABLE' }` y habilita automáticamente los controles de imagen/código manual.
   - `stopCamera(): void`: detiene todos los `track.stop()` del `MediaStream`, limpia el intervalo de escaneo y libera el elemento `<video>`.
3. **Decodificación de Imagen Local (`decodeFromImageFile(file: File | Blob)`):**
   - Lee el archivo localmente en memoria (`createImageBitmap` o `FileReader`), usa `BarcodeDetector` si existe o calcula una huella determinista de los bloques de luminancia de la imagen (`IMGQR::<width>x<height>::<lumaHash>`) para que cualquier imagen de QR produzca siempre la misma semilla determinista en el dispositivo.

### R2. Overlay AR y Cinemática de Resonancia en `GachaResonanceScene`
1. **Visor AR con Marco de Bronce (`240x200 px` en móvil, `320x240 px` en escritorio):**
   - Muestra en tiempo real el feed de cámara (o el altar de resonancia arcano cuando está en modo sin cámara) dentro de una `KitCard` variante `'inkCrypt'`.
   - Dibuja una **retícula de apunte AR** con 4 esquinas en oro antiguo (`#E8B84A`), línea de barrido horizontal animada en cian ki (`#5FE3D2`) y 12 partículas orbitales de ki que aceleran al detectar un código.
2. **Animación de Invocación y Revelación (duración `650 ms`):**
   - Al validar un código con `GachaService.rollFromScan(sanitizedPayload, state, { tableId })`:
     - Si `result.ok === true`: reproduce sonido `'crystal'` + `'soul_seal'`, ilumina el núcleo del visor con el color de rareza obtenida (`comun` `#A89BB0`, `pocoComun` `#47C778`, `rara` `#4DA6FF`, `epica` `#B05CFF`) y abre un `KitModal` tipo `'Reward'` con el desglose de recompensas:
       -Nombre, rareza y cantidad del objeto/pergamino/pieza.
       - Si se completaron `5/5` piezas (`assembledBodyInstanceId`), muestra aviso destacado de **¡Nuevo Cuerpo Ensamblado en el Almacén!**
       - Si un pergamino duplicado se convirtió en Polvo de Ki (`convertedKiDust`), muestra la cantidad exacta de `+X Polvo de Ki`.
     - Si `result.ok === false` (`ALREADY_REDEEMED`, `COOLDOWN_ACTIVE`, `DAILY_LIMIT_REACHED`, `NO_FRAGMENTS`, `EMPTY_PAYLOAD`): reproduce `'cancel'` y muestra un `KitModal` tipo `'Alert'` con el mensaje claro en español y **0 fragmentos consumidos**.

### R3. Transparencia de Probabilidades, Contador Pity y Progreso `x/5` (Invariante I-14)
1. **Probabilidades siempre visibles:**
   - La pantalla muestra explícitamente las tasas de `GachaService.getTableTransparencyInfo(tableId)`:
     - **Resonancia Estándar (`soul_fragment`):** Común `55.0%` · Poco común `28.0%` · Rara `13.0%` · Épica `4.0%` · Pity garantizado: **Rara o superior cada 10 tiradas**.
     - **Resonancia Brillante (`soul_fragment_brilliant`):** Común `20.0%` · Poco común `35.0%` · Rara `30.0%` · Épica `15.0%` · Pity garantizado: **Épica cada 5 tiradas**.
   - Incluye aviso explícito de cumplimiento I-14: *"Los Fragmentos de alma se obtienen exclusivamente explorando Anima y completando encargos del Gremio. Sin compras con dinero real."*
2. **Progreso de Piezas de Cuerpo (`x/5`):**
   - Lista los 8 chasis de `BODY_PIECES_DATA` indicando `piezas actuales / 5` mediante `KitBar` y permite ensamblar en el acto si por recompensas previas hay `>= 5` piezas acumuladas.

### R4. Integración con Mochila (`BagScene`) y Taller (`WorkshopScene`)
1. En `BagScene.ts`:
   - Los ítems de categoría `'fragment'` (`soul_fragment` y `soul_fragment_brilliant`) tienen `canUseInField = true` en `GroupAViewModels.ts`.
   - Al pulsar *"USAR / EQUIPAR"* sobre un `soul_fragment` o `soul_fragment_brilliant`, `BagScene` abre `GachaResonanceScene` preseleccionando la tabla correspondiente (`standard_resonance` o `brilliant_resonance`).
2. En `WorkshopScene.ts`:
   - Añade una pestaña o acción en el Taller de Artífices para abrir `GachaResonanceScene` directamente desde la Máquina de Resonancia del edificio.

---

## 3. Casos límite (Edge Cases)

1. **Permiso de cámara denegado o navegador sin cámara:** El visor AR conmuta sin errores al modo *"Altar de Resonancia Local"*, mostrando los botones *"SUBIR IMAGEN QR"* e *"INTRODUCIR SELLO MANUAL"* para que ningún jugador quede bloqueado.
2. **QR con URL maliciosa o esquema `javascript:`:** `QrScannerService.sanitizeQrPayload` neutraliza cualquier esquema ejecutable y devuelve una cadena hash inerte; nunca se navega fuera de la app ni se ejecuta nada.
3. **Código QR ya escaneado (`ALREADY_REDEEMED`) o límite diario (`10/10`):** `GachaService.rollFromScan` rechaza el canje antes de descontar el fragmento; la UI informa al jugador cuánto falta para el reinicio diario o que ese código ya resonó en su partida.
4. **Cierre abrupto de la escena o cambio de pestaña con cámara encendida:** `GachaResonanceScene.exit()` y `pause()` llaman siempre a `QrScannerService.stopCamera()`, apagando el LED de la cámara inmediatamente.

---

## 4. Datos y Textos (`src/data/text/es.json` → `terms.gacha`) **[PROPUESTA]**

- `terms.gacha.title`: `"CÁMARA DE RESONANCIA QR"`
- `terms.gacha.tab_scan`: `"ESCANEAR QR"`
- `terms.gacha.tab_pieces`: `"PIEZAS (X/5)"`
- `terms.gacha.tab_rates`: `"PROBABILIDADES"`
- `terms.gacha.mode_standard`: `"FRAGMENTO ESTÁNDAR"`
- `terms.gacha.mode_brilliant`: `"FRAGMENTO BRILLANTE"`
- `terms.gacha.btn_start_cam`: `"ACTIVAR CÁMARA QR"`
- `terms.gacha.btn_stop_cam`: `"DETENER CÁMARA"`
- `terms.gacha.btn_upload_qr`: `"SUBIR IMAGEN QR"`
- `terms.gacha.btn_manual_code`: `"INTRODUCIR SELLO"`
- `terms.gacha.pity_label`: `"PITY GARANTIZADO: {current}/{max} TIRADAS"`
- `terms.gacha.daily_label`: `"CANJES HOY: {used}/{limit}"`
- `terms.gacha.privacy_notice`: `"PRIVACIDAD Y ÉTICA DEL GREMIO (I-14): La cámara se procesa 100% en tu dispositivo. El contenido de un QR nunca se abre ni se ejecuta. Sin compras con dinero real."`
- `terms.gacha.reward_title`: `"RESONANCIA COMPLETADA"`
- `terms.gacha.assembled_notice`: `"¡5/5 PIEZAS REUNIDAS! Nuevo {bodyName} ensamblado en tu Almacén."`
- `terms.gacha.ki_dust_notice`: `"Pergamino duplicado convertido en +{dust} Polvo de Ki."`

---

## 5. Tests (`src/systems/gacha/Bloque28BQrTestRunner.ts`)

1. **Test 1 — Sanitización de seguridad y privacidad de QR (Invariante I-14):** Verifica que `QrScannerService.sanitizeQrPayload` rechace cadenas vacías, neutralice URLs (`https://evil.example/payload`, `javascript:alert(1)`, `data:text/html,...`) sin ejecutarlas, recorte payloads >256 chars y produzca semillas deterministas idénticas para el mismo QR.
2. **Test 2 — Transparencia de probabilidades y Pity en ViewModel (`buildGachaResonanceVM`):** Verifica que el ViewModel exponga las tasas exactas de `standard_resonance` (`55.0%`, `28.0%`, `13.0%`, `4.0%`, pity `10`) y `brilliant_resonance` (`20.0%`, `35.0%`, `30.0%`, `15.0%`, pity `5`), el contador diario `x/10` y el aviso de ética I-14.
3. **Test 3 — Flujo completo de escaneo QR (Estándar y Brillante) y Anti-abuso:** Verifica que escanear un QR válido desde la UI/servicio consuma 1 fragmento, otorgue recompensa determinista, actualice `scanLedger` y que reescanear el mismo QR devuelva `ALREADY_REDEEMED` sin consumir otro fragmento.
4. **Test 4 — Progreso `x/5` de Piezas de Cuerpo y Ensamblaje desde UI:** Verifica que el ViewModel liste los 8 chasis con su progreso `x/5` y que al alcanzar `5/5` piezas se ensamble un `BodyInstance` válido en `state.bodies`.
5. **Test 5 — Ciclo de vida de cámara y limpieza de recursos (`stopCamera`):** Verifica que `QrScannerService.stopCamera()` limpie el estado activo sin errores en entornos con o sin cámara (`Node` / navegador sin permisos) y que `BagScene` habilite `canUseInField = true` para `soul_fragment` y `soul_fragment_brilliant`.

---

## 6. Criterios de aceptación (checkpoint)
- [ ] Seleccionar un `Fragmento de alma` o `Fragmento brillante` en la Mochila (o desde el Taller de Artífices) abre `GachaResonanceScene`.
- [ ] El visor AR permite activar la cámara en dispositivo o usar los 2 fallbacks (subir imagen QR o introducir sello manual) sin bloquearse si no hay cámara.
- [ ] Ningún QR escaneado abre URLs ni realiza llamadas de red (Invariante I-14).
- [ ] Las probabilidades exactas de cada rareza y el contador de *pity* (`x/10` y `x/5`) son visibles en pantalla sin compras con dinero real (Invariante I-14).
- [ ] La pestaña de piezas muestra el progreso `x/5` de los 8 cuerpos contenedores y permite ver/ensamblar cuerpos al completar 5 piezas.
- [ ] `Bloque28BQrTestRunner` (5/5), `lint_applet` y `compile_applet` pasan en verde.

---

## 7. Fuera de alcance
- Compras integradas con dinero real o pasarelas de pago (prohibido por Invariante I-14).
- Envío de imágenes de cámara a servidores externos (prohibido por Invariante I-14).

---

## 8. Preguntas abiertas (máx. 5, con opción por defecto)

1. **Q1 — Puntos de acceso a la Cámara de Resonancia QR:**
   - *Por defecto:* Se abre al usar un `Fragmento de alma` / `Fragmento brillante` desde la **Mochila (`BagScene`)** y también desde un botón en el **Taller de Artífices (`WorkshopScene`)**.
2. **Q2 — Comportamiento cuando el dispositivo no tiene cámara o se deniega el permiso:**
   - *Por defecto:* Conmuta automáticamente al visor de **Altar de Resonancia Local** con botones para **Subir imagen de QR** o **Escribir código/sello manual** (incluyendo botones rápidos de sellos de muestra en modo sin cámara).
3. **Q3 — Resolución del feed de cámara en el visor AR de Pixi:**
   - *Por defecto:* Se muestrea a `320x240` con `NearestFilter` dentro del marco de bronce para mantener la estética pixel-art 2.5D y garantizar 60 FPS en móvil.
4. **Q4 — Selección automática del tipo de Fragmento al entrar desde la Mochila:**
   - *Por defecto:* Si el jugador pulsa *"USAR"* sobre `soul_fragment_brilliant`, la escena abre directamente en modo **Resonancia Brillante**; si pulsa sobre `soul_fragment`, abre en **Resonancia Estándar**.
5. **Q5 — Visualización del historial de códigos escaneados (`scanLedger`):**
   - *Por defecto:* Se muestran los últimos `10` códigos canjeados (con su hash abreviado y fecha) en la pestaña de Probabilidades y Registro.

---

## 9. Notas de reconciliación
- **v1.0 (2026-10-04):** Especificación completada mediante `/finish-spec B28B` conectando el motor puro del Bloque 28A (`GachaService.ts`), el Souldolls UI Kit del Bloque 41 y las garantías de privacidad/ética del Invariante I-14.
