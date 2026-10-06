import { CodebookDistanceAnalysis } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';

export class HammingAnalyzer {
  /**
   * Compute complete distance analysis for a list of codes.
   */
  static analyze(codes: BinaryCode[]): CodebookDistanceAnalysis {
    const K = codes.length;
    if (K === 0) {
      return {
        minDistance: 0,
        maxDistance: 0,
        meanDistance: 0,
        stdDeviation: 0,
        pairwiseMatrix: [],
        distanceHistogram: {},
        errorDetectionCapability: 0,
        errorCorrectionCapability: 0,
        totalIdentities: 0,
        totalPairwiseComparisons: 0,
      };
    }

    if (K === 1) {
      return {
        minDistance: 0,
        maxDistance: 0,
        meanDistance: 0,
        stdDeviation: 0,
        pairwiseMatrix: [[0]],
        distanceHistogram: { 0: 1 },
        errorDetectionCapability: 0,
        errorCorrectionCapability: 0,
        totalIdentities: 1,
        totalPairwiseComparisons: 0,
      };
    }

    const matrix: number[][] = Array.from({ length: K }, () => Array.from({ length: K }, () => 0));
    const histogram: Record<number, number> = {};

    let minDistance = Infinity;
    let maxDistance = -Infinity;
    let sum = 0;
    let pairCount = 0;

    for (let i = 0; i < K; i++) {
      matrix[i][i] = 0;
      for (let j = i + 1; j < K; j++) {
        const dist = codes[i].hammingDistance(codes[j]);
        matrix[i][j] = dist;
        matrix[j][i] = dist;

        if (dist < minDistance) minDistance = dist;
        if (dist > maxDistance) maxDistance = dist;

        sum += dist;
        pairCount++;

        histogram[dist] = (histogram[dist] || 0) + 1;
      }
    }

    const mean = pairCount > 0 ? sum / pairCount : 0;

    // Standard deviation
    let varianceSum = 0;
    for (let i = 0; i < K; i++) {
      for (let j = i + 1; j < K; j++) {
        const d = matrix[i][j];
        varianceSum += (d - mean) ** 2;
      }
    }
    const stdDev = pairCount > 0 ? Math.sqrt(varianceSum / pairCount) : 0;

    const errorDetectionCapability = Math.max(0, minDistance - 1);
    const errorCorrectionCapability = Math.max(0, Math.floor((minDistance - 1) / 2));

    return {
      minDistance: minDistance === Infinity ? 0 : minDistance,
      maxDistance: maxDistance === -Infinity ? 0 : maxDistance,
      meanDistance: Number(mean.toFixed(2)),
      stdDeviation: Number(stdDev.toFixed(2)),
      pairwiseMatrix: matrix,
      distanceHistogram: histogram,
      errorDetectionCapability,
      errorCorrectionCapability,
      totalIdentities: K,
      totalPairwiseComparisons: pairCount,
    };
  }

  /**
   * For each code, find its nearest neighbor in the set (excluding itself).
   */
  static findNearestNeighbors(codes: BinaryCode[]): Array<{ neighborId: number; distance: number }> {
    const K = codes.length;
    const results: Array<{ neighborId: number; distance: number }> = [];

    for (let i = 0; i < K; i++) {
      let minDist = Infinity;
      let nearestId = -1;

      for (let j = 0; j < K; j++) {
        if (i === j) continue;
        const d = codes[i].hammingDistance(codes[j]);
        if (d < minDist) {
          minDist = d;
          nearestId = j;
        }
      }

      results.push({
        neighborId: nearestId,
        distance: minDist === Infinity ? 0 : minDist,
      });
    }

    return results;
  }
}
