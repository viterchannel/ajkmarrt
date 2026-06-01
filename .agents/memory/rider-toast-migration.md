---
name: Rider toast global migration
description: Pattern for replacing local useState/useRef toast timers in rider-app with the global toast() hook.
---

**rider-app** (web, React): Use `toast({ title, variant })` from the global hook.
- In page files: `import { toast } from "@/hooks/use-toast";`
- In component files: `import { toast } from "../../hooks/use-toast";` (relative)
- Call: `toast({ title: "message" })` for success, `toast({ title: "message", variant: "destructive" })` for errors

**ajkmart** (Expo, React Native): Uses its own `ToastContext` — `const { showToast } = useToast()` from `context/ToastContext.tsx`. DO NOT change these to the web `toast()` hook — the Expo app has a completely separate toast rendering system.

**Files migrated (rider-app):**
- Pages: Home.tsx, Active.tsx, Profile.tsx, Wallet.tsx, Notifications.tsx
- Components: ActiveHelpers.tsx, ActiveModals.tsx, ActiveRidePanel.tsx, ActiveOrderPanel.tsx, GoalSection.tsx, SilenceControls.tsx, ProfileSettings.tsx
- Test: GoalSection.test.tsx — remove `showToast: vi.fn()` from defaultProps when GoalSection no longer accepts the prop

**Files left with local toast (out of scope):** LoginHistory.tsx, SecuritySettings.tsx — these are secondary security pages; their local toast pattern is self-contained and not prop-drilled.

**Why:** The global `toast()` hook uses a Radix UI toast stack with de-duplication and proper ARIA roles. Local `useState` + `setTimeout` timers are error-prone (timer leaks, no de-dup, no screen-reader support).
