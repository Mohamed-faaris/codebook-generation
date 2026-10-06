import { MarkerGeometry, PhysicalDimensions, ReservedCell } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';

export interface GridCoord {
  row: number;
  col: number;
}

export class MarkerGeometryModel implements MarkerGeometry {
  readonly rows: number;
  readonly cols: number;
  readonly totalCells: number;
  readonly reservedCells: ReservedCell[];
  readonly reservedMap: Map<string, ReservedCell>;
  readonly dataBitToCellMap: GridCoord[];
  readonly cellToDataBitMap: number[][]; // [row][col] -> dataBit index or -1 if reserved
  readonly aspectRatio: number;

  constructor(geometry: MarkerGeometry) {
    if (geometry.rows < 2 || geometry.cols < 2) {
      throw new Error(`Grid dimensions must be at least 2x2, got ${geometry.rows}x${geometry.cols}`);
    }
    this.rows = geometry.rows;
    this.cols = geometry.cols;
    this.totalCells = this.rows * this.cols;
    this.reservedCells = geometry.reservedCells || [];
    this.aspectRatio = geometry.aspectRatio ?? (this.cols / this.rows);

    this.reservedMap = new Map();
    for (const r of this.reservedCells) {
      this.reservedMap.set(`${r.row},${r.col}`, r);
    }

    this.dataBitToCellMap = [];
    this.cellToDataBitMap = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => -1)
    );

    let bitIndex = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.reservedMap.has(`${r},${c}`)) {
          this.dataBitToCellMap.push({ row: r, col: c });
          this.cellToDataBitMap[r][c] = bitIndex;
          bitIndex++;
        }
      }
    }
  }

  get dataBitsCount(): number {
    return this.dataBitToCellMap.length;
  }

  get dataBits(): number {
    return this.dataBitsCount;
  }

  /**
   * Convert a BinaryCode to a 2D grid of numbers (0 or 1), including fixed reserved cells.
   */
  codeToGrid(code: BinaryCode): number[][] {
    if (code.bitLength !== this.dataBitsCount) {
      throw new Error(`Code bit length ${code.bitLength} does not match geometry data bits ${this.dataBitsCount}`);
    }

    const grid: number[][] = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => 0)
    );

    const bits = code.toBitArray();
    for (let i = 0; i < this.dataBitToCellMap.length; i++) {
      const { row, col } = this.dataBitToCellMap[i];
      grid[row][col] = bits[i];
    }

    // Apply reserved cells
    for (const res of this.reservedCells) {
      grid[res.row][res.col] = res.fixedValue ?? 0;
    }

    return grid;
  }

  /**
   * Extract a BinaryCode from a 2D grid of 0s and 1s.
   */
  gridToCode(grid: number[][]): BinaryCode {
    const bits = new Uint8Array(this.dataBitsCount);
    for (let i = 0; i < this.dataBitToCellMap.length; i++) {
      const { row, col } = this.dataBitToCellMap[i];
      bits[i] = grid[row][col] ? 1 : 0;
    }
    return BinaryCode.fromBits(bits);
  }

  /**
   * Create default symmetric geometry without reserved cells.
   */
  static createDefault(rows: number, cols: number = rows): MarkerGeometry {
    const totalCells = rows * cols;
    return {
      rows,
      cols,
      totalCells,
      dataBits: totalCells,
      reservedCells: [],
      aspectRatio: cols / rows,
    };
  }

  /**
   * Create geometry with corner orientation markers reserved.
   */
  static createWithCornerOrientation(rows: number, cols: number = rows): MarkerGeometry {
    const reserved: ReservedCell[] = [
      { row: 0, col: 0, purpose: 'orientation_fixed', fixedValue: 1 },
      { row: 0, col: cols - 1, purpose: 'orientation_fixed', fixedValue: 0 },
      { row: rows - 1, col: 0, purpose: 'orientation_fixed', fixedValue: 0 },
      { row: rows - 1, col: cols - 1, purpose: 'orientation_fixed', fixedValue: 0 },
    ];
    const totalCells = rows * cols;
    return {
      rows,
      cols,
      totalCells,
      dataBits: totalCells - reserved.length,
      reservedCells: reserved,
      aspectRatio: cols / rows,
    };
  }

  /**
   * Compute physical dimensions given target outer size in mm and border/quiet cell widths.
   */
  static computePhysicalDimensions(
    geometry: MarkerGeometry,
    borderWidthCells: number,
    quietZoneCells: number,
    totalSizeMm: number = 100,
    dpi: number = 300,
    foregroundColor: string = '#000000',
    backgroundColor: string = '#ffffff'
  ): PhysicalDimensions {
    const totalModuleUnits = geometry.rows + (borderWidthCells * 2) + (quietZoneCells * 2);
    const cellPitchMm = totalSizeMm / totalModuleUnits;
    const quietZoneMm = quietZoneCells * cellPitchMm;
    const borderWidthMm = borderWidthCells * cellPitchMm;
    const dataRegionSizeMm = geometry.rows * cellPitchMm;

    return {
      totalSizeMm,
      quietZoneMm,
      borderWidthMm,
      dataRegionSizeMm,
      cellPitchMm,
      dpi,
      foregroundColor,
      backgroundColor,
    };
  }
}
