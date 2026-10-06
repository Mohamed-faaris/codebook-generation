import { ReflectionAxis } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';

export interface ReflectionVariants {
  original: BinaryCode;
  horizontal: BinaryCode;
  vertical: BinaryCode;
  diagonalMain?: BinaryCode;
}

export class ReflectionEngine {
  readonly geometry: MarkerGeometryModel;

  constructor(geometry: MarkerGeometryModel) {
    this.geometry = geometry;
  }

  reflectGrid(grid: number[][], axis: ReflectionAxis): number[][] {
    const rows = this.geometry.rows;
    const cols = this.geometry.cols;

    if (axis === 'none') {
      return grid.map((r) => [...r]);
    }

    if (axis === 'horizontal') {
      // Flip left-to-right
      return grid.map((row) => [...row].reverse());
    }

    if (axis === 'vertical') {
      // Flip top-to-bottom
      const result: number[][] = [];
      for (let r = rows - 1; r >= 0; r--) {
        result.push([...grid[r]]);
      }
      return result;
    }

    if (axis === 'diagonal_main') {
      // Transpose
      const result: number[][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          result[c][r] = grid[r][c];
        }
      }
      return result;
    }

    return grid.map((r) => [...r]);
  }

  getReflections(code: BinaryCode): ReflectionVariants {
    const grid0 = this.geometry.codeToGrid(code);
    const gridH = this.reflectGrid(grid0, 'horizontal');
    const gridV = this.reflectGrid(grid0, 'vertical');

    const result: ReflectionVariants = {
      original: code,
      horizontal: this.geometry.gridToCode(gridH),
      vertical: this.geometry.gridToCode(gridV),
    };

    if (this.geometry.rows === this.geometry.cols) {
      const gridDiag = this.reflectGrid(grid0, 'diagonal_main');
      result.diagonalMain = this.geometry.gridToCode(gridDiag);
    }

    return result;
  }

  minSelfReflectionDistance(code: BinaryCode): number {
    const ref = this.getReflections(code);
    const dH = code.hammingDistance(ref.horizontal);
    const dV = code.hammingDistance(ref.vertical);
    let minDist = Math.min(dH, dV);
    if (ref.diagonalMain) {
      minDist = Math.min(minDist, code.hammingDistance(ref.diagonalMain));
    }
    return minDist;
  }

  minPairwiseReflectionDistance(
    codeA: BinaryCode,
    reflectionsB: ReflectionVariants
  ): { minDistance: number; axis: ReflectionAxis } {
    const dH = codeA.hammingDistance(reflectionsB.horizontal);
    const dV = codeA.hammingDistance(reflectionsB.vertical);

    let minDistance = dH;
    let axis: ReflectionAxis = 'horizontal';

    if (dV < minDistance) {
      minDistance = dV;
      axis = 'vertical';
    }

    if (reflectionsB.diagonalMain) {
      const dDiag = codeA.hammingDistance(reflectionsB.diagonalMain);
      if (dDiag < minDistance) {
        minDistance = dDiag;
        axis = 'diagonal_main';
      }
    }

    return { minDistance, axis };
  }
}
