# SPEC 02 — Salida de los fantasmas de su punto inicial

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-10-09
> **Objective:** Colocar a los cuatro fantasmas en el pasillo del mapa justo encima de la pen (fila 11) al empezar a moverse, y cerrar la puerta de la pen para que no puedan volver a entrar.

## Contexto

En SPEC 01 los 4 fantasmas arrancan dentro de la pen: `(13,13)`, `(14,13)`, `(13,14)`, `(14,14)`, con `dir: 'up'`. La puerta (tile `3`, fila 12) es transitable para fantasmas, pero `decideGhost` solo la atraviesa si el objetivo greedy Manhattan la favorece. Dentro del recinto cerrado el greedy oscila: el `wanderer` (esquina `1,29`) y el `shy` (esquina `26,29`) se quedan dando vueltas en las columnas interiores y nunca eligen "subir por la puerta". El `chaser` además cae a ese greedy porque en `bfsDir` la celda `forbidden` (la que deja atrás) es la propia puerta `(13,12)` con su `dir` inicial `up`, así que BFS no encuentra ruta. Resultado: los fantasmas quedan atrapados en la pen al empezar a moverse.

## Scope

**In:**

- Los 4 fantasmas arrancan en el pasillo de la fila 11: dos en `(13,11)` y dos en `(14,11)`, en vez de dentro de la pen.
- La puerta de la pen (tile `3`) pasa a ser muro para los fantasmas: no pueden cruzar ni re-entrar a la pen.
- Aplica igual al arrancar la partida y al perder una vida (`resetPositions`), porque ambos usan `GHOST_STARTS`.

**Out of scope (para specs futuras):**

- Animación de salida cruzando la puerta.
- Temporizadores de salida de la pen escalonados (los 4 arrancan de inmediato, como decidió SPEC 01).
- Cambios en `MAZE`, geometría de la pen o tamaño del laberinto.
- Cualquier otra mejora de la IA de los fantasmas fuera de su punto de partida.

## Data model

`src/js/maze.js` — cambian las coordenadas de `GHOST_STARTS` al pasillo sobre la puerta. `kind` y `corner` no se tocan:

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'chaser',   corner: { x: 26, y: 1 } },  // rojo   · agresivo
  { x: 14, y: 11, kind: 'wanderer', corner: { x: 1,  y: 29 } }, // cian   · errante
  { x: 13, y: 11, kind: 'ambusher', corner: { x: 1,  y: 1 } },  // rosa   · emboscador
  { x: 14, y: 11, kind: 'shy',      corner: { x: 26, y: 29 } }, // naranja· tímido
];
```

`(13,11)` y `(14,11)` son dots transitables de la fila 11, justo encima de la puerta (fila 12, cols 13-14). El orden sigue casando con `GHOST_COLORS` de `render.js`.

`src/js/game.js` — la puerta pasa a ser muro para todos los actores en `isWall`:

```js
// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1) y puerta (3)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true;
  return false;
}
```

No se introducen estructuras de estado nuevas: se reutiliza el modelo de SPEC 01. `createGame()` y `resetPositions()` ya derivan las posiciones de `GHOST_STARTS`, así que heredan el cambio sin código extra.

## Implementation plan

1. **Mover `GHOST_STARTS` al pasillo** en `src/js/maze.js` (`13,11` y `14,11`). Manual: abrir `src/index.html`, arrancar y comprobar que los 4 fantasmas aparecen en la fila 11 y se mueven; ninguno queda atrapado en la pen.
2. **Cerrar la puerta para fantasmas** en `src/js/game.js` (`isWall`: tile `3` bloquea también a `ghost`) y actualizar el comentario. Manual: jugar y comprobar que ningún fantasma cruza ni re-entra a la pen a mitad de partida.

## Acceptance criteria

- [ ] La página carga sin errores en la consola.
- [ ] Al arrancar la partida los 4 fantasmas están en el pasillo de la fila 11 y se mueven de inmediato.
- [ ] Ningún fantasma queda atrapado ni oscila dentro de la pen al empezar a moverse.
- [ ] Ningún fantasma cruza la puerta ni re-entra a la pen a mitad de partida.
- [ ] Al perder una vida, los 4 reaparecen en el pasillo de la fila 11 y siguen moviéndose.
- [ ] Se conservan los comportamientos de SPEC 01: `chaser` con BFS, `wanderer` al azar, `ambusher` 4 celdas por delante, `shy` persigue a ≥8 y huye a <8.
- [ ] Los 4 colores (rojo, cian, rosa, naranja) y su orden se mantienen.

## Decisions

- **Sí:** mover las posiciones de `GHOST_STARTS` al pasillo de la fila 11. Elimina el origen del atasco sin tocar la IA ni añadir estado.
- **Sí:** la puerta pasa a ser muro para los fantasmas. Impide re-entrar a la pen y evita necesitar lógica de "fantasma saliendo".
- **Sí:** el spawn directo en el mapa no produce un "pop" visible porque el overlay tapa el laberinto hasta pulsar Start.
- **No:** rutear a los fantasmas por la puerta con un estado "saliendo" y BFS hacia la salida. Más código y casos límite para el mismo resultado visible.
- **No:** animación de salida por la puerta. Fuera del alcance del MVP.
- **Nota:** el bug del `chaser` (celda `forbidden` = puerta en `bfsDir`) deja de ser alcanzable porque ningún fantasma arranca ni pasa por la puerta; no se modifica `bfsDir`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Dos fantasmas comparten celda al aparecer (`13,11` y `14,11`). | Aceptado; en el arcade los fantasmas se apilan al salir. Se separan en el primer cruce porque tienen esquinas distintas. |
| La pen queda como decoración sin uso. | Aceptado: no hay re-entrada ni partidas que empiecen dentro; fuera del alcance del MVP. |

## What is **not** in this spec

- Animación de salida cruzando la puerta.
- Temporizadores de salida de la pen escalonados.
- Cambios en `MAZE` o en la geometría de la pen.
- Ajustes de IA de los fantasmas fuera de su punto de partida.

Cada uno de esos, si llega, va en su propio spec.
