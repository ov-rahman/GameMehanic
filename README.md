# GAME FEEL

A tiny 8-bit / CRT styled demo of four classic platformer "game feel" mechanics.
Open `index.html` in any browser (works on desktop and mobile — layout tuned for iPhone 13).

## Modes (menu buttons)

| Button | Mechanic | What it shows |
|--------|----------|---------------|
| **VARIABLE JUMP** | Variable jump height | Hold longer → jump higher. The timer shows your hold time. |
| **COYOTE TIME** | Coyote time | You can still jump for a short window *after* running off a ledge. Timer counts up from when you left the edge. |
| **INPUT BUFFER** | Input buffer | Press jump slightly *before* landing and it still fires on touchdown. Timer shows how early you pressed (negative). |
| **FORGIVING HITBOX** | Forgiving hitboxes | Landing near a pit edge is forgiven. Timer shows how far past the real edge you were saved. |
| **ALL TOGETHER** | Everything | All four mechanics active at once. |

## Controls

- **Tap the screen** / **Space** — jump (hold for variable height). The cube lights up solid white while pressed.
- **3-finger tap** (touch) / **M** or **Esc** (desktop) — open the settings menu (CRT power-on animation).
- Picking a mode / resuming closes the menu with an old-TV power-off animation.

## Settings

The settings menu lets you switch mechanics on the fly and tune each one:
jump hold time, coyote window, input-buffer window, and hitbox forgiveness.
