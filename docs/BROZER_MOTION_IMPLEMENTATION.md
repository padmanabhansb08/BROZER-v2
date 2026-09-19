# BROZER MOTION IMPLEMENTATION

## SELECTED PATTERNS & MATRIX

### 1. Mandatory Patterns (7/7)

| FUNCTION | CURRENT UI | REFERENCE | SELECTED ANIMATION | WHY | PERFORMANCE | ACCESSIBILITY | IMPLEMENTATION STATUS |
|----------|------------|-----------|--------------------|-----|-------------|---------------|-----------------------|
| Mode switching | Static buttons | React Bits | Tabs Sliding | Fast spatial awareness of ASK/ACT/DEV modes | Low | Needs clear focus state | Pending |
| Active processing | Static text | Animata | Shimmer Text | Precise active background indicator without taking up space | Low | Must pass contrast ratios | Pending |
| Command menu | Hard cuts | React Bits | Dropdown Menu Morph | Precision and fluidity for complex configs | Medium | Standard ARIA roles | Pending |
| Action validation | Text swap | Hover.dev | Like Button (Burst) | Clear affirmative feedback for bookmarks/saves | Low | `aria-pressed` | Pending |
| Agent thinking | Spinner | Aceternity | Thinking States | Transparently shows intermediate agent reasoning steps | Low | Screen reader announcements | Pending |
| Model stream | Block appear | Animata | Streaming Text | Essential for real-time model output | Medium | ARIA live regions | Pending |
| System notifications| Basic toasts| Magic UI | Banner Stacking | Saves real-estate during rapid events | Medium | Live announcements | Pending |

### 2. Additional Patterns (5/5)

| FUNCTION | CURRENT UI | REFERENCE | SELECTED ANIMATION | WHY | PERFORMANCE | ACCESSIBILITY | IMPLEMENTATION STATUS |
|----------|------------|-----------|--------------------|-----|-------------|---------------|-----------------------|
| Full Layout switches| Hard cuts | Transitions.dev| View Transitions Morph | Deeply native feel for major context changes | Low | Respect reduced-motion | Pending |
| Error feedback | Text color | Hover.dev | Shake / Deny | Universal error feedback without modal blocking | Low | Visual + text error msgs | Pending |
| Connection state | Static dot | Hover.dev | Pulse Ring | Indicates active listening/socket status calmly | Low | Decorative | Pending |
| Settings expansion | Hard cuts | Transitions.dev| Accordion Height Morph | Un-flashy way to reveal complex configuration | Low | `aria-expanded` | Pending |
| Initial data load | Blank | Transitions.dev| Skeleton Loading Fade | Calm placeholder before full DOM is ready | Low | `aria-busy` | Pending |

## IMPLEMENTATION RULES

1. **Do Not Animate Security:** 
   - Privacy/security information must never become confusing because of animation. 
   - State transition is LEVEL 0 (instant). 
   - Never hide security state.
2. **Performance Constraints:**
   - Prefer `transform` and `opacity`.
   - Avoid animating layout properties (`width`, `height`, `top`, `margin`, etc.) directly, except via robust primitives like View Transitions.
   - Avoid massive `backdrop-filter` chains and large blur radii.
3. **True Application State Only:**
   - No fake execution states or loading bars.
   - All animations must be driven by real BROZER event hooks.
4. **Accessibility Constraints:**
   - Use CSS `@media (prefers-reduced-motion: reduce)` everywhere.
   - Focus must remain correct during and after transitions.

## VALIDATION CHECKLIST

- [ ] Startup profiled
- [ ] Panel open profiled
- [ ] Mode switching profiled
- [ ] Menu open profiled
- [ ] Agent execution / 100-step profiled
- [ ] `prefers-reduced-motion` verified
- [ ] Keyboard navigation verified
- [ ] 302/302 security + regression tests passed
- [ ] 21/21 production validation passed
