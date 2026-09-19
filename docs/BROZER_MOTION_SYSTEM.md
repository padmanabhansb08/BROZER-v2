# BROZER MOTION SYSTEM

## MOTION PRINCIPLES

1. **Fast for interaction**: Any user-initiated action (hover, click, select) must feel instantaneous (<150ms).
2. **Calm during reasoning**: Background work and AI processing should not distract the user. Subtle, predictable movement is preferred.
3. **Clear during execution**: When an action is taken on the user's behalf, the transition of state should be easily understandable.
4. **Stronger feedback for completion/error**: Success and failure states need definitive, unmistakable visual feedback to prevent user doubt.
5. **Minimal animation for security events**: Privacy and security information must never become confusing because of animation. State changes must be instant or near-instant.
6. **No unnecessary continuous motion**: Stop all background animations when not actively serving a communicative purpose.
7. **Reduced-motion support**: All animations must gracefully degrade or disable when `prefers-reduced-motion` is enabled.
8. **No animation that blocks functionality**: A user should never have to wait for an animation to finish to take the next action.

## MOTION LEVELS

### LEVEL 0
**No animation.**
- Immediate state cuts.
- Used for: Security alerts, sensitive data sanitization, critical error states, and all core logic that must not be delayed.

### LEVEL 1
**Micro interaction.**
- Fast, subtle visual changes on user input (<150ms).
- Used for: Hover states, button clicks, toggle switches, tab selection.
- Properties: Color, opacity, subtle scale (98% to 100%).

### LEVEL 2
**State transition.**
- Smooth layout morphs or content swaps (<300ms).
- Used for: Opening sidebars, expanding accordions, modal appearances, command menu morphing.
- Properties: Transform, opacity, layout morph (view transitions).

### LEVEL 3
**Important feedback.**
- Distinct visual cues requiring user attention.
- Used for: Task completion (Like Button/Burst), minor warnings, active listening (Pulse Ring).
- Properties: Translate, scale, background-position.

### LEVEL 4
**Major task transition.**
- Significant UI reorganizations.
- Used for: Moving from configuration to active monitoring, page observation sweeps.
- Properties: Multi-element choreography (Staggered entrances).

## GUIDELINES
- **BROZER should spend most of its time at LEVEL 1–2.**
- The UI should feel FAST, PRECISE, CALM, INTELLIGENT, TECHNICAL, and TRUSTWORTHY.
- It should NOT feel FLASHY, GAMIFIED, OVER-ANIMATED, or MARKETING-LANDING-PAGE-LIKE.
