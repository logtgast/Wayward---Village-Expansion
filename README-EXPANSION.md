# Wayward — Expansión "Pueblo y El Farol Dorado"

Expansión no invasiva para el juego **Wayward** (archivo HTML autocontenido), implementada
como un **módulo add-on** que se inyecta al final del `<body>` del HTML original. **No se
modificó ni una línea del código del juego**; toda la expansión vive en un namespace propio
(`state.wexp`) y en una capa de UI propia: un **panel Village dentro de la sección
House** del frontend y las **acciones del personaje en el panel Actions**.

## Qué añade

Conforme al brief (`BRIEF.md`), fases 1–5:

| Sistema | Detalle |
|---|---|
| **Visitar Pueblo (Visit City)** | Botón junto a "Go out…" en la columna/pestaña de acciones. Disponible en preparación y cierre (no en servicio, no con recado pendiente, no con evento abierto). Auto-retorno a la taberna a las 2 a.m. |

**Dónde está la UI** (integrada en el frontend del juego, sin menús aparte):

- **Entrada:** en el panel **Actions**, debajo de "Go out…", aparece el botón **"Visit City"** (solo cuando "Go out…" está activo, fase de preparación/cierre). En móvil, la pestaña **"house"** de la barra inferior pasa a llamarse **"Village"**.
- **Panel Village (sección House):** al visitar la ciudad, la sección House del juego se cubre con un panel opaco al estilo del mapa de habitaciones: cada ubicación (6 tiendas, casa de la amiga, 2 paseos, Hiring Hall, El Farol Dorado) es una **tarjeta de habitación** clicable, con chip de abierto/cerrado y resaltado azul de "estás aquí". Nada de listas verticales ni overlay flotante.
- **Compañía:** al salir sola aparece solo el mapa de la villa; con la esposa (o un empleado) se añade una franja superior con su nombre, estado de ánimo y energía. "Walk with…" / "Part ways" viven en Actions; abrir un paseo con la esposa invita automáticamente.
- **Acciones en Actions:** los verbos del personaje (comprar/regatear/vender en tiendas, hablar con la amiga, acciones del paseo, restaurar salas, apostar, robar/bancar tesorería, "Head home") se renderizan **en el panel Actions del juego**, no en el panel de información.
- **Navegación:** "← Village" / "Head home ⌂" en la cabecera del panel y en Actions. El botón "Visit City" pasa a "You are in town" durante la visita y vuelve al entrar de nuevo.
- Si el panel House del juego no se encuentra (DOM inesperado), la expansión degrada automáticamente al overlay flotante anterior.
| **6 tiendas + Clothier** | Herbalista, Carnicero, Cervecero, Boticario, Mercado y Librero: destinos únicos (escena, no grafo de salas). Precios con recargo sobre el precio base del juego (`un[id].price`), reposición diaria por rareza, ofertas ×5/×10, regateo 1 vez por visita (carisma/ingenio), reventa al 50–60%. El **Sastre (Clothier)** se conserva intacto: su tarjeta enlaza al flujo original "Go out…". |
| **Amiga de Pippa** | Visita a su casa (procedural, persistente en el save). Sube ánimo y vínculo; salida con cooldown diario y bloqueo si está agotada. |
| **2 salidas en pareja** | Paseo y excursión: avanzan el reloj, cuestan oro, suben el ánimo de la esposa, con cooldown. |
| **Empleo** | 12 puestos (taberna + casino). Candidatos 21+, pool de 4–6 renovado cada semana, salario de firma, nómina semanal (tesorería del casino primero, luego oro), progreso de habilidad/moral diario, un puesto por empleado, despido. |
| **Casino "El Farol Dorado"** | Compra por **12.500g** en estado ruinoso. 3 salas de juego (cartas 900g, dados 700g, mesa 700g) con apuestas escalonadas y mejora de nivel (500g); operaciones de planta (recepción 600, bar 800, oficina 400, seguridad 500, sala de personal 350); sótano (almacén 400, tesorería 500). **Tesorería propia** con libro mayor (ledger) por categorías y transferencias exactas hacia/desde el oro central (recoger / depositar). |
| **Hotel** | 3 plantas × 3 habitaciones (400g c/u) + **suite** (1.200g) = tope de **10**. Al comprar, solo la h1 está operativa. Operación nocturna: huéspedes, limpieza (gobernantas), quejas, mantenimiento. |
| **Escenario y lounge** | Escenario (1.400g) con espectáculo nocturno; lounge opt-in (1.200g). Reglas de consentimiento: la bailarina solo actúa si acepta (`privateOk`), 40% de participación, y **se niega si su moral < 40**. |
| **3 minijuegos** | *One-and-Twenty* (veintiuna: crupier se planta en 17, natural paga 3:2), *Cast the Bones* (dados: bajo/7 sobre paga 2.2×, 7 duro 5×), *Nine Men's Morris* (reglas completas de colocar/mover/quitar con IA heurística; victoria paga 2× la apuesta). |

