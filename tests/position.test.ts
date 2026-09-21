import { describe, expect, it } from 'vitest';
import { calculateButtonPosition, calculateFloatingPosition, Rect } from '../src/utils/position';

describe('calculateFloatingPosition', () => {
  const sampleSelection: Rect = {
    top: 100,
    bottom: 120,
    left: 200,
    right: 250,
    width: 50,
    height: 20,
  };

  it('should place card below selection when space is available', () => {
    const pos = calculateFloatingPosition(sampleSelection, 300, 200, 1000, 800, 0, 0);
    expect(pos.y).toBe(128); // 120 + 8
    expect(pos.x).toBe(200);
  });

  it('should flip above selection when overflowing bottom', () => {
    const bottomSelection: Rect = {
      top: 700,
      bottom: 720,
      left: 200,
      right: 250,
      width: 50,
      height: 20,
    };
    const pos = calculateFloatingPosition(bottomSelection, 300, 200, 1000, 800, 0, 0);
    expect(pos.y).toBe(700 - 200 - 8); // flipped above: 492
    expect(pos.x).toBe(200);
  });

  it('should shift left when overflowing right margin', () => {
    const rightSelection: Rect = {
      top: 100,
      bottom: 120,
      left: 850,
      right: 950,
      width: 100,
      height: 20,
    };
    const pos = calculateFloatingPosition(rightSelection, 300, 200, 1000, 800, 0, 0);
    // 1000 - 300 - 10 = 690
    expect(pos.x).toBe(690);
  });
});

describe('calculateButtonPosition', () => {
  const sampleSelection: Rect = {
    top: 100,
    bottom: 120,
    left: 200,
    right: 250,
    width: 50,
    height: 20,
  };

  it('should place button next to mouse cursor when mousePos is provided', () => {
    const pos = calculateButtonPosition(sampleSelection, { clientX: 300, clientY: 150 }, 28, 28, 1000, 800, 0, 0);
    expect(pos.x).toBe(300 + 8);
    expect(pos.y).toBe(150 + 8);
  });

  it('should place button to left/above of mouse if near screen edges', () => {
    // Near right-bottom corner
    const pos = calculateButtonPosition(sampleSelection, { clientX: 990, clientY: 790 }, 28, 28, 1000, 800, 0, 0);
    // Left of cursor: 990 - 28 - 8 = 954
    expect(pos.x).toBe(954);
    // Above cursor: 790 - 28 - 8 = 754
    expect(pos.y).toBe(754);
  });

  it('should fall back to selection right edge if mousePos is not provided', () => {
    const pos = calculateButtonPosition(sampleSelection, undefined, 28, 28, 1000, 800, 0, 0);
    expect(pos.x).toBe(250 + 4);
    expect(pos.y).toBe(120 - 28);
  });
});

