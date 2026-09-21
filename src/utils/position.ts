export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Calculates optimal position for the floating button or card near selection.
 * Flips above selection if overflowing viewport bottom.
 * Shifts left if overflowing viewport right.
 */
export function calculateFloatingPosition(
  selectionRect: Rect,
  cardWidth: number,
  cardHeight: number,
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1000,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 800,
  scrollX: number = typeof window !== 'undefined' ? window.scrollX : 0,
  scrollY: number = typeof window !== 'undefined' ? window.scrollY : 0
): Position {
  const margin = 10;
  const spacing = 8;

  // Viewport-relative coordinates of selection
  const selTop = selectionRect.top;
  const selBottom = selectionRect.bottom;
  const selLeft = selectionRect.left;

  // Default: Place below selection, left-aligned with selection
  let top = selBottom + spacing;
  let left = selLeft;

  // If bottom exceeds viewport, flip to above selection
  if (top + cardHeight > viewportHeight - margin) {
    const flippedTop = selTop - cardHeight - spacing;
    if (flippedTop >= margin) {
      top = flippedTop;
    } else {
      // If neither fits well, clamp to viewport bottom margin
      top = Math.max(margin, viewportHeight - cardHeight - margin);
    }
  }

  // If right exceeds viewport, shift left
  if (left + cardWidth > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - cardWidth - margin);
  }

  // If left is off-screen, clamp to margin
  if (left < margin) {
    left = margin;
  }

  // Convert to absolute page coordinates
  return {
    x: left + scrollX,
    y: top + scrollY,
  };
}

/**
 * Position for the small floating trigger button right next to the mouse cursor (or near selection if mousePos not provided).
 */
export function calculateButtonPosition(
  selectionRect: Rect,
  mousePos?: { clientX: number; clientY: number },
  buttonWidth: number = 28,
  buttonHeight: number = 28,
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1000,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 800,
  scrollX: number = typeof window !== 'undefined' ? window.scrollX : 0,
  scrollY: number = typeof window !== 'undefined' ? window.scrollY : 0
): Position {
  const margin = 8;
  const offset = 8;

  if (mousePos && typeof mousePos.clientX === 'number' && typeof mousePos.clientY === 'number') {
    let left = mousePos.clientX + offset;
    let top = mousePos.clientY + offset;

    // If overflowing right edge, position to the left of the cursor
    if (left + buttonWidth > viewportWidth - margin) {
      left = mousePos.clientX - buttonWidth - offset;
    }

    // If overflowing bottom edge, position above the cursor
    if (top + buttonHeight > viewportHeight - margin) {
      top = mousePos.clientY - buttonHeight - offset;
    }

    // Clamp within margins
    left = Math.max(margin, Math.min(left, viewportWidth - buttonWidth - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - buttonHeight - margin));

    return {
      x: left + scrollX,
      y: top + scrollY,
    };
  }

  // Fallback if no mouse position provided: position near selection right
  const spacing = 4;
  let left = selectionRect.right + spacing;
  let top = selectionRect.bottom - buttonHeight;

  if (left + buttonWidth > viewportWidth - margin) {
    left = Math.max(margin, selectionRect.right - buttonWidth);
    top = Math.max(margin, selectionRect.top - buttonHeight - spacing);
  }

  return {
    x: left + scrollX,
    y: top + scrollY,
  };
}
