# apps/web Apple Design Engineering UI/UX Audit Report

## 1. Observation

A complete, exhaustive read-only inspection of `apps/web` was conducted across all 8 pages, 51 components, global stylesheets, design tokens, and build configurations.

### 1.1 Tool Commands & Test Baseline
- **Unit & Component Tests**: Executed `pnpm --filter web test`. Output: 79 test files passed, 453 tests passed.
- **Static Linter**: Executed `pnpm --filter web lint`. Output: 0 errors, 16 minor unused-import/warning diagnostics.
- **Package Manifest**: `apps/web/package.json` contains `react: 19.2.8`, `tailwindcss: 3.4.19`, `lucide-react: 1.31.0`. `tailwindcss-animate` is **absent** from `dependencies` and `devDependencies`.
- **Tailwind Configuration**: `apps/web/tailwind.config.js` specifies `plugins: []`. `backdropBlur` and `spacing` are unextended.

---

### 1.2 Catalog of Code-Grounded Findings

#### ISS-FEEL-01: Broken / Phantom Animations from Uninstalled Tailwind CSS Animate Plugin
- **Severity**: P0 - Critical
- **Relative Path**: `apps/web/src/components/RiderProfileDrawer.tsx:39, 46`, `apps/web/src/components/common/ConfirmModal.tsx:55, 57`, `apps/web/src/components/goals/EditGoalsModal.tsx:57, 64`, `apps/web/src/components/upload/PairingModal.tsx:64`, `apps/web/src/pages/AICoach.tsx:66`, `apps/web/src/components/profile/MemoryItemCard.tsx:92`, `apps/web/src/components/common/SyncStatusBar.tsx:122`
- **Violated Apple UI Principle**: *The Feel — Fluid Motion & Interruptibility*
- **Existing Code**:
```tsx
// RiderProfileDrawer.tsx:39, 46
<div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in">
  <div className="... animate-in slide-in-from-right duration-200 ...">

// ConfirmModal.tsx:55, 57
<div className="... bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
  <div className="... animate-in zoom-in-95 duration-200 ...">
```
- **Analysis**: Classes `animate-in`, `fade-in`, `zoom-in-95`, `slide-in-from-right` are `tailwindcss-animate` utilities. Because the plugin is not installed and `plugins: []` is empty in `tailwind.config.js`, these classes are dead no-ops. Modals and drawers pop into existence with zero enter animation. Additionally, on close, `if (!isOpen) return null;` immediately drops them from the DOM with zero exit transition.
- **Production-Ready Replacement**:
Add a dedicated keyframe/transition layer in `apps/web/src/index.css` or `tailwind.config.js` with Apple standard sheet springs (`cubic-bezier(0.32, 0.72, 0, 1)`):
```css
/* apps/web/src/index.css */
@keyframes appleDrawerSlideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes appleModalPopIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes appleFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.apple-drawer-enter {
  animation: appleDrawerSlideIn 320ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}
.apple-modal-enter {
  animation: appleModalPopIn 260ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}
.apple-scrim-enter {
  animation: appleFadeIn 220ms ease-out forwards;
}
```

---

#### ISS-MAT-01: Complete Absence of `prefers-reduced-motion` and `prefers-reduced-transparency` System Fallbacks
- **Severity**: P0 - Critical
- **Relative Path**: `apps/web/src/index.css:1-206`, `apps/web/src/components/MobileTabBar.tsx:20`, `apps/web/src/components/common/MapFloatingControls.tsx:21`, `apps/web/src/components/dashboard/DashboardControls.tsx:76`
- **Violated Apple UI Principle**: *Materials, Depth & Typography — Reduced Motion & Accessibility*
- **Existing Code**:
`apps/web` contains zero occurrences of `@media (prefers-reduced-motion)` and zero occurrences of `@media (prefers-reduced-transparency)` across all CSS and TSX files.
- **Analysis**: Apple human interface guidelines mandate that when a user requests "Reduce Motion" or "Reduce Transparency" in operating system settings, user interfaces must eliminate high-velocity transitions and replace blurry translucent materials with opaque, high-contrast backdrops.
- **Production-Ready Replacement**:
Add system accessibility overrides to `apps/web/src/index.css`:
```css
/* apps/web/src/index.css */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .backdrop-blur,
  .backdrop-blur-sm,
  .backdrop-blur-md,
  .backdrop-blur-lg,
  .backdrop-blur-xl {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .bg-white\/90,
  .bg-white\/95,
  .bg-white\/80 {
    background-color: #FFFFFF !important;
  }
  .bg-slate-900\/40,
  .bg-slate-950\/40,
  .bg-slate-900\/60 {
    background-color: rgba(15, 23, 42, 0.85) !important;
  }
}
```

