# SPEC 01 — Cuatro fantasmas con comportamientos diferenciados

> **Status:** Approved
> **Depends on:** Ninguno
> **Date:** 2026-10-08
> **Objective:** Dotar al juego de cuatro fantasmas, cada uno con una forma de actuar propia, incluido uno que persigue agresivamente a Pac-Man por la ruta más corta.

## Contexto

Hoy hay 2 fantasmas en `src/js/maze.js` (`GHOST_STARTS`): `hunter` (persecución greedy Manhattan) y `random`. `src/js/render.js` ya define 4 colores en `GHOST_COLORS` y dibuja `game.ghosts` por índice, así que el render no necesita cambios.

## Scope

**In:**

- Cuatro fantasmas con `kind` distintos: `chaser`, `ambusher`, `wanderer`, `shy`.
- El `chaser` (agresivo) persigue a Pac-Man con ruta óptima real (BFS).
- El `ambusher` apunta a la celda 4 posiciones por delante de Pac-Man.
- El `wanderer` elige dirección al azar en cada cruce.
- El `shy` persigue si está a ≥8 celdas (Manhattan) y huye si está a <8.
- Ciclo de fases dispersión/persecución con esquema clásico medido en frames.
- En dispersión cada fantasma se dirige a su esquina asignada.
- Los 4 fantasmas arrancan dentro de la pen y salen por la puerta.
- Misma velocidad para los 4.
- Perder una vida reinicia el ciclo de fases desde el principio.

**Out of scope (para specs futuras):**

- Power pellets / modo asustado (huida global al comer píldora).
- Frutas, bonus y puntuación extra.
- Velocidades distintas por fantasma.
- Temporizadores de salida de la pen (los 4 salen de inmediato).
- Fases dispersión/persecución configurables por nivel.
- Nuevos niveles o cambios en `MAZE`.
- Sonido, pausa y récords.

## Data model

`src/js/maze.js` — se amplía `GHOST_STARTS` a 4 entradas. Las esquinas y el `kind` viven aquí, no hardcodeados en `game.js`:

```js
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'chaser',   corner: { x: 26, y: 1 } },  // rojo   · agresivo
  { x: 14, y: 13, kind: 'wanderer', corner: { x: 1,  y: 29 } }, // cian   · errante
  { x: 13, y: 14, kind: 'ambusher', corner: { x: 1,  y: 1 } },  // rosa   · emboscador
  { x: 14, y: 14, kind: 'shy',      corner: { x: 26, y: 29 } }, // naranja· tímido
];
```

El orden casa con `GHOST_COLORS` de `render.js`: rojo `chaser`, cian `wanderer`, rosa `ambusher`, naranja `shy`.

`src/js/game.js` — nuevo estado de fases dentro de `createGame()`:

```js
// [ fase, frames que dura ]. Infinity = persecución permanente.
const PHASE_SCHEDULE = [
  [ 'scatter', 420 ], [ 'chase', 1200 ],
  [ 'scatter', 420 ], [ 'chase', 1200 ],
  [ 'scatter', 300 ], [ 'chase', 1200 ],
  [ 'scatter', 300 ], [ 'chase', Infinity ],
];

// añadidos al objeto que devuelve createGame()
phaseIndex: 0,
phaseFrames: 0,
```

Convenciones:

- `kind` ∈ `{ 'chaser', 'ambusher', 'wanderer', 'shy' }`.
- Fase actual = `PHASE_SCHEDULE[ phaseIndex ][ 0 ]`.
- `phaseFrames` cuenta frames, no segundos (el loop es `requestAnimationFrame` sin delta-time).
- Coordenadas `(x, y)` con origen arriba-izquierda, igual que el resto del proyecto.

## Implementation plan

