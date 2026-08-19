/**
 * Small, additive design-token layer for Renata screens.
 *
 * This does NOT replace `constants/Colors.ts` (still the source of truth for
 * `Colors.primary` etc.) or NativeWind's default Tailwind spacing scale —
 * both are already used consistently across the app and stay as-is. This
 * file only fills gaps found while auditing existing screens for Phase 2:
 * no shared elevation/surface tokens, no shared corner-radius scale (call
 * sites currently mix rounded-md/-lg/-xl/-full ad hoc with no convention),
 * and no shared text-hierarchy colors beyond the single `Colors.text`.
 *
 * Deliberately small — extend it when actual screen work (Phase 3/4 Home,
 * etc.) needs a token that isn't here yet. Don't pre-build tokens nothing
 * consumes.
 */
import { Colors } from "./Colors";

/** Corner radius scale. Values match the Tailwind classes already in
 * common use, named so new code can reference intent instead of guessing
 * which of rounded-md/-lg/-xl a given surface should use. */
export const Radius = {
  /** Chips, small badges. Matches `rounded-md`. */
  sm: 6,
  /** Poster/media cards — the current de facto default. Matches `rounded-lg`. */
  md: 8,
  /** Buttons, sheets, larger elevated surfaces. Matches `rounded-xl`. */
  lg: 12,
  /** Circular buttons/avatars. Matches `rounded-full`. */
  full: 9999,
} as const;

/** Background/border tokens for page vs. elevated surfaces. */
export const Surface = {
  /** Page-level background. Same value as `Colors.background`. */
  page: Colors.background,
  /** Elevated card/sheet background — one step lighter than the page. */
  elevated: "#1c1e1f",
  /** Hairline border for elevated surfaces (matches the `border-neutral-900` already used on posters). */
  border: "rgba(255,255,255,0.08)",
} as const;

/** Text color hierarchy for content on dark surfaces. */
export const TextColor = {
  primary: Colors.text,
  secondary: "rgba(236,237,238,0.65)",
  tertiary: "rgba(236,237,238,0.4)",
  onAccent: "#ffffff",
} as const;

/** Names for the spacing steps already in common use via NativeWind's
 * default Tailwind scale (px-4, mb-2, gap-3, ...). Not a new scale —
 * just documents which 4px-multiple steps are the convention, for call
 * sites that need a raw number (e.g. inline `style`) instead of a
 * className. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