---

#### ISS-LOOK-01: Asymmetric Action Icons Lacking Optical Center of Mass Compensation
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/common/IconButton.tsx:38-48`, `apps/web/src/pages/PeriodicReports.tsx:76, 90`, `apps/web/src/components/activities/ActivitiesTableView.tsx:89-91`, `apps/web/src/components/routes/RouteCardItem.tsx:49`
- **Violated Apple UI Principle**: *The Look — Optical Alignment (Geometric Center ≠ Visual Center)*
- **Existing Code**:
```tsx
// IconButton.tsx:38
<button
  className={`inline-flex shrink-0 items-center justify-center rounded-lg ${SIZE_CLASSES[size]} ...`}
>
  {children}
</button>

// PeriodicReports.tsx:75-91
<IconButton label="上一周期" size="sm" onClick={handlePrevPeriod}>
  <ChevronLeft className="w-3.5 h-3.5" />
</IconButton>
<IconButton label="下一周期" size="sm" onClick={handleNextPeriod} disabled={isLatest}>
  <ChevronRight className="w-3.5 h-3.5" />
</IconButton>

// ActivitiesTableView.tsx:89-91
<div className="w-5 text-center text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
  <ChevronRight className="w-3.5 h-3.5 inline-block" aria-hidden="true" />
</div>
```
- **Analysis**: A directional chevron or arrow is geometrically asymmetric: `ChevronLeft` has its vertex on the left with mass distributed across its right arms; `ChevronRight` has its vertex on the right with mass on the left. Using pure `items-center justify-center` centers them mathematically on their bounding box, which leaves negative space on the vertex side, causing them to look visibly skewed towards their heavier side.
- **Production-Ready Replacement**:
Update `IconButton.tsx` and callers with optical offsets:
```tsx
// apps/web/src/components/common/IconButton.tsx
export default function IconButton({
  label,
  size = 'md',
  danger = false,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`
        inline-flex shrink-0 items-center justify-center rounded-button
        ${SIZE_CLASSES[size]}
        transition-colors duration-150 cursor-pointer
        active:scale-[0.96] active:transition-transform active:duration-75
        ${
          danger
            ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/70'
        }
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500
        disabled:active:scale-100
        ${className}
      `}
      {...rest}
    >
      {children}
    </button>
  );
}

// In PeriodicReports.tsx:
<IconButton label="上一周期" size="sm" onClick={handlePrevPeriod}>
  <ChevronLeft className="w-3.5 h-3.5 -translate-x-[0.5px]" />
</IconButton>
<IconButton label="下一周期" size="sm" onClick={handleNextPeriod} disabled={isLatest}>
  <ChevronRight className="w-3.5 h-3.5 translate-x-[0.5px]" />
</IconButton>
```

---

#### ISS-LOOK-02: Modal Alert Triangle Icon Visually Dropped Inside Circular Container
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/common/ConfirmModal.tsx:60-64`
- **Violated Apple UI Principle**: *The Look — Visual Weight Balance vs. Negative Space*
- **Existing Code**:
```tsx
// ConfirmModal.tsx:60-64
{isDanger && (
  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
    <AlertTriangle className="w-4 h-4 text-rose-600" />
  </div>
)}
```
- **Analysis**: An upward-pointing triangle has 70% of its visual mass in the lower half. Mathematical centering (`flex items-center justify-center`) inside a circular badge places the centroid too low relative to the circular boundary, creating excessive negative space at the top and making the icon appear to "sag" downwards.
- **Production-Ready Replacement**:
```tsx
// apps/web/src/components/common/ConfirmModal.tsx:60-64
{isDanger && (
  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
    <AlertTriangle className="w-4 h-4 text-rose-600 -translate-y-[1px]" aria-hidden="true" />
  </div>
)}
```

---