1. **Ampliar `GHOST_STARTS` a 4** en `src/js/maze.js` con `kind` y `corner`. Manual: abrir `src/index.html`, ver 4 fantasmas de colores; como los `kind` nuevos no están contemplados aún, los 4 se mueven al azar (rama `else` de `decideGhost`).
2. **Añadir el estado de fases** en `game.js` (`PHASE_SCHEDULE`, `phaseIndex`, `phaseFrames`) y avanzarlo en `update()`. Añadir `ghostTarget( game, g )` que, por ahora, devuelva `g.corner` en `scatter` y la celda de Pac-Man en `chase`; `decideGhost` elige la dirección greedy (Manhattan) hacia ese objetivo. Manual: observar cómo los fantasmas alternan acercarse a esquinas y a Pac-Man.
3. **Implementar BFS** `bfsDir( grid, from, to, forbidden )`: primer paso del camino más corto sobre celdas transitables para `ghost`, excluyendo `forbidden`; devuelve `'left' | 'right' | 'up' | 'down'` o `null`. Manual: el objetivo se sigue con esquinas reales, sin trabarse.
4. **`chaser` agresivo**: en `chase`, objetivo = celda de Pac-Man, resuelto con `bfsDir`. Manual: el fantasma rojo recorre la ruta más corta y alcanza a Pac-Man.
5. **`ambusher`**: objetivo en `chase` = celda de Pac-Man + `DIRS[ pacman.dir ] * 4`. El emboscador corta el paso. Manual: intercepta delante de Pac-Man.
6. **`shy`**: si distancia Manhattan a Pac-Man ≥ 8 → objetivo Pac-Man; si < 8 → huye hacia la esquina más alejada de Pac-Man. Manual: se acerca de lejos y se aleja de cerca.
7. **`wanderer`**: en `chase` `ghostTarget` devuelve `null` y `decideGhost` elige al azar entre los movimientos válidos. Manual: movimiento impredecible que respeta paredes.
8. **Reinicio del ciclo**: en `resetPositions()` resetear `phaseIndex = 0` y `phaseFrames = 0`. Manual: al perder una vida, el ciclo vuelve a empezar por dispersión.

## Acceptance criteria

- [ ] La página carga sin errores en la consola.
- [ ] Se ven 4 fantasmas: rojo, cian, rosa y naranja.
- [ ] Los 4 arrancan dentro de la pen y salen de ella al empezar la partida.
- [ ] El `chaser` (rojo) llega a Pac-Man por la ruta más corta cuando no escapa.
- [ ] El `ambusher` apunta a 4 celdas por delante de Pac-Man en su dirección actual.
- [ ] El `wanderer` se mueve de forma impredecible por pasillos válidos.
- [ ] El `shy` persigue a ≥8 celdas y huye a <8 celdas de distancia Manhattan.
- [ ] Ningún fantasma atraviesa paredes ni hace giro en U salvo en un callejón sin salida.
- [ ] El ciclo alterna dispersión/persecución según `PHASE_SCHEDULE` y en dispersión cada fantasma va a su esquina.
- [ ] Perder una vida reinicia el ciclo desde la primera dispersión.
- [ ] Perder todas las vidas muestra «PERDISTE» y comer todos los dots muestra «GANASTE», como antes.

## Decisions

- **Sí:** BFS para el `chaser` y para seguir objetivos. El greedy Manhattan actual se traba en callejones y no es una persecución agresiva real.
- **Sí:** una función central `ghostTarget()` que devuelve la celda objetivo según `kind` + fase; `decideGhost` solo convierte objetivo en dirección. Mantiene la IA en un solo lugar.
- **Sí:** esquinas y `kind` en `GHOST_STARTS` (maze.js). Evita coordenadas hardcodeadas en `game.js`.
- **Sí:** la huida del `shy` va a la esquina más alejada de Pac-Man (de las 4). Determinista, barato y siempre aleja.
- **Sí:** `ambusher` a 4 celdas por delante, como Pinky en el original.
- **Sí:** mismas velocidad y física para los 4. La diferenciación es solo la decisión de dirección.
- **Sí:** reloj por frames. El loop no tiene delta-time y añadirlo sale del alcance; las duraciones son orientativas.
- **No:** modo asustado / power pellets. Necesita más estado (timer, cascabel, puntos) y merece su propio spec.
- **No:** velocidades por fantasma. Aumenta la dificultad y complica el balance; fuera del MVP.
- **No:** temporizadores de salida de la pen. Los 4 salen de inmediato.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `requestAnimationFrame` a menos de 60 fps alarga las fases medidas en frames. | Aproximación aceptada en el MVP; documentada en Decisions. |
| Recalcular BFS para 4 fantasmas cada frame. | Decidir solo cuando el fantasma está alineado a la celda (ya ocurre en `moveGhost`); el grid es 28x31 y el coste es despreciable. |
| Un fantasma queda encerrado si su objetivo es inalcanzable. | `isWall` para `ghost` permite el tile `3` (puerta), así que salen de la pen; si BFS no halla ruta, `decideGhost` cae al azar/giro de 180. |
| Oscilación al cambiar de objetivo cada frame. | La dirección solo se decide en celdas alineadas, no en cada frame. |

## What is **not** in this spec

- Power pellets y modo asustado.
- Frutas y bonus.
- Velocidades distintas por fantasma.
- Temporizadores de salida de la pen.
- Niveles nuevos o cambios en `MAZE`.
- Sonido, pausa y récords.

Cada uno de esos, si llega, va en su propio spec.
