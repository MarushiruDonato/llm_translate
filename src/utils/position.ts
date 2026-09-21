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
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
  scrollX: number = window.scrollX,
  scrollY: number = window.scrollY
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
 * Position for the small floating trigger button right at the end of selection.
 */
export function calculateButtonPosition(
  selectionRect: Rect,
  buttonWidth: number = 28,
  buttonHeight: number = 28,
  scrollX: number = window.scrollX,
  scrollY: number = window.scrollY
): Position {
  const spacing = 4;
  let left = selectionRect.right + spacing;
  let top = selectionRect.bottom - buttonHeight;

  // If overflows right, place above selection
  if (left + buttonWidth > window.innerWidth - 8) {
    left = Math.max(8, selectionRect.right - buttonWidth);
    top = Math.max(8, selectionRect.top - buttonHeight - spacing);
  }

  return {
    x: left + scrollX,
    y: top + scrollY,
  };
}