#### ISS-LOOK-03: Eccentric Spinning Luggage Tag Icon During AI Title Generation
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/ride-detail/RideTitleHeader.tsx:138`
- **Violated Apple UI Principle**: *The Look — Visual Center & Optical Geometry*
- **Existing Code**:
```tsx
// RideTitleHeader.tsx:138
<Tag className={`w-3.5 h-3.5 ${isSuggestingTitle ? 'animate-spin text-slate-900' : 'text-slate-500'}`} aria-hidden="true" />
```
- **Analysis**: The `Tag` icon has an asymmetric loop and diagonal wedge. Rotating an asymmetric shape with `animate-spin` causes the geometric origin to wobble aggressively off the visual center, creating an unpolished, jarring visual vibration. A spinning progress indicator must be a radially symmetric loader (`Loader2`).
- **Production-Ready Replacement**:
```tsx
// apps/web/src/components/ride-detail/RideTitleHeader.tsx:138
import { Edit2, Check, X, Tag, Loader2 } from 'lucide-react';
...
{isSuggestingTitle ? (
  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" aria-hidden="true" />
) : (
  <Tag className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
)}
```

---

#### ISS-LOOK-05: Systematic Nested Curvature Pinching & Concentric Radius Violations
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/dashboard/DashboardControls.tsx:111`, `apps/web/src/pages/PeriodicReports.tsx:74-92`, `apps/web/src/components/upload/FileUpload.tsx:78, 103`, `apps/web/src/components/goals/EditGoalsModal.tsx:64, 105`, `apps/web/src/components/upload/PrivacyZoneList.tsx:12, 38`
- **Violated Apple UI Principle**: *The Look — The Golden Set for Curves & Concentric Radii ($R_{inner} = \max(0, R_{outer} - padding)$)*
- **Existing Code**:
```tsx
// DashboardControls.tsx:111
<div className="... rounded-lg border border-slate-200 p-1 space-y-0.5 ...">
  <button className="... rounded-md ...">

// PeriodicReports.tsx:74-92
<div className="flex items-center space-x-1 border border-slate-200 rounded p-0.5 bg-white">
  <IconButton size="sm" ...> {/* IconButton is hardcoded to rounded-lg (8px) */}
  <button className="... rounded ...">

// FileUpload.tsx:78, 103
<div className="... rounded-2xl ...">
  <div className="w-14 h-14 rounded-2xl bg-white ...">
```
- **Analysis**: Apple curvature continuity requires nested shapes to follow concentric geometry: $R_{inner} = R_{outer} - padding$. In `DashboardControls`, $R_{outer} = 8px$, $padding = 4px$, so $R_{inner}$ must be $4px$ (`rounded`), but is set to $6px$ (`rounded-md`), causing inner button corners to pinch towards the outer border. In `PeriodicReports`, outer container is $4px$ (`rounded`), but contains an `IconButton` hardcoded to $8px$ (`rounded-lg`), creating an inverted bulging corner. In `FileUpload`, an inner 56px icon box uses `rounded-2xl` (16px), matching the 260px container, resulting in an overly bulbous inner pill shape.
- **Production-Ready Replacement**:
```tsx
// DashboardControls.tsx:111
// Outer: rounded-lg (8px), padding: p-1 (4px) -> Inner: rounded (4px)
<div className="absolute right-0 mt-1.5 w-36 bg-white rounded-lg border border-slate-200 p-1 space-y-0.5 shadow-lg z-20">
  <button className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ...">

// PeriodicReports.tsx:74-92
// Outer: rounded-lg (8px), padding: p-1 (4px) -> Inner: rounded-md (6px) or rounded-button (6px)
<div className="flex items-center space-x-0.5 border border-slate-200 rounded-lg p-1 bg-white">
  <IconButton label="上一周期" size="sm" className="rounded-md" onClick={handlePrevPeriod}>
```

---

#### ISS-LOOK-06: Non-Existent Tailwind Classes (`p-4.5`, `py-0.2`) Silently Breaking Component Padding
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/profile/ManualProfileTab.tsx:19, 84`, `apps/web/src/components/profile/AIGatewayConfigTab.tsx:60`, `apps/web/src/components/activities/ActivitiesTableView.tsx:60`, `apps/web/src/components/goals/GoalEvolutionTimeline.tsx:68, 75`, `apps/web/src/components/RiderProfileDrawer.tsx:105`, `apps/web/src/components/profile/MemoryItemCard.tsx:72`
- **Violated Apple UI Principle**: *The Look — Negative Space Compensation & Visual Rhythm*
- **Existing Code**:
```tsx
// ManualProfileTab.tsx:19
<div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">

