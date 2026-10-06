import { ErrorSimulationConfig, MarkerGeometry, SimulationBenchmarkResult } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';

export class ErrorCorruptionModel {
  readonly geometry: MarkerGeometryModel;

  constructor(geometry: MarkerGeometryModel | MarkerGeometry) {
    this.geometry =
      geometry instanceof MarkerGeometryModel ? geometry : new MarkerGeometryModel(geometry);
  }

  /**
   * Inject theoretical corruption into a BinaryCode according to config.
   */
  corrupt(code: BinaryCode, config: ErrorSimulationConfig): BinaryCode {
    const bitCount = this.geometry.dataBitsCount;
    const indicesToFlip = new Set<number>();

    switch (config.modelType) {
      case 'isolated_flips': {
        const flips = Math.min(config.flipCount, bitCount);
        while (indicesToFlip.size < flips) {
          const idx = Math.floor(Math.random() * bitCount);
          indicesToFlip.add(idx);
        }
        break;
      }

      case 'burst_cluster': {
        // Pick a center cell in 2D space
        const centerRow = Math.floor(Math.random() * this.geometry.rows);
        const centerCol = Math.floor(Math.random() * this.geometry.cols);
        const radius = config.clusterRadius ?? 1.5;

        for (let r = 0; r < this.geometry.rows; r++) {
          for (let c = 0; c < this.geometry.cols; c++) {
            const dist = Math.hypot(r - centerRow, c - centerCol);
            if (dist <= radius) {
              const bitIdx = this.geometry.cellToDataBitMap[r][c];
              if (bitIdx >= 0) {
                indicesToFlip.add(bitIdx);
              }
            }
          }
        }
        break;
      }

      case 'random_uniform': {
        const p = config.noiseProbability ?? 0.1;
        for (let i = 0; i < bitCount; i++) {
          if (Math.random() < p) {
            indicesToFlip.add(i);
          }
        }
        break;
      }

      case 'edge_corrupt': {
        // Higher probability for boundary cells
        for (let r = 0; r < this.geometry.rows; r++) {
          for (let c = 0; c < this.geometry.cols; c++) {
            const isEdge =
              r === 0 || r === this.geometry.rows - 1 || c === 0 || c === this.geometry.cols - 1;
            const p = isEdge ? 0.35 : 0.05;
            if (Math.random() < p) {
              const bitIdx = this.geometry.cellToDataBitMap[r][c];
              if (bitIdx >= 0) {
                indicesToFlip.add(bitIdx);
              }
            }
          }
        }
        break;
      }
    }

    return code.flipBits(Array.from(indicesToFlip));
  }
}
