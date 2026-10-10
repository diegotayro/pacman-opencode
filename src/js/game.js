// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

// [ fase, frames que dura ]. Infinity = persecución permanente.
const PHASE_SCHEDULE = [
  [ 'scatter', 420 ], [ 'chase', 1200 ],
  [ 'scatter', 420 ], [ 'chase', 1200 ],
  [ 'scatter', 300 ], [ 'chase', 1200 ],
  [ 'scatter', 300 ], [ 'chase', Infinity ],
];

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Modo asustado (power pellets).
const FRIGHT_FRAMES = 360;         // duracion del modo asustado (~6 s)
const FRIGHT_BLINK = 120;          // ultimos frames con parpadeo azul/blanco
const GHOST_RESPAWN_FRAMES = 180;  // invisible tras ser comido (~3 s)
const PELLET_POINTS = 50;          // puntos por power pellet

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    phaseIndex: 0,
    phaseFrames: 0,
    frightFrames: 0, // 0 = normal; >0 = modo asustado, decrece cada frame
    ghostCombo: 0,   // fantasmas comidos en el susto actual (200 * 2 ** n)
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      corner: g.corner,
      frightened: false, // asustado ahora mismo?
      eatenFrames: 0,    // >0 = comido; revive en GHOST_STARTS[i] al llegar a 0
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

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

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet (tile 4).
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 || tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.dotsRemaining--;
      if ( tile === 4 ) {
        game.score += PELLET_POINTS;
        activateFright( game );
      } else {
        game.score += 10;
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Activa (o reinicia) el modo asustado: los fantasmas visibles invierten su
// direccion una vez y a partir de ahi deciden al azar en cada cruce.
function activateFright( game ) {
  game.frightFrames = FRIGHT_FRAMES;
  game.ghostCombo = 0;
  for ( const g of game.ghosts ) {
    if ( g.eatenFrames > 0 ) continue; // comido: sigue invisible y revive normal
    g.frightened = true;
    g.dir = OPPOSITE[ g.dir ];
  }
}

// Decrementa el modo asustado; al agotarse vuelve la IA normal (SPEC 01).
function advanceFright( game ) {
  if ( game.frightFrames <= 0 ) return;
  game.frightFrames--;
  if ( game.frightFrames === 0 ) {
    for ( const g of game.ghosts ) g.frightened = false;
  }
}

// Objetivo del fantasma segun kind + fase. null = sin objetivo (decision al azar).
function ghostTarget( game, g ) {
  const p = game.pacman;
  const phase = PHASE_SCHEDULE[ game.phaseIndex ][ 0 ];
  if ( phase === 'scatter' ) return g.corner;

  switch ( g.kind ) {
    case 'wanderer':
      return null;
    case 'ambusher': {
      const d = DIRS[ p.dir ];
      return { x: Math.round( p.x ) + d.x * 4, y: Math.round( p.y ) + d.y * 4 };
    }
    case 'shy': {
      const px = Math.round( p.x );
      const py = Math.round( p.y );
      const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
      if ( dist < 8 ) {
        // Huir: esquina mas alejada de Pac-Man entre las 4.
        const corners = GHOST_STARTS.map( ( s ) => s.corner );
        let far = corners[ 0 ];
        let farDist = -1;
        for ( const c of corners ) {
          const d = Math.abs( c.x - px ) + Math.abs( c.y - py );
          if ( d > farDist ) {
            farDist = d;
            far = c;
          }
        }
        return far;
      }
      return { x: px, y: py };
    }
    default:
      // chaser: celda de Pac-Man, resuelta con BFS en decideGhost.
      return { x: Math.round( p.x ), y: Math.round( p.y ) };
  }
}

// Primer paso del camino mas corto (BFS) sobre celdas transitables para ghost.
// `forbidden` es una celda excluida (p.ej. la que el fantasma deja atras, para
// no girar en U). Devuelve 'left' | 'right' | 'up' | 'down' o null sin ruta.
function bfsDir( grid, from, to, forbidden ) {
  const W = grid[ 0 ].length;
  const startKey = from.x + ',' + from.y;
  const goalKey = to.x + ',' + to.y;
  if ( startKey === goalKey ) return null;

  const forbKey = forbidden ? forbidden.x + ',' + forbidden.y : null;
  const prev = new Map();
  const visited = new Set( [ startKey ] );
  let frontier = [ from ];

  while ( frontier.length ) {
    const next = [];
    for ( const cur of frontier ) {
      for ( const dir of Object.keys( DIRS ) ) {
        const d = DIRS[ dir ];
        let nx = cur.x + d.x;
        let ny = cur.y + d.y;
        if ( ny === TUNNEL_ROW ) {
          if ( nx < 0 ) nx += W;
          else if ( nx >= W ) nx -= W;
        }
        const key = nx + ',' + ny;
        if ( visited.has( key ) || key === forbKey ) continue;
        if ( isWall( grid, nx, ny, 'ghost' ) ) continue;
        visited.add( key );
        prev.set( key, { x: cur.x, y: cur.y, dir } );
        if ( key === goalKey ) {
          // Reconstruir el primer paso desde `from` caminando hacia atras.
          let node = { x: nx, y: ny };
          while ( true ) {
            const entry = prev.get( node.x + ',' + node.y );
            if ( entry.x === from.x && entry.y === from.y ) return entry.dir;
            node = entry;
          }
        }
        next.push( { x: nx, y: ny } );
      }
    }
    frontier = next;
  }
  return null;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Asustado: decision al azar, sin objetivo (huye erratico por los pasillos).
  if ( g.frightened ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  const target = ghostTarget( game, g );

  if ( target && g.kind === 'chaser' ) {
    // Ruta optima real (BFS). La celda que deja atras queda excluida: nunca
    // gira en U salvo que BFS falle y caiga al fallback de abajo.
    const back = { x: g.x - DIRS[ g.dir ].x, y: g.y - DIRS[ g.dir ].y };
    const step = bfsDir( grid, { x: g.x, y: g.y }, target, back );
    if ( step && choices.indexOf( step ) !== -1 ) {
      g.dir = step;
      return;
    }
  }

  if ( target ) {
    let best = choices[ 0 ];
    let bestDist = Infinity;
    for ( const dir of choices ) {
      const d = DIRS[ dir ];
      const nx = g.x + d.x;
      const ny = g.y + d.y;
      const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
      if ( dist < bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // En el mismo frame en que se activa el susto no se decide direccion: se
    // respeta la inversion unica que acaba de hacer activateFright. En los
    // frames siguientes (frightFrames < FRIGHT_FRAMES) ya decide al azar.
    if ( !( g.frightened && game.frightFrames === FRIGHT_FRAMES ) ) {
      decideGhost( game, g );
    }
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

// El fantasma comido reaparece en su celda de salida, ya en modo normal.
function respawnGhost( g, i ) {
  g.x = GHOST_STARTS[ i ].x;
  g.y = GHOST_STARTS[ i ].y;
  g.dir = 'up';
  g.frightened = false;
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Al perder una vida el ciclo de fases vuelve a empezar por dispersión.
  game.phaseIndex = 0;
  game.phaseFrames = 0;
  // El susto se cancela, la racha vuelve a 0 y los fantasmas al estado inicial.
  game.frightFrames = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.frightened = false;
    g.eatenFrames = 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function advancePhase( game ) {
  game.phaseFrames++;
  const duration = PHASE_SCHEDULE[ game.phaseIndex ][ 1 ];
  if ( game.phaseFrames >= duration ) {
    game.phaseIndex = ( game.phaseIndex + 1 ) % PHASE_SCHEDULE.length;
    game.phaseFrames = 0;
  }
}

function update( game ) {
  advancePhase( game );
  advanceFright( game );
  movePacman( game );
  game.ghosts.forEach( ( g, i ) => {
    if ( g.eatenFrames > 0 ) {
      g.eatenFrames--;
      if ( g.eatenFrames === 0 ) respawnGhost( g, i );
      return; // comido: invisible, no se mueve hasta reaparecer
    }
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( g.eatenFrames > 0 ) continue; // invisible: no colisiona

    if ( !collides( game.pacman, g ) ) continue;

    if ( g.frightened ) {
      // Fantasma asustado: se lo come Pac-Man. Racha del susto actual.
      game.score += 200 * 2 ** game.ghostCombo;
      game.ghostCombo++;
      g.eatenFrames = GHOST_RESPAWN_FRAMES;
      g.frightened = false;
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHT_BLINK = FRIGHT_BLINK;