// ActivitiesTableView.tsx:60
<span className="text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
```
- **Analysis**: Standard Tailwind CSS v3 does not include `p-4.5` or `py-0.2`. Because they are not defined in `tailwind.config.js`, the CSS compiler ignores them. The profile cards render with `0px` internal padding (causing content to touch border strokes), and status badges render with `0px` vertical padding, causing text baselines to crash into border lines.
- **Production-Ready Replacement**:
Replace `p-4.5` with `p-[18px]` (or `p-4 sm:p-5`); replace `py-0.2` with `py-[1px]` or `py-0.5`.
```tsx
// ManualProfileTab.tsx:19, 84
<div className="bg-slate-50/80 rounded-2xl p-[18px] border border-slate-200/80 space-y-3.5 shadow-2xs">

// ActivitiesTableView.tsx:60
<span className="text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-[1px] rounded shrink-0">
```

---

#### ISS-FEEL-02: Total Lack of Instant Pointerdown Feedback Across Interactive Controls
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/common/IconButton.tsx:38-48`, `apps/web/src/components/common/ConfirmModal.tsx:87-101`, `apps/web/src/components/ride-detail/RideHeaderToolbar.tsx:40-68`, `apps/web/src/components/RideCard.tsx:93`, `apps/web/src/components/activities/ActivitiesTableView.tsx:53`, `apps/web/src/components/routes/RouteCardItem.tsx:24`
- **Violated Apple UI Principle**: *The Feel — Interaction Latency (pointerdown vs click delay)*
- **Existing Code**:
```tsx
// RideHeaderToolbar.tsx:42
<button
  onClick={onExportGPX}
  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[13px] rounded-md transition-colors cursor-pointer ..."
>

// RideCard.tsx:93
<Link
  to={`/ride/${ride.id}`}
  className={`block bg-white rounded-lg p-4 transition-all group relative border ${...}`}
>
```
- **Analysis**: Apple interaction design requires direct tactile feedback to occur immediately upon `pointerdown` rather than after finger release (`pointerup`/`click`). Components currently rely purely on `hover:bg-*` and `transition-colors`, with no `:active` scale depression or physical touch feedback.
- **Production-Ready Replacement**:
Add standard physical active states:
```tsx
// In buttons and toolbar controls:
className="... transition-all duration-150 active:scale-[0.97] active:bg-slate-200/70"

// In RideCard.tsx:93
className="... transition-transform duration-150 active:scale-[0.99] active:bg-slate-50/80 cursor-pointer"
```

---

#### ISS-FEEL-04: Pseudo Mobile Bottom Sheet Lacking Direct Manipulation, Gesture Tracking, and Velocity Handoff
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/pages/Dashboard.tsx:94`, `apps/web/src/pages/RideDetail.tsx:144`
- **Violated Apple UI Principle**: *The Feel — Direct Manipulation, Rubber-Banding & Velocity Handoff*
- **Existing Code**:
```tsx
// Dashboard.tsx:94
<aside className="w-full h-[50dvh] lg:h-full lg:w-[460px] xl:w-[480px] bg-white flex flex-col z-10 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 absolute bottom-0 lg:static lg:bottom-auto rounded-t-2xl lg:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:shadow-none transition-transform">
```
- **Analysis**: The mobile dashboard panel is styled to resemble an iOS Apple Maps sheet (`rounded-t-2xl`, `shadow-[0_-10px_40px_rgba(0,0,0,0.1)]`), but is completely static at `h-[50dvh]`. It has no drag pill handle, no touch gesture handlers, no snap detents (collapsed: 18%, half: 50%, expanded: 88%), no boundary rubber-banding, and no velocity handoff upon gesture release. It permanently obstructs 50% of the map on phones without allowing user expansion or collapse.
- **Production-Ready Replacement**:
Introduce a gesture-driven sheet hook with pointer tracking and velocity projection:
```tsx
// Mobile drag handle and touch tracking container
<div className="lg:hidden w-full flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
     onPointerDown={handleSheetPointerDown}>
  <div className="w-9 h-1 rounded-full bg-slate-300 active:bg-slate-400 transition-colors" />