## Instalación

Reemplaza tu archivo del juego por **`wayward-expanded.html`** y ábrelo como siempre.
No hay dependencias ni conexión necesaria. En consola seguirá existiendo `window.wayward`
y se añade `window.waywardExpansion` (API de depuración de la expansión).

Para regenerar el build tras editar `src/wayward-expansion.js`:

```bash
node --check src/wayward-expansion.js
node tests/expansion.test.js          # 63 aserciones de lógica (§9 del brief)
node tests/dom.test.js                # 37 aserciones de la UI (panel Village + Actions)
node tests/ui-walk.js                 # recorrido ciego de ~70 clics del panel (detector de crashes)
node tests/e2e-jsdom.js               # E2E: juego REAL en jsdom — nueva partida, Visit City, compra, casino
node tools/build.js                   # (opcional) re-ensambla wayward-expanded.html
```

O manualmente: inserta el contenido de `src/wayward-expansion.js` en un `<script>` justo
antes de `</body>` de `wayward-baseline.html`.

## Compatibilidad de partidas (saves)

- El estado vive en la clave de primer nivel `state.wexp` dentro del mismo persist de
  zustand (`localStorage["tavern-game"]`), así que **se guarda y recarga solo**.
- Las partidas existentes **no se pierden**: `ensureWexp()` rellena valores por defecto
  sin tocar nada del juego (la mezcla del juego no elimina claves desconocidas).
- Nueva partida / wexp borrada → un guardián (intervalo de 2,5 s) la regenera.
- Copia de seguridad de la expansión en `localStorage["tavern-game-expansion"]`
  (sombra); si el save principal pierde `wexp`, se restauran solo esos datos.
- Cada empleado/candidato/amiga guardan su propia `edad` (siempre 21+).

## Decisiones de diseño

- **Estrategia add-on vs. desofuscación** (§10 del brief): el bundle está minificado y sin
  árbol fuente refactorizable; desarmarlo para editar en sitio habría sido frágil y
  propenso a romper partidas. El módulo nunca parchea funciones del juego: solo **lee**
  su estado vía la API oficial de consola (`window.wayward`), **escribe** vía
  `edit()` (clon + push de undo), y añade nodos DOM nuevos (nunca elimina nodos de React).
- Reutilización estricta de claves del juego: `stillroom.ingredients`, `stillroom.cups`,
  `stillroom.known`, `stillroom.lore`, `supplies.food/beer/wine`, `economy.gold`,
  habilidades `PV`, horas de tienda, etc. Nada de inventarios paralelos.
- El reloj del juego se auto-corrige al siguiente acto del jugador, así que adelantar
  `slot` (salidas, visitas, partidas) es seguro.

## Riesgos conocidos

- Si el juego cambia nombres internos (p. ej. `window.wayward`), la expansión degrada con
  mensajes de guardia en consola en lugar de romper el juego.
- El E2E (`tests/e2e-jsdom.js`) ejecuta el bundle real del juego dentro de jsdom: partida
  nueva con Pippa, visita a la ciudad, compra en tienda y compra del casino verificados
  end-to-end con 0 errores de consola. jsdom no es un navegador completo (sin layout
  visual), pero el flujo lógico y la inyección DOM quedan cubiertos.
- Detalle de integración descubierto en el E2E: `started` vive en el store de zustand, no
  en `state`; el guardián usa una señal DOM (nodos inyectados presentes) en su lugar, y el
  stock de las tiendas se repone de forma persistente dentro de `edit()` al entrar.

## Estructura del repo

```
wayward-baseline.html    copia intacta del juego original
wayward-expanded.html    ENTREGABLE: juego + expansión inyectada
src/wayward-expansion.js módulo completo (~2.050 líneas, 13 secciones)
tests/expansion.test.js  harness: 63 aserciones de los tests de aceptación (§9)
tests/dom.test.js        UI verificada contra un DOM simulado (37 aserciones: panel + acciones)
tests/ui-walk.js         recorrido ciego de ~70 clics del panel (detector de crashes)
tests/e2e-jsdom.js       E2E con el bundle real del juego en jsdom (partida nueva → Visit City → compras → casino)
bundle.js                script inline extraído del HTML original (solo para auditoría/tests)
BRIEF.md                 especificación original del proyecto
```
