# SPEC 03 — Power pellets y modo asustado

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-09
> **Objective:** Añadir cuatro power pellets que al comerse activan un modo asustado en el que los fantasmas huyen y Pac-Man puede comerlos por puntos.

## Contexto

SPEC 01 dejó fuera de alcance explícitamente el «modo asustado / power pellets» y lo remitió a una spec propia; esta es esa spec. Hoy `MAZE` solo usa los tiles `1` (pared), `2` (dot), `3` (puerta) y `0` (vacío), así que no hay dónde colocar una píldora. `update()` en `game.js` trata toda colisión Pac-Man/fantasma como pérdida de vida, sin distinguir estados. `render.js` dibuja los dots del tile `2` y los fantasmas con `GHOST_COLORS`. SPEC 02 cerró la puerta de la pen para los fantasmas, de modo que un fantasma comido no puede volver a ella y debe reaparecer en su punto de salida.

## Scope

**In:**

- Tile nuevo `4` (píldora) en `src/js/maze.js`, escrito con el carácter `o` en `MAZE_STR`.
- Cuatro píldoras en las esquinas clásicas: `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- Comer una píldora suma 50 puntos y activa o reinicia el modo asustado durante 360 frames (~6 s).
- Con el susto activo, los 4 fantasmas invierten su dirección una vez y luego deciden al azar en cada cruce, a la misma velocidad.
- Colisión con un fantasma asustado: se lo come Pac-Man. Puntos 200, 400, 800 y 1600 según la racha dentro del mismo susto.
- El fantasma comido desaparece y reaparece en su celda de `GHOST_STARTS` 180 frames (~3 s) después, ya en modo normal.
- Colisión con un fantasma no asustado: se pierde una vida, como hoy.
- Render: fantasmas azules que parpadean a blanco en los últimos 120 frames del susto; píldoras como dots grandes parpadeantes; fantasmas comidos invisibles.
- Las píldoras cuentan para la victoria: hay que comer dots y las 4 píldoras para GANAR.
- Perder una vida cancela el susto, reinicia la racha y revierte el estado de los fantasmas.
- Actualizar la tabla de tiles de `AGENTS.md` con el tile `4`.

**Out of scope (para specs futuras):**

- Ojos de fantasma volviendo a la pen por la puerta (SPEC 02 cerró la puerta).
- Velocidad reducida para los fantasmas asustados.
- Frutas, bonus y puntuación extra.
- Niveles, duración del susto decreciente por nivel o dificultad progresiva.
- Sonido, pausa y récords.
- Cambios en la IA normal de SPEC 01 o en las posiciones de `GHOST_STARTS` de SPEC 02.

## Data model

`src/js/maze.js` — se amplía el sistema de tiles. La leyenda del comentario pasa a incluir `o` píldora(4) y `parseTile` la interpreta:

```js
function parseTile( ch ) {
  if ( ch === '#' ) return 1; // pared
  if ( ch === '.' ) return 2; // dot
  if ( ch === '-' ) return 3; // puerta pen
  if ( ch === 'o' ) return 4; // power pellet
  return 0;                    // vacio transitable
}
```

Las esquinas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)` de `MAZE_STR` cambian de `.` a `o`. No se añaden globals nuevas: las píldoras viven en el grid.

`src/js/game.js` — constantes y campos nuevos en `createGame()`:

```js
const FRIGHT_FRAMES = 360;         // duracion del modo asustado (~6 s)
const FRIGHT_BLINK = 120;          // ultimos frames con parpadeo azul/blanco
const GHOST_RESPAWN_FRAMES = 180;  // invisible tras ser comido (~3 s)
const PELLET_POINTS = 50;

// dentro del objeto que devuelve createGame()
frightFrames: 0,   // 0 = normal; >0 = asustado, decrece cada frame
ghostCombo: 0,     // fantasmas comidos en el susto actual; puntos = 200 * 2 ** ghostCombo

ghosts: GHOST_STARTS.map( ( g ) => ( {
  /* ...campos de SPEC 01/02... */
  frightened: false,  // asustado ahora mismo?
  eatenFrames: 0,     // >0 = comido; revive en GHOST_STARTS[i] al llegar a 0
} ) ),
```