</div>
```

---

#### ISS-MAT-02: Over-Opaque Translucent Materials & Non-Existent `backdrop-blur-xs` Utility
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/components/dashboard/DashboardControls.tsx:76`, `apps/web/src/components/dashboard/CitySwitcher.tsx:54`, `apps/web/src/components/goals/EditGoalsModal.tsx:57`, `apps/web/src/components/RiderProfileDrawer.tsx:39`
- **Violated Apple UI Principle**: *Materials, Depth & Typography — Translucency & Hierarchy*
- **Existing Code**:
```tsx
// DashboardControls.tsx:76
className="... bg-white/95 backdrop-blur-md rounded-lg ..."

// EditGoalsModal.tsx:57
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 ...">
```
- **Analysis**: `bg-white/95 backdrop-blur-md` is 95% opaque, which renders the background blur visually invisible while still incurring full GPU compositor blur overhead during map movement. Meanwhile, `backdrop-blur-xs` is invalid in Tailwind CSS, resulting in zero backdrop blur on modal scrims.
- **Production-Ready Replacement**:
Calibrate translucent materials to Apple Vibrancy specifications:
```tsx
// In floating controls:
className="... bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm ..."

// In modal backdrops:
className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 ..."
```

---

#### ISS-MAT-03: White Text Blooming on High-Contrast Dark Surfaces & Missing Antialiasing
- **Severity**: P1 - High
- **Relative Path**: `apps/web/src/pages/AICoach.tsx:66`, `apps/web/src/components/ConsistencyHeatmap.tsx:137`, `apps/web/src/components/chat/ChatMessageItem.tsx:47`, `apps/web/src/components/upload/PairingModal.tsx:63`
- **Violated Apple UI Principle**: *The Look & Typography — Dark Mode Bleeding & Optical Compensation*
- **Existing Code**:
```tsx
// AICoach.tsx:66
<div className="... bg-brand-900 text-white p-3.5 rounded border border-brand-800 ... font-mono">
  <div className="text-xs font-medium leading-tight">{toast.title}</div>
  <p className="text-[11px] text-slate-400 truncate mt-0.5">{toast.desc}</p>
</div>

// ConsistencyHeatmap.tsx:137
<div className="absolute top-2 right-4 bg-brand-900 text-white text-xs font-mono px-2.5 py-1 rounded ...">
```
- **Analysis**: On dark backgrounds (`#162343`), pure white text (`#FFFFFF`) appears visually bolder and bleeds/blooms into surrounding dark pixels due to Mach band effects and retina font rasterization. Apple typography guidelines require reducing font weight and applying `-webkit-font-smoothing: antialiased` with subtle tinting (`text-slate-100` / `text-white/90`) on dark surfaces.
- **Production-Ready Replacement**:
```tsx
// In dark banners, toasts, and tooltips:
className="... bg-brand-900 text-slate-100/90 text-xs font-normal antialiased tracking-wide font-mono ..."
```

---

#### ISS-LOOK-04: Inconsistent Telemetry Units and Stroke Weight Imbalance
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/RideCard.tsx:127-154`, `apps/web/src/components/common/MapFloatingControls.tsx:37, 45`
- **Violated Apple UI Principle**: *The Look — Visual Weight Balance & Optical Hierarchy*
- **Existing Code**:
```tsx
// RideCard.tsx:127-154
// Metric 1: Distance
<div className="font-semibold text-slate-900 text-sm tabular-nums flex items-baseline">
  <span>{distanceKm}</span>
  <span className="text-[10px] font-normal text-slate-400 ml-0.5 font-sans">公里</span>
</div>
// Metric 2: Speed
<div className="font-semibold text-slate-900 text-sm tabular-nums flex items-baseline">
  <span>{movingAvgSpeedKmh}</span>
  <span className="text-[10px] font-normal text-slate-400 ml-0.5">km/h</span>
</div>
// Metric 3: Ascent
<div className="font-semibold text-slate-700 text-sm tabular-nums">
  <span>{ride.total_ascent_meters || 0}m</span>
</div>

// MapFloatingControls.tsx:37, 45
<Plus className="w-4 h-4" aria-hidden="true" />
<Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
```
- **Analysis**: In `RideCard`, three adjacent telemetry metrics have inconsistent styling: Metric 1 has a separate font-sans unit span; Metric 2 has a separate unit without font-sans; Metric 3 has no unit span, embedding `m` directly in the number string with a different font color (`text-slate-700` vs `text-slate-900`). In `MapFloatingControls`, `Plus` uses default strokeWidth 2 while `Minus` uses strokeWidth 2.5, creating a jarring 25% thickness disparity between adjacent controls.
- **Production-Ready Replacement**:
```tsx
// RideCard.tsx:
<div className="font-semibold text-slate-900 text-sm tabular-nums flex items-baseline">
  <span>{ride.total_ascent_meters || 0}</span>
  <span className="text-[10px] font-normal text-slate-400 ml-0.5 font-sans">m</span>
