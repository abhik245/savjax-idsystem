# NexID Enterprise Design System (v1)

## Brand Direction
- Personality: Premium, precise, futuristic, calm.
- Visual metaphor: Command center with layered depth.
- Motion language: Confident, not noisy.

## Color Tokens
- `bg.base`: `#070B14`
- `bg.elevated`: `#0F172A`
- `bg.glass`: `rgba(15, 23, 42, 0.58)`
- `text.primary`: `#E6EDFF`
- `text.muted`: `#8EA0C7`
- `line.soft`: `rgba(112, 143, 210, 0.24)`
- `accent.start`: `#2F7CFF`
- `accent.end`: `#7C4DFF`
- `accent.success`: `#22C55E`
- `accent.warning`: `#F59E0B`
- `accent.danger`: `#F43F5E`

## Typography
- Font family: `Inter` (UI), fallback `system-ui`.
- Headings:
  - H1: 44/52, 700
  - H2: 32/40, 700
  - H3: 24/32, 600
- Body:
  - Large: 18/28, 500
  - Base: 14/22, 400
  - Small: 12/18, 500

## Radius
- Global control radius: `16px`
- Chip radius: `999px`
- Inner controls: `12px`

## Shadow + Blur
- Glass card:
  - Border: `1px solid rgba(126, 157, 228, 0.24)`
  - Backdrop blur: `14px`
  - Shadow: `0 20px 60px rgba(2, 8, 23, 0.45)`

## Spacing Scale
- Base spacing unit: `4px`
- Core steps: `4, 8, 12, 16, 20, 24, 32, 40, 48`

## Motion
- Page transition: `280ms`, `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Micro interaction: `180ms`, `ease-out`
- Hover lift: `translateY(-2px)`
- Focus glow: `0 0 0 3px rgba(47, 124, 255, 0.28)`

## Component Rules
- Never render blank data regions: use skeletons.
- All primary CTA buttons use accent gradient.
- Inputs always use floating labels and focus glow.
- Tables use virtualization/pagination in high-volume views.

