# Add to Library Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Add to Library" button to the LibraryPage toolbar that opens a modal containing `TmdbMediaSearchPanel` so users can search TMDB and add media without leaving the library page.

**Architecture:** A new `AddToLibraryModal` component wraps `TmdbMediaSearchPanel variant="modal"` in a Radix UI dialog with `bg-black/60 backdrop-blur-sm` overlay. `LibraryPage` gets a `addModalOpen` boolean state, the button in both desktop and mobile toolbar sections, and renders the modal at the bottom of its return. No API changes — `useAddToLibrary` and `useTmdbMediaSearch` are used as-is inside `TmdbMediaSearchPanel`.

**Tech Stack:** React 19, `@radix-ui/react-dialog` (already installed), Tailwind CSS, react-i18next

---

### Task 1: Create AddToLibraryModal component

**Files:**
- Create: `apps/web/src/pages/medias/_component/AddToLibraryModal.tsx`
- Test: `apps/web/src/pages/medias/_component/__tests__/AddToLibraryModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/medias/_component/__tests__/AddToLibraryModal.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddToLibraryModal } from "../AddToLibraryModal";

vi.mock("@/pages/medias/_component/TmdbMediaSearchPanel", () => ({
  TmdbMediaSearchPanel: ({ variant }: { variant: string }) => (
    <div data-testid="tmdb-panel" data-variant={variant} />
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe("AddToLibraryModal", () => {
  it("renders the search panel when open", () => {
    render(<AddToLibraryModal isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId("tmdb-panel")).toBeInTheDocument();
  });

  it("does not render panel content when closed", () => {
    render(<AddToLibraryModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("tmdb-panel")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && bun run test src/pages/medias/_component/__tests__/AddToLibraryModal.test.tsx
```

Expected: FAIL — `AddToLibraryModal` module not found.

- [ ] **Step 3: Create AddToLibraryModal.tsx**

Create `apps/web/src/pages/medias/_component/AddToLibraryModal.tsx`:

```tsx
import { useEffect, useRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TmdbMediaSearchPanel } from "@/pages/medias/_component/TmdbMediaSearchPanel";

interface AddToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddToLibraryModal({ isOpen, onClose }: AddToLibraryModalProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-150 data-[state=closed]:duration-100" />
        <div className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto overscroll-contain">
          <div className="flex min-h-full items-center justify-center p-4">
            <RadixDialog.Content
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="pointer-events-auto relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:duration-150 data-[state=closed]:duration-100"
            >
              <RadixDialog.Title className="sr-only">
                {t("medias.detail.addToLibrary")}
              </RadixDialog.Title>
              <RadixDialog.Description className="sr-only">
                {t("medias.detail.addToLibrary")}
              </RadixDialog.Description>
              <RadixDialog.Close
                aria-label="Close"
                className="absolute right-4 top-4 z-20 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </RadixDialog.Close>
              <TmdbMediaSearchPanel variant="modal" inputRef={inputRef} />
            </RadixDialog.Content>
          </div>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/web && bun run test src/pages/medias/_component/__tests__/AddToLibraryModal.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/medias/_component/AddToLibraryModal.tsx \
        apps/web/src/pages/medias/_component/__tests__/AddToLibraryModal.test.tsx
git commit -m "feat(library): add AddToLibraryModal component"
```

---

### Task 2: Wire AddToLibraryModal into LibraryPage

**Files:**
- Modify: `apps/web/src/pages/medias/_component/LibraryPage.tsx`

`LibraryPage.tsx` is ~626 lines. Key landmarks used below:
- Lucide import block: lines 6–23
- Last import line: 66
- `sheetOpen` state: line 110
- Desktop toolbar `hidden sm:flex` div: line 255
- Mobile `flex-1` spacer: line 359
- `</PageLayout>` closing: line 623

- [ ] **Step 1: Add `Plus` to lucide-react imports**

In `apps/web/src/pages/medias/_component/LibraryPage.tsx`, find the lucide import block and add `Plus`:

Old:
```tsx
import {
  Search as SearchIcon,
  Film,
  Tv,
  Clock,
  CheckCircle2,
  ArrowUpAZ,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Clapperboard,
  LayoutGrid,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
} from "lucide-react";
```

New:
```tsx
import {
  Search as SearchIcon,
  Film,
  Tv,
  Clock,
  CheckCircle2,
  ArrowUpAZ,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Clapperboard,
  LayoutGrid,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
  Plus,
} from "lucide-react";
```

- [ ] **Step 2: Add AddToLibraryModal import**

After the last import in the file (line 66: `import { useAuth } from "@/lib/auth/useAuth";`), add:

```tsx
import { AddToLibraryModal } from "./AddToLibraryModal";
```

- [ ] **Step 3: Add addModalOpen state**

After line 110 (`const [sheetOpen, setSheetOpen] = useState(false);`), add:

```tsx
  const [addModalOpen, setAddModalOpen] = useState(false);
```

- [ ] **Step 4: Add button to the desktop toolbar**

Find the desktop toolbar div (line 255). Replace:

```tsx
            <div className="hidden sm:flex items-center gap-1.5 ml-auto">
              <select
```

With:

```tsx
            <div className="hidden sm:flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Plus size={13} />
                {t("medias.detail.addToLibrary")}
              </button>
              <select
```

- [ ] **Step 5: Add button to the mobile toolbar**

Find the `flex-1` spacer (line 359). Replace:

```tsx
              <div className="flex-1" />
```

With:

```tsx
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <Plus size={13} />
                {t("medias.detail.addToLibrary")}
              </button>
```

- [ ] **Step 6: Render AddToLibraryModal in the return**

Find the `</PageLayout>` closing (line 623). Replace:

```tsx
    </PageLayout>
  );
}
```

With:

```tsx
      <AddToLibraryModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </PageLayout>
  );
}
```

- [ ] **Step 7: Run typecheck and tests**

```bash
make typecheck
cd apps/web && bun run test
```

Expected: no type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/medias/_component/LibraryPage.tsx
git commit -m "feat(library): wire Add to Library button and modal into LibraryPage toolbar"
```
