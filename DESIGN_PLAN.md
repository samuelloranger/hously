# Design Plan: Media Conversion Redesign

## Summary
Implementation of **Variant A (Hierarchy Focus)** for the Media Conversion feature. This includes a redesigned `ConvertMediaDialog` with a clearer source-to-target comparison and a new `ConversionStatus` bar at the top of the Media Library for persistent progress tracking.

## Components & API

### 1. `ConversionStatusBar.tsx`
- **Props:** `jobs: MediaConversionJob[]`
- **Location:** `apps/web/src/features/medias/components/ConversionStatusBar.tsx`
- **Behavior:** Only visible when there are active jobs (`status === 'running' || status === 'queued'`).
- **Elements:**
  - Zap icon (pulsing when running)
  - Filename and status badge
  - Progress bar with percentage and ETA
  - "More" menu for job actions (cancel/details)

### 2. `ConvertMediaDialog.tsx` (Update)
- **Refined Layout:** Simplified one-column layout for small screens, two-column for large.
- **Source/Target Comparison:** Visual cards showing current codec/size vs. target preset/estimated time.
- **Action Button:** Large, high-contrast "Start Conversion" button with loading states.

## Implementation Steps

### Step 1: Shared Components
- Extract the `StatCard` into a more reusable pattern if needed, or refine it within the dialog.
- Create the new `ConversionStatusBar` component.

### Step 2: MediasLibrary Integration
- Fetch active conversion jobs globally or within the library.
- Place `ConversionStatusBar` above the Toolbar in `MediasLibrary.tsx`.

### Step 3: Dialog Redesign
- Apply the Variant A styles to `ConvertMediaDialog.tsx`.
- Update the metadata display to use the "Current vs Target" card layout.
- Ensure the preset selector feels native to the new design.

## Accessibility Checklist
- [ ] Progress bars have `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- [ ] Interactive elements (buttons, selects) have 44px minimum touch targets.
- [ ] Color contrast meets WCAG AA (4.5:1).
- [ ] Proper focus rings on all interactive elements.
- [ ] Announcements for job status changes (e.g., "Conversion completed").

## Testing Guidance
- **Unit Tests:** Verify progress bar percentage calculations.
- **Integration Tests:** Ensure `ConversionStatusBar` disappears when all jobs are finished.
- **Visual Tests:** Confirm dark mode compatibility and responsive behavior on mobile.
