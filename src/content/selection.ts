// Selection helpers.
//
// Reads only the geometry and whitespace-emptiness of the current selection.
// We intentionally do NOT read, store, or transmit the selected text itself
// here — only enough to decide whether to show the button and where.

export interface SelectionAnchor {
  /** Viewport X for the button anchor (near the selection's end). */
  x: number;
  /** Viewport Y of the top of the selection rect. */
  y: number;
}

/**
 * Returns an anchor point for a non-empty, non-collapsed selection, or null
 * when there is nothing meaningful selected.
 */
export function getSelectionAnchor(): SelectionAnchor | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  // Treat whitespace-only selections as empty.
  if (selection.toString().trim().length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length === 0) {
    return null;
  }

  // Anchor near the end of the last line of the selection so the button
  // appears close to where the user finished highlighting.
  const last = rects[rects.length - 1];
  return { x: last.right, y: last.top };
}

/**
 * True if the selection sits inside an editable field. We skip showing the
 * button there to avoid interfering with typing/editing.
 */
export function isSelectionInEditable(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  let node: Node | null = selection.anchorNode;
  while (node) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable) {
        return true;
      }
    }
    node = node.parentNode;
  }
  return false;
}
