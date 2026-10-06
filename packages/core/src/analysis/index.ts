import { SimulationBenchmarkResult } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { ErrorCorruptionModel } from '../error-model/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';
import { MarkerDecoder } from '../validation/index.js';

export interface SpatialComplexityMetrics {
  entropy: number;
  horizontalTransitions: number;
  verticalTransitions: number;
  maxRunLength: number;
  isUniformlyDispersed: boolean;
}

export class CodebookAnalyzer {
  /**
   * Calculate spatial dispersion and visual run-length characteristics of a marker grid.
   */
  static analyzeSpatialComplexity(grid: number[][]): SpatialComplexityMetrics {
    const rows = grid.length;
    const cols = grid[0].length;
    let hTransitions = 0;
    let vTransitions = 0;
    let maxRun = 0;

    // Horizontal transitions and runs
    for (let r = 0; r < rows; r++) {
      let currentRun = 1;
      for (let c = 0; c < cols - 1; c++) {
        if (grid[r][c] !== grid[r][c + 1]) {
          hTransitions++;
          if (currentRun > maxRun) maxRun = currentRun;
          currentRun = 1;
        } else {
          currentRun++;
        }
      }
      if (currentRun > maxRun) maxRun = currentRun;
    }

    // Vertical transitions
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 1; r++) {
        if (grid[r][c] !== grid[r + 1][c]) {
          vTransitions++;
        }
      }
    }

    // Shannon entropy of bit distribution
    let ones = 0;
    const total = rows * cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) ones++;
      }
    }
    const p1 = ones / total;
    const p0 = 1 - p1;
    let entropy = 0;
    if (p1 > 0) entropy -= p1 * Math.log2(p1);
    if (p0 > 0) entropy -= p0 * Math.log2(p0);

    const isUniformlyDispersed = maxRun <= Math.max(3, Math.ceil(cols / 2));

    return {
      entropy: Number(entropy.toFixed(3)),
      horizontalTransitions: hTransitions,
      verticalTransitions: vTransitions,
      maxRunLength: maxRun,
      isUniformlyDispersed,
    };
  }

  /**
   * Estimate theoretical false positive probability under random noise.
   * P(FP) = (K * sum_{r=0}^{e_corr} nCr(N, r)) / 2^N
   */
  static estimateFalsePositiveProbability(
    totalBits: number,
    codeCount: number,
    errorCorrectionRadius: number
  ): number {
    const n = totalBits;
    let sphereVolume = 0;
    for (let r = 0; r <= errorCorrectionRadius; r++) {
      sphereVolume += CodebookAnalyzer.combinations(n, r);
    }
    // Multiply by 4 for the 4 rotation orientations
    const totalAcceptedVolume = codeCount * 4 * sphereVolume;
    const totalSpace = Math.pow(2, Math.min(n, 52)); // avoid floating overflow
    const prob = totalAcceptedVolume / totalSpace;
    return Math.min(1.0, Math.max(0.0, prob));
  }

  /**
   * AprilTag 2 False Positive Rate Analysis (Wang & Olson, IROS 2016, Table I & Section IV-A)
   * Computes the theoretical false positive rate across 0, 1, and 2 bit error corrections.
   * Based on: FPR(E) = (4 * K * sum_{e=0}^E nCr(B, e)) / 2^B
   */
  static computeAprilTag2FPRProfiles(
    totalBits: number,
    codeCount: number
  ): Array<{
    errorsCorrected: number;
    combinationsPerTag: number;
    totalValidStatesPerFamily: number;
    theoreticalFPR: number;
    theoreticalFPRPercent: string;
    expectedFalsePositivesPerMillionImages: number;
    evaluationNote: string;
  }> {
    const profiles = [];
    const avgQuadsPerImage = 32.3; // AprilTag 2 empirical candidate quads per natural scene image (Table I)

    for (let e = 0; e <= 2; e++) {
      let combos = 0;
      for (let r = 0; r <= e; r++) {
        combos += CodebookAnalyzer.combinations(totalBits, r);
      }

      const totalValidStates = codeCount * 4 * combos;
      const totalSpace = Math.pow(2, Math.min(totalBits, 52));
      const fpr = totalValidStates / totalSpace;
      const expectedPerMillion = Number((fpr * avgQuadsPerImage * 1000000).toFixed(4));

      let note = '';
      if (e === 0) {
        note = 'Exact Match: Ultra-low false positive rate. Optimal for high-security / cluttered scenes.';
      } else if (e === 1) {
        note = '1 Bit Corrected: High recovery with negligible false positive risk. Recommended default.';
      } else {
        note = '2 Bits Corrected: AprilTag 2 practical upper limit. Fast O(1) hash table decode enabled.';
      }

      profiles.push({
        errorsCorrected: e,
        combinationsPerTag: combos,
        totalValidStatesPerFamily: totalValidStates,
        theoreticalFPR: fpr,
        theoreticalFPRPercent: fpr < 1e-6 ? (fpr * 100).toExponential(3) + '%' : (fpr * 100).toFixed(6) + '%',
        expectedFalsePositivesPerMillionImages: expectedPerMillion,
        evaluationNote: note,
      });
    }

    return profiles;
  }

  private static combinations(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let c = 1;
    for (let i = 1; i <= k; i++) {
      c = (c * (n - (k - i))) / i;
    }
    return c;
  }

  /**
   * Run Monte-Carlo stress test simulating corruption levels from 1 to maxFlips
   * to evaluate decoder accuracy, false positive rate, and ambiguity rate.
   */
  static runMonteCarloBenchmark(
    geometry: MarkerGeometryModel,
    codes: BinaryCode[],
    testFlips: number = 2,
    trialsPerMarker: number = 10
  ): SimulationBenchmarkResult {
    const errorModel = new ErrorCorruptionModel(geometry);
    const decoder = new MarkerDecoder(geometry, codes);
    const dMin = codes.length >= 2 ? codes[0].hammingDistance(codes[1]) : 1; // estimate
    const eCorrect = Math.max(0, Math.floor((dMin - 1) / 2));

    const acceptanceCriteria = {
      maxAcceptanceDistance: Math.max(testFlips, eCorrect),
      minAmbiguityMargin: 1,
      allowReflection: false,
    };

    let totalTests = 0;
    let correctCount = 0;
    let falsePositiveCount = 0;
    let ambiguousCount = 0;
    let rejectedCount = 0;
    let marginSum = 0;

    for (let id = 0; id < codes.length; id++) {
      const originalCode = codes[id];
      for (let t = 0; t < trialsPerMarker; t++) {
        totalTests++;
        const corrupted = errorModel.corrupt(originalCode, {
          modelType: 'isolated_flips',
          flipCount: testFlips,
        });

        const result = decoder.decode(corrupted, acceptanceCriteria);
        marginSum += result.ambiguityMargin;

        if (result.status === 'accepted') {
          if (result.matchedId === id) {
            correctCount++;
          } else {
            falsePositiveCount++;
          }
        } else if (result.status === 'ambiguous') {
          ambiguousCount++;
        } else {
          rejectedCount++;
        }
      }
    }

    return {
      testCount: totalTests,
      flipsPerMarker: testFlips,
      correctAcceptanceRate: Number(((correctCount / totalTests) * 100).toFixed(1)),
      falsePositiveRate: Number(((falsePositiveCount / totalTests) * 100).toFixed(1)),
      ambiguousRejectionRate: Number(((ambiguousCount / totalTests) * 100).toFixed(1)),
      totalRejectedRate: Number(((rejectedCount / totalTests) * 100).toFixed(1)),
      averageMargin: Number((marginSum / totalTests).toFixed(2)),
    };
  }
}
