/**
 * Guards a parent Dialog from closing when a nested Select/DropdownMenu (or any other Radix
 * popper-based popup) closes because the user clicked elsewhere inside the dialog to dismiss it.
 *
 * Why this exists: Select's popup content is rendered via a Portal straight to document.body, not
 * nested under DialogContent's DOM subtree. A click outside that popup (but still inside the
 * dialog) closes the popup - correct - but the same pointerdown event is also observed by the
 * Dialog's own outside-click dismissal layer. Matching the click's DOM target against the popup's
 * wrapper (as `dialog.tsx` also does) doesn't cover every case, since a click that closes the
 * popup can land on the dialog's own content, not the popup itself. A short time-based grace
 * window after any tracked popup closes is a simpler, more reliable guard: `dialog.tsx` just
 * checks "did some popup close in roughly the same instant as this outside-click?" and ignores
 * the dismissal if so - the two events are close enough in time that a legitimate un-related
 * click on the dialog backdrop would essentially never land inside the window by coincidence.
 *
 * Module-level (not React state) is deliberate: only one such popup is realistically open/closing
 * at a time in any single form, and this needs to be readable from `dialog.tsx` without plumbing
 * a context through every intermediate component between a Select and its ancestor Dialog.
 */
let lastPopupCloseAt = 0;

export function markPopupJustClosed(): void {
  lastPopupCloseAt = Date.now();
}

export function wasPopupJustClosed(withinMs = 200): boolean {
  return Date.now() - lastPopupCloseAt < withinMs;
}