</div>

// MapFloatingControls.tsx:
<Minus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
```

---

#### ISS-LOOK-07: Proximity Violations in Display Telemetry, Table Columns, and Composer Chips
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/TotalStatsCard.tsx:37-40`, `apps/web/src/components/activities/ActivitiesTableView.tsx:31-79`, `apps/web/src/components/chat/ChatComposer.tsx:41-49`
- **Violated Apple UI Principle**: *The Look — Proximity as Syntax ($Distance_{internal} < Distance_{external}$)*
- **Existing Code**:
```tsx
// TotalStatsCard.tsx:37-40
<div className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mt-1 font-mono tabular-nums flex items-baseline">
  <span>{displayDistance}</span>
  <span className="text-xs font-normal ml-1.5 text-slate-400 font-sans">公里</span>
</div>

// ActivitiesTableView.tsx:31-79
// Table Header: w-20, space-x-6
<div className="flex items-center space-x-6 text-right tabular-nums">
  <div className="w-20">距离</div>
  <div className="w-20 hidden sm:block">停表均速</div>
  ...
// Data Rows: w-16, space-x-4
<div className="flex items-center space-x-4 text-right font-mono text-xs text-slate-600 tabular-nums">
  <div className="w-16 font-semibold text-slate-900">...</div>
  <div className="w-16 hidden sm:block">...</div>
```
- **Analysis**: In `TotalStatsCard`, `ml-1.5` (6px) between a 36px number and its unit is excessively loose, detaching the unit from the numeral. In `ActivitiesTableView`, table headers use `w-20` (80px) and `space-x-6` (24px) while data rows use `w-16` (64px) and `space-x-4` (16px), causing the table columns to visually drift and misalign from their corresponding column headers.
- **Production-Ready Replacement**:
```tsx
// TotalStatsCard.tsx:
<span className="text-xs font-normal ml-1 text-slate-400 font-sans -translate-y-[0.5px]">公里</span>

// ActivitiesTableView.tsx:
// Align row columns to w-20 and space-x-6 to match header exactly:
<div className="flex items-center space-x-6 text-right font-mono text-xs text-slate-600 tabular-nums">
  <div className="w-20 font-semibold text-slate-900">{distKm} ...</div>
  <div className="w-20 hidden sm:block">{ride.avg_speed_kmh ...}</div>
  <div className="w-20 hidden md:block">{ride.total_ascent_meters ...}</div>
  <div className="w-20 text-slate-500">{duration}</div>
```

---

#### ISS-LOOK-08: Uncalibrated Raw Black Alpha Styling in Chart Component
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/ride-detail/RideElevationSpeedChart.tsx:82, 86, 94`
- **Violated Apple UI Principle**: *The Look — Material & Color Token Integrity*
- **Existing Code**:
```tsx
// RideElevationSpeedChart.tsx:82, 86, 94
<div className="pt-4 space-y-6 border-t border-black/10 mt-6">
  <h3 className="text-[15px] font-medium text-black flex items-center space-x-1.5 font-sans">
    <Gauge className="w-4 h-4 text-black/64" />
  <span className="text-[12px] text-black/44">实测逐点数据</span>
```
- **Analysis**: While the rest of `apps/web` uses structured Slate and Brand design tokens, `RideElevationSpeedChart` introduces raw uncalibrated CSS alpha values (`text-black`, `text-black/64`, `text-black/44`, `border-black/10`), creating a discordant grey tone and breaking palette unity.
- **Production-Ready Replacement**:
```tsx
<div className="pt-4 space-y-6 border-t border-slate-200/80 mt-6">
  <h3 className="text-[15px] font-semibold text-slate-900 flex items-center space-x-1.5 font-sans">
    <Gauge className="w-4 h-4 text-slate-500" />
  <span className="text-[12px] text-slate-400 font-mono">实测逐点数据</span>
```

---

#### ISS-FEEL-05: Non-Physical Toggle Switch Lacking Squash Resistance and ARIA Switch Role
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/upload/PrivacyZoneList.tsx:52-65`
- **Violated Apple UI Principle**: *The Feel — Physical Mapping & Interactive Feedback*
- **Existing Code**:
```tsx
// PrivacyZoneList.tsx:52-65
<button
  type="button"
  onClick={() => onToggleZone(zone.id)}
  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
    isActive ? 'bg-brand-500' : 'bg-slate-300'
  }`}
  title={isActive ? '点击停用该隐私脱敏区' : '点击启用该隐私脱敏区'}