`dotsRemaining` mantiene su nombre para no tocar `main.js`, pero pasa a contar tiles `2` y `4`.

Convenciones:

- Tile `4` es transitable y no es muro, igual que el dot.
- `frightFrames` y `eatenFrames` cuentan frames, no segundos (el loop no tiene delta-time), igual que `phaseFrames`.
- Puntos por fantasma en el susto actual = `200 * 2 ** ghostCombo`.

## Implementation plan

1. **Tile de píldora** en `src/js/maze.js`: añadir `o`→4 en `parseTile`, la leyenda y cambiar las 4 celdas de `MAZE_STR`. Manual: abrir `src/index.html`; la página carga sin errores y las esquinas dejan de ser dots.
2. **Dibujar píldoras** en `src/js/render.js`: nueva `drawPellets( ctx, grid )` que dibuja el tile `4` como círculo de radio 5 (el dot es 2.5) y llamada desde `draw()`. Manual: se ven 4 píldoras grandes en las esquinas.
3. **Comer píldoras** en `src/js/game.js`: en el bloque de comer de `movePacman()`, tratar el tile `4` como el `2` pero sumando `PELLET_POINTS`; contar los tiles `4` en `createGame()`. Manual: el SCORE sube 50, la píldora desaparece y la victoria ya exige comerlas.
4. **Estado y activación del susto** en `src/js/game.js`: añadir constantes y campos, y `activateFright( game )` que pone `frightFrames = FRIGHT_FRAMES`, `ghostCombo = 0`, marca `frightened = true` a los fantasmas visibles e invierte su dirección (`OPPOSITE[ g.dir ]`). Llamarla al comer píldora. Manual: al comer, los 4 fantasmas cambian de dirección una vez.
5. **Decremento y fin del susto** en `src/js/game.js`: en `update()`, si `frightFrames > 0` decrementarlo; al llegar a 0, poner `frightened = false` en todos. Manual: ~6 s después los fantasmas recuperan su comportamiento normal.
6. **Comportamiento asustado** en `src/js/game.js`: en `decideGhost`, si `g.frightened`, elegir al azar entre las direcciones válidas sin usar objetivo. Manual: durante el susto se mueven erráticos por pasillos válidos.
7. **Comer fantasmas** en `src/js/game.js`: en la comprobación de colisión de `update()`, si el fantasma está `frightened` → `score += 200 * 2 ** ghostCombo`, `ghostCombo++`, `g.eatenFrames = GHOST_RESPAWN_FRAMES`, `g.frightened = false`; si no, pierde vida como hoy. Decrementar `eatenFrames` y al llegar a 0 reaparecer en `GHOST_STARTS[ i ]` saltando su movimiento y dibujo mientras `eatenFrames > 0`. Manual: se come un fantasma azul, suma 200/400/800/1600 y reaparece a los ~3 s.
8. **Render del susto** en `src/js/render.js`: `drawGhost` pinta azul (`#2121ff`) si `g.frightened` y parpadea a blanco cuando `game.frightFrames <= FRIGHT_BLINK`; no dibujar fantasmas con `eatenFrames > 0`. Manual: fantasmas azules que parpadean al final del susto.
9. **Reset y documentación**: en `resetPositions()` limpiar `frightFrames`, `ghostCombo`, `frightened` y `eatenFrames`; añadir el tile `4` a `AGENTS.md`. Manual: perder una vida cancela el susto y `AGENTS.md` documenta el tile.

## Acceptance criteria

