# FRUTTINO — Interactive 3D Product Story

A self-playing WebGL story (Vite · Three.js · GSAP, vanilla JS), in Italian and English. The ingredient composition of the first reference (`agrume.png`) comes to life and turns step by step into the Fruttino of the second reference (`prodotto_finale.png`). There is nothing to scroll: the story starts on its own and lasts about 30 seconds.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/
npm run preview   # serve the production build
```

## The story

A single value, `storyProgress ∈ [0, 1]`, drives everything. It seeks one paused GSAP master timeline (`src/animation/StoryTimeline.js`). That timeline animates the numeric story channels (`src/animation/storyConfig.js`), the camera shot index and the DOM typography.

| # | Scene | Range | What transforms into what |
|---|-------|-------|---------------------------|
| 1 | Ingredienti | 0.00–0.10 | Reference 1 rebuilt in 3D: a long lens and flat ambient light make it look like an illustration. Then the light turns to studio lighting and the lens widens (a dolly-zoom), which shows that everything is 3D. |
| 2 | Il Frutto | 0.10–0.25 | The halves turn and the graphic slice icon folds away. The spoon from scene 1, now a real concave 3D spoon, scoops **all** the pulp out of the fruit (`ScoopSpoon.js`): four spoonfuls alternating the lower and upper half; the tip digs in, the bowl rolls up full, and each spoonful is poured into the air, spilling juicy vesicles and turning from lemon flesh to orange pulp. The last spoonful of each half sweeps it clean, leaving only the peel and pith (a shaded hollow in the cut-face shader). No pulp appears from anywhere else. |
| 3 | La Trasformazione | 0.25–0.50 | Every ingredient follows its own precomputed swirling bezier path into a soft orange mass. The mass splits in **three**: the outer two flow back into the emptied citrus halves and refill them (the cut faces turn to pulp), then the **same mesh** morphs from citrus half to Fruttino cap. The core stays in the centre and, with the sugar already mixed in, is worked from orange into a soft, creamy white. |
| 4 | Il Cuore Cremoso | 0.50–0.64 | The white core — the same pulp, worked with the sugar; nothing is added — flattens and spreads into the creamy band between the separated caps. The sugary grain and white veil of the caps appear as they take shape, because the sugar is in the pulp. The camera moves in close. |
| 5 | L’Assemblaggio | 0.64–0.82 | The caps close. The creamy heart is squeezed (a second morph target) and bulges. No sugar is sprinkled on: the ~6,000 grains of the caps' surface are already there. |
| 6 | Fruttino | 0.82–1.00 | The sky blue fades to beige. The product lands on a soft-shadowed surface, the small citrus rolls in and opens its two leaves, and the hero copy and **RIGUARDA LA STORIA** appear. |

**Playback.** A single GSAP tween moves `storyProgress` from 0 to 1 in real time (`src/animation/AutoPlayController.js`). It starts 0.7 s after load. **Pausa/Riproduci** pauses and resumes it, and **RIGUARDA LA STORIA** rewinds the timeline (you see the Fruttino come apart) and then plays again. No particles are spawned at runtime: every trajectory is seeded and precomputed, so a given progress always renders the same frame in either direction.

**Chapter titles.** Each caption stays on screen for almost its whole scene (`CAPTION_TIMING` in `storyConfig.js`). At the 30-second pace every title is fully readable for 2.8–7.1 s. On desktop the captions sit top-right, a corner no scene uses; on phones they sit at the top.

## Loading screen

The loader (a small Fruttino whose caps close on the cream, the wordmark and a progress bar) is styled **inline in `index.html`**, so it is painted on the very first frame, before the main stylesheet (which Vite injects via JS in dev), the fonts or the 3D scene exist. Until `html.is-ready` the rest of the page is `visibility: hidden`, so unstyled HTML is never shown. `main.js` advances the bar through the real start-up steps (renderer, procedural textures and geometry, shader compilation with `compileAsync`, fonts), yielding a frame between steps, then fades the loader out; autoplay starts only after that. Failsafes: without JS the loader is hidden by `<noscript>`; if start-up throws, the static page is shown; an inline timer reveals the page after 30 s whatever happens. Procedural noise textures are computed at reduced resolution and smoothly scaled up, which cut texture generation to a few hundred ms.

## Header

A bordeaux bar with a wavy, stitched "curtain" edge that hangs over the top of the canvas (`.site-header` and its `::after` in `main.css`). The wave tile is an inline SVG repeated across the width; its size and depth are the `--wave-w` and `--curtain` variables. The 3D viewport and the overlay start just below the curtain, so it never covers the scene; the blue background shows through between the waves. The "Antica Gelateria" wordmark (header and loading screen) is set in italic type; replace `.brand` with your logo SVG if you have one.

## Link to the shop

Two links go to https://fruttinigelato.com: **ACQUISTA I FRUTTINI / SHOP FRUTTINI** in the centre of the header (always visible; `SHOP` on phones), and the primary **VISITA LO SHOP / VISIT THE SHOP** button in the finale, next to the replay button. The static fallback page has the same button. They open in a new tab (`target="_blank" rel="noopener noreferrer"`, announced to screen readers), so the story stays open; to change the URL, search `fruttinigelato.com` in `index.html`.

## Background claim

"I FRUTTINI GELATO® ORIGINALI DAL 1962" (EN: "THE ORIGINAL FRUTTINI GELATO® SINCE 1962") is a static line of large, softly blurred type behind the transparent 3D canvas (`.watermark`). It is hidden during chapters 01–04 and rises in when chapter 05 (L’Assemblaggio) begins, white on the sky blue; in the finale it turns soft bordeaux on the beige and moves into the empty band of the still life (above the product on desktop, below it on phones) so it never crosses the FRUTTINO headline. The text is in `strings.js` (`mark.line1`, `mark.line2`).

## Languages (IT / EN)

All copy lives in `src/i18n/strings.js`; `src/i18n/I18n.js` fills every element tagged `data-i18n` / `data-i18n-aria` / `data-i18n-alt`. The **IT / EN** switch sits in the header, on the right, and can be used at any moment: only the text changes, the story keeps playing. Initial language: `?lang=it` or `?lang=en` in the URL, otherwise the last choice (saved in localStorage), otherwise the browser language (Italian browsers get Italian, everything else English). To add a language, add a block to `STRINGS` and its code to `LANGUAGES` (and a button in `index.html`).

## Reference analysis → decisions

- **Ref 1:** pastel-blue card (`#acd8e5`) on an ivory frame with a scalloped bordeaux edge. A vertical stack on the left (half-citrus, slice icon, three drops, spoon with sugar, half-citrus) and a cream/bordeaux ingredient list on the right. It is rebuilt with extruded graphic shapes, procedural lemon halves and the HTML list (Marcellus, the closest free match to the flared display face).
- **Ref 2:** Fruttino about 2.0 wide by 1.82 tall: top cap 0.60, cream 0.54, bottom cap 0.68. The caps are soft, slightly squashed and irregular, and the bottom cap is rounder. The surface is grainy with sugar and has a white veil on top. The white heart (the pulp itself, worked with the sugar) is thick, matte and slightly uneven. A small citrus with two leaves sits behind-left, lit softly on a beige background.
- **Realistic citrus:** the rind has oil pores, faint green patches and an oily clearcoat sheen; the cut face shows the rind edge, the white pith, ten translucent segments full of juice vesicles (with a matching relief map), membranes, seeds and a pithy core, under a wet clearcoat.
- **Everything is procedural.** No external models or textures are needed. Parametric surfaces with morph targets, canvas-generated maps, and shader patches for the lemon→orange blend, the sugar veil and the juicy cut face.