>
  <span
    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
      isActive ? 'translate-x-4' : 'translate-x-0'
    }`}
  />
</button>
```
- **Analysis**: Apple switch physics include momentum and knob elongation (knob widens horizontally upon press/drag from 16px to 20px before settling). The current component uses a rigid, linear 200ms ease-in-out transition without squash feedback, and lacks accessible `role="switch"` and `aria-checked` semantics.
- **Production-Ready Replacement**:
```tsx
<button
  type="button"
  role="switch"
  aria-checked={isActive}
  onClick={() => onToggleZone(zone.id)}
  className={`group relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
    isActive ? 'bg-brand-500' : 'bg-slate-300'
  }`}
>
  <span
    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-all duration-200 ease-out group-active:w-5 ${
      isActive ? 'translate-x-4 group-active:translate-x-3' : 'translate-x-0'
    }`}
  />
</button>
```

---

#### ISS-MAT-04: Missing Dynamic Typography Tracking on Display Numbers and Headings
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/common/BentoMetricCard.tsx:18`, `apps/web/src/components/TotalStatsCard.tsx:37`, `apps/web/src/components/reports/PeriodSummaryCards.tsx:41`, `apps/web/src/components/ride-detail/RideTitleHeader.tsx:124`
- **Violated Apple UI Principle**: *Materials, Depth & Typography — Dynamic Typography (Size-Specific Tracking & Leading)*
- **Existing Code**:
```tsx
// BentoMetricCard.tsx:18
<div className="flex items-baseline gap-1.5 text-[26px] sm:text-[28px] font-semibold text-slate-900 leading-none tabular-nums font-mono">

// RideTitleHeader.tsx:124
<h1 className="text-[24px] sm:text-[28px] font-semibold text-slate-900 tracking-tight leading-[1.2]">
```
- **Analysis**: Apple typographic hierarchy requires size-specific letter spacing (tracking): large display text (>20px) requires negative tracking (`-0.025em` to `-0.035em`) to prevent numerals from feeling loose, while micro text (<12px) requires positive tracking (`+0.05em`) for legibility. Large heading leading should be tight (`1.08 - 1.12`), whereas `RideTitleHeader` uses loose `leading-[1.2]`.
- **Production-Ready Replacement**:
```tsx
// BentoMetricCard.tsx:18
<div className="flex items-baseline gap-1.5 text-[26px] sm:text-[28px] font-semibold text-slate-900 leading-none tabular-nums font-mono tracking-[-0.03em]">

// RideTitleHeader.tsx:124
<h1 className="text-[24px] sm:text-[28px] font-semibold text-slate-900 tracking-[-0.025em] leading-[1.1]">
```

---

#### ISS-MAT-05: Mobile Viewport Collision Between Floating Map Controls and Legend
- **Severity**: P2 - Medium
- **Relative Path**: `apps/web/src/components/ride-detail/RideDetailMap.tsx:385, 395`
- **Violated Apple UI Principle**: *Materials & Layout — Spatial Geometry & Viewport Adaptability*
- **Existing Code**:
```tsx
// RideDetailMap.tsx:385, 395
<SpeedGradientLegend className="absolute bottom-8 left-6 z-20" />
<MapFloatingControls ... className="absolute right-6 bottom-8 z-20" />
```
- **Analysis**: In `RideDetail.tsx`, the mobile map view is restricted to `40dvh`. On 375px wide mobile viewports, the speed legend (~290px wide) placed at `left-6 bottom-8` physically overlaps and collides with `MapFloatingControls` placed at `right-6 bottom-8`, creating unclickable UI layering.
- **Production-Ready Replacement**:
```tsx
// Hide wide legend bar on mobile and display only on desktop:
<SpeedGradientLegend className="hidden md:flex absolute bottom-8 left-6 z-20" />
```

---

## 2. Logic Chain

1. **Premise 1 (Perception)**: Human optical perception does not equal Cartesian geometry.
   - *Observation Reference*: ISS-LOOK-01, ISS-LOOK-02, ISS-LOOK-03.
   - Directional icons, triangular badges, and asymmetric icons placed with standard mathematical centering appear uncentered and unbalanced because their visual mass is skewed.
   - *Inference*: Correcting optical mass offsets directly restores visual equilibrium.