- [ ] La página carga sin errores en la consola.
- [ ] Se ven 4 píldoras grandes parpadeantes en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Comer una píldora suma exactamente 50 puntos y su celda queda vacía.
- [ ] Comer una píldora pone azules a los 4 fantasmas durante ~6 s.
- [ ] Al activarse el susto cada fantasma invierte su dirección una vez.
- [ ] Durante el susto los fantasmas se mueven al azar y a la misma velocidad que en modo normal.
- [ ] En los últimos ~2 s del susto los fantasmas parpadean entre azul y blanco.
- [ ] Al terminar el susto los fantasmas recuperan sus comportamientos de SPEC 01.
- [ ] Comer fantasmas en un mismo susto suma 200, luego 400, 800 y 1600.
- [ ] El fantasma comido desaparece y reaparece en su celda de `GHOST_STARTS` ~3 s después, ya sin susto.
- [ ] Si Pac-Man toca un fantasma NO asustado, pierde una vida como antes.
- [ ] Perder una vida cancela el susto, reinicia la racha y revierte el estado de los fantasmas.
- [ ] GANAR exige comer todos los dots y las 4 píldoras.
- [ ] `AGENTS.md` documenta el tile `4` como píldora.

## Decisions

- **Sí:** tile `4` en `MAZE`. Mantiene una sola fuente de verdad: comer, renderizar y ganar leen `game.grid`, como el resto.
- **Sí:** las 4 esquinas clásicas. Posición simétrica y reconocible del original.
- **Sí:** susto de 360 frames que se reinicia al comer otra píldora. El ciclo dispersión/persecución sigue corriendo: solo añade un contador y evita pausar `phaseFrames`.
- **Sí:** misma velocidad en el susto. Pac-Man (`0.125`) ya es más rápido que el fantasma (`0.1`), así que puede alcanzarlos sin tocar velocidades.
- **Sí:** inversión única al activarse + dirección aleatoria en cruces. Comportamiento clásico y barato de implementar.
- **Sí:** el fantasma comido revive en `GHOST_STARTS` a los 180 frames, en modo normal. No hay ojos ni re-entrada a la pen porque SPEC 02 cerró la puerta.
- **Sí:** racha clásica `200 * 2 ** n`; se reinicia en cada píldora y en cada vida.
- **Sí:** las píldoras cuentan para la victoria, como los dots.
- **Sí:** parpadeo en los últimos 120 frames y píldoras parpadeantes, para comunicar el estado sin texto.
- **No:** velocidad reducida de los asustados. Complica el balance para el MVP.
- **No:** que el fantasma comido vuelva a la pen como ojos. SPEC 02 cerró la puerta; haría falta reabrirla con estado extra.
- **No:** frutas, bonus, niveles, duración decreciente por nivel, sonido.
- **No:** pausar el ciclo de fases durante el susto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El susto dura demasiado poco o demasiado para los 4 fantasmas. | Duración fija en la constante `FRIGHT_FRAMES`; ajustar es una línea. |
| Un fantasma revive justo encima de Pac-Man y le quita una vida. | Reaparece en la fila 11, lejos del juego habitual; si coincide, se aplica la regla normal (pierde vida). |
| La racha no se reinicia y da puntos excesivos. | `ghostCombo = 0` en `activateFright()` y en `resetPositions()`. |
| `eatenFrames` y `frightened` se desincronizan. | Al comer se pone `frightened = false` y no se mueve ni colisiona; al reaparecer arranca normal. |
| El parpadeo necesita el contador global en `render.js`. | `drawGhost` recibe `frightFrames` desde `draw()`; documentado en el paso 8. |

## What is **not** in this spec

- Ojos de fantasma volviendo a la pen.
- Velocidad reducida de los fantasmas asustados.
- Frutas, bonus y puntuación extra.
- Niveles, duración por nivel o dificultad progresiva.
- Sonido, pausa y récords.
- Cambios en la IA normal (SPEC 01) o en `GHOST_STARTS` (SPEC 02).

Cada uno de esos, si llega, va en su propio spec.