## Architecture

```
src/
  main.js                      bootstrap / wiring only
  core/        SceneManager (renderer, env, resize) · CameraController (shots, responsive framing)
               LightingManager (key/fill/rim/ambient) · RenderLoop (render on demand)
  objects/     Fruttino = OrangeShell ×2 + CreamLayer + PulpMass + SugarCoating ×2
               FruitPulp · WaterDrops · SugarCrystals · ParticleSwarm (instanced, deterministic)
               OrangeFruit · Leaves · StillLifeStage · StoryWorld (composition)
  animation/   storyConfig (scenes, channels) · choreography (world layout)
               StoryTimeline · AutoPlayController
  ui/          StoryOverlay (typography tweens) · NavigationControls (+ language switch)
  i18n/        strings (IT/EN copy) · I18n (detect, apply, switch)
  utils/       geometry (parametric shapes) · materials (textures, shaders) · math (noise, PRNG)
```

**Camera:** 11 shots with wide orbits, a high-angle vortex view, a low angle, a close three-quarter on the cream, a top-down assembly and a gentle dutch tilt (`roll`) on some shots, all joined by a Catmull-Rom spline so the camera never stops.

**Responsive:** every camera shot has a composition anchor and a fit size, with portrait overrides. On phones the stack sits above the ingredient list, the captions move to the top, and the hero stacks the title above the product. The camera is re-framed for the viewport, not just resized.

**Accessibility and fallbacks:** with `prefers-reduced-motion` the story does not start on its own; it waits for **Riproduci**, and replay restarts without the rewind. Without WebGL2 (or without JS) a static page shows both references with the copy.

**Performance:** there are about 10–25 draw calls per frame, shadow pass included. Particles and sugar are InstancedMeshes, and frames render only when progress changes. All shaders and textures are compiled and uploaded at startup, and the shader-program count stays constant across the whole story, so nothing compiles mid-story.

## Verification done

- `npm run build`: passes, no errors or warnings.
- Headless Chrome with SwiftShader (software WebGL):
  - Screenshots of every scene at 1440×900 and 390×844, compared against both references.
  - Automated checks passed: the story autoplays after load, the page never scrolls (wheel input neither scrolls nor stops it), pause holds the frame and resume continues, chapter 01 is visible on the opening frame, every chapter title is fully readable for 2.8–7.1 s, replay rewinds to the start and plays again, the same progress gives an identical frame after forward and backward jumps, the reduced-motion path and no-WebGL fallback work, IT/EN switching updates every text without interrupting playback, the choice persists after reload and `?lang=` overrides it, and the console has no errors.
- **Not verified:** frame rate on real GPUs and on physical phones. SwiftShader emulates the GPU on the CPU (≈500 ms/frame here), so it can't measure real-device fps. The app's own per-frame JavaScript measured about 2–3 ms.