2. **Premise 2 (Continuity)**: Apple squircle and curvature continuity requires concentric geometry where internal radius scales with padding: $R_{inner} = \max(0, R_{outer} - padding)$.
   - *Observation Reference*: ISS-LOOK-05, ISS-LOOK-06.
   - When an inner button has $R_{inner} = 6px$ inside an outer $R_{outer} = 8px$ with $4px$ padding, the inner corner pinches against the outer boundary. In other areas, invalid classes `p-4.5` and `py-0.2` silently collapse padding to 0.
   - *Inference*: Standardizing to concentric radii and valid Tailwind scales restores curvature harmony across the application.

3. **Premise 3 (Responsiveness)**: Direct physical manipulation requires immediate tactile feedback on `pointerdown` and interruptible physics models.
   - *Observation Reference*: ISS-FEEL-01, ISS-FEEL-02, ISS-FEEL-03, ISS-FEEL-04.
   - Currently, interactive controls provide zero depression on pointerdown; modals rely on uninstalled animation classes (resulting in abrupt popping); mobile dashboard sheets lack gesture tracking and velocity handoff.
   - *Inference*: Implementing `:active` scale depressions, spring physics curves, and gesture-driven sheet tracking transforms rigid web components into fluid Apple-grade physical interfaces.

4. **Premise 4 (Materials & Accessibility)**: Translucent materials must respect system preferences and optical density.
   - *Observation Reference*: ISS-MAT-01, ISS-MAT-02, ISS-MAT-03.
   - With zero `@media (prefers-reduced-*)` rules and over-opaque 95% white backdrops, low-vision and motion-sensitive users are unsupported, and white text blooms heavily on dark backgrounds.
   - *Inference*: Introducing system preference fallbacks, calibrated vibrancy, and antialiased text weight compensation guarantees accessibility and optical polish.

---

## 3. Caveats

- **External Hardware / WebGL Constraints**: MapLibre GL canvas internal rendering (tiles, GL shaders) is constrained by WebGL context capabilities; the audit focused strictly on DOM overlays, markers, and HUD controls.
- **Third-Party Chart Library (ECharts)**: ECharts tooltips and canvas canvas rendering are controlled via JSON options; DOM-level spring transitions apply to surrounding HUD containers and React component wrappers rather than internal canvas redraw loops.
- **No Caveats on Component Coverage**: All 51 components and 8 pages in `apps/web` were fully inspected.

---

## 4. Conclusion

`apps/web` possesses a solid foundational sports telemetry architecture, but exhibits systematic deviations from Apple Design Engineering principles:
1. **The Look**: Widespread lack of optical mass compensation for asymmetric icons; systematic nested radius pinching ($R_{inner} > R_{outer} - p$); invalid padding classes (`p-4.5`, `py-0.2`).
2. **The Feel**: Broken animation classes due to missing `tailwindcss-animate`; complete absence of `pointerdown` active feedback; rigid static mobile bottom sheet without direct touch manipulation.
3. **Materials, Typography & Accessibility**: Complete omission of `prefers-reduced-motion` and `prefers-reduced-transparency`; uncalibrated 95% opacity blur surfaces; white text blooming on dark backdrops.

All identified issues are paired with concrete, production-ready replacement code snippets in Section 1.2 to enable direct remediation.

---

## 5. Verification Method

To independently verify the observations, run the following commands in `c:\Users\VerNe\Downloads\Documents\Cycling`:

1. **Verify Unit & Component Test Suite**:
   ```bash
   pnpm --filter web test
   ```
   *Expected outcome*: 79 test files passed, 453 tests passed.

2. **Verify Linter Diagnostics**:
   ```bash
   pnpm --filter web lint
   ```
   *Expected outcome*: 0 errors, confirming syntactic cleanliness.

3. **Verify Invalid Tailwind Classes**:
   ```bash
   grep -rn "p-4.5" apps/web/src/
   grep -rn "py-0.2" apps/web/src/
   ```
   *Expected outcome*: Matches found in `ManualProfileTab.tsx`, `AIGatewayConfigTab.tsx`, `ActivitiesTableView.tsx`, `GoalEvolutionTimeline.tsx`, `RiderProfileDrawer.tsx`, `MemoryItemCard.tsx`.

4. **Verify System Accessibility Media Queries**:
   ```bash
   grep -rn "prefers-reduced-motion" apps/web/
   grep -rn "prefers-reduced-transparency" apps/web/
   ```
   *Expected outcome*: 0 matches found in CSS or TSX files.
