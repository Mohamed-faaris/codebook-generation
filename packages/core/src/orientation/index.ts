import { RotationAngle } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';

export interface RotationVariants {
  deg0: BinaryCode;
  deg90: BinaryCode;
  deg180: BinaryCode;
  deg270: BinaryCode;
}

export class OrientationEngine {
  readonly geometry: MarkerGeometryModel;

  constructor(geometry: MarkerGeometryModel) {
    this.geometry = geometry;
  }

  /**
   * Rotate a 2D grid clockwise by 90, 180, or 270 degrees.
   */
  rotateGrid(grid: number[][], angle: RotationAngle): number[][] {
    const rows = this.geometry.rows;
    const cols = this.geometry.cols;

    if (angle === 0) {
      return grid.map((row) => [...row]);
    }

    if (angle === 90) {
      const result: number[][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          result[c][rows - 1 - r] = grid[r][c];
        }
      }
      return result;
    }

    if (angle === 180) {
      const result: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          result[rows - 1 - r][cols - 1 - c] = grid[r][c];
        }
      }
      return result;
    }

    if (angle === 270) {
      const result: number[][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          result[cols - 1 - c][r] = grid[r][c];
        }
      }
      return result;
    }

    throw new Error(`Unsupported rotation angle: ${angle}`);
  }

  /**
   * Compute all 4 rotation variants for a given BinaryCode.
   * Assumes square markers for 90/270 rotations.
   */
  getRotations(code: BinaryCode): RotationVariants {
    if (this.geometry.rows !== this.geometry.cols) {
      // Non-square markers only have 0 and 180 valid rotations under same aspect ratio
      const grid = this.geometry.codeToGrid(code);
      const grid180 = this.rotateGrid(grid, 180);
      const code180 = this.geometry.gridToCode(grid180);
      return {
        deg0: code,
        deg90: code, // fallback
        deg180: code180,
        deg270: code180,
      };
    }

    const grid0 = this.geometry.codeToGrid(code);
    const grid90 = this.rotateGrid(grid0, 90);
    const grid180 = this.rotateGrid(grid0, 180);
    const grid270 = this.rotateGrid(grid0, 270);

    return {
      deg0: code,
      deg90: this.geometry.gridToCode(grid90),
      deg180: this.geometry.gridToCode(grid180),
      deg270: this.geometry.gridToCode(grid270),
    };
  }

  /**
   * Minimum distance between a code and its non-zero rotations (self-rotation distance).
   * If this is 0, the marker is rotationally symmetric (disastrous for orientation).
   */
  minSelfRotationDistance(code: BinaryCode): number {
    const rot = this.getRotations(code);
    const d90 = code.hammingDistance(rot.deg90);
    const d180 = code.hammingDistance(rot.deg180);
    const d270 = code.hammingDistance(rot.deg270);
    return Math.min(d90, d180, d270);
  }

  /**
   * Minimum distance between codeA and ANY rotation of codeB.
   */
  minPairwiseRotationDistance(
    codeA: BinaryCode,
    rotationsB: RotationVariants
  ): { minDistance: number; closestAngle: RotationAngle } {
    const d0 = codeA.hammingDistance(rotationsB.deg0);
    const d90 = codeA.hammingDistance(rotationsB.deg90);
    const d180 = codeA.hammingDistance(rotationsB.deg180);
    const d270 = codeA.hammingDistance(rotationsB.deg270);

    let minDistance = d0;
    let closestAngle: RotationAngle = 0;

    if (d90 < minDistance) {
      minDistance = d90;
      closestAngle = 90;
    }
    if (d180 < minDistance) {
      minDistance = d180;
      closestAngle = 180;
    }
    if (d270 < minDistance) {
      minDistance = d270;
      closestAngle = 270;
    }

    return { minDistance, closestAngle };
  }
}
