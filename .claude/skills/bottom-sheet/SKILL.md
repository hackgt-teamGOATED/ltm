---
name: bottom-sheet
description: 'Build the single Reanimated bottom sheet used for chat settings, View more and the demo panel. Use when any sheet UI is needed.'
---

# Build the bottom sheet

1. One `BottomSheetHost` mounted in `client/app/_layout.tsx`; screens open sheets via a zustand store
   (`openSheet(content)`, `closeSheet()`).
2. Render as an absolutely positioned overlay in the root view with a dimmed backdrop and a panel
   animated with Reanimated `translateY` (works on web and native).
3. Close on backdrop tap, a close button, or a downward drag (gesture handler pan) past 25% of its height.
4. Respect bottom safe-area insets; max height 85% of the window; content scrolls inside.
5. Used for: chat settings, View more, the demo panel.

**Guardrails:** no bottom-sheet library; no native-only form sheets (not available on the web).
