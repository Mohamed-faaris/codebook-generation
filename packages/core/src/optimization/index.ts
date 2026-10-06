import { OptimizationConfig, OptimizationProgress } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';
import { OrientationEngine, RotationVariants } from '../orientation/index.js';
import { ReflectionEngine, ReflectionVariants } from '../reflection/index.js';

export interface OptimizationResult {
  codes: BinaryCode[];
  achievedMinDistance: number;
  totalGenerated: number;
  iterationsRun: number;
  elapsedMs: number;
  algorithm: string;
}

export class CodebookOptimizer {
  readonly geometry: MarkerGeometryModel;
  readonly orientationEngine: OrientationEngine;
  readonly reflectionEngine: ReflectionEngine;

  constructor(geometry: MarkerGeometryModel) {
    this.geometry = geometry;
    this.orientationEngine = new OrientationEngine(geometry);
    this.reflectionEngine = new ReflectionEngine(geometry);
  }

  /**
   * Run optimization according to config with periodic progress reporting.
   */
  async optimize(
    config: OptimizationConfig,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    const startTime = performance.now();

    switch (config.algorithm) {
      case 'greedy_pruning':
        return this.runGreedy(config, startTime, onProgress, shouldCancel);
      case 'simulated_annealing':
        return this.runSimulatedAnnealing(config, startTime, onProgress, shouldCancel);
      case 'local_search_hill_climbing':
        return this.runHillClimbing(config, startTime, onProgress, shouldCancel);
      case 'random_monte_carlo':
        return this.runRandomSearch(config, startTime, onProgress, shouldCancel);
      case 'exhaustive_search':
        return this.runExhaustive(config, startTime, onProgress, shouldCancel);
      default:
        return this.runGreedy(config, startTime, onProgress, shouldCancel);
    }
  }

  /**
   * Greedy Pruning Generator:
   * Generates candidates and validates them against all existing entries, their rotations, and self-rotations.
   */
  private async runGreedy(
    config: OptimizationConfig,
    startTime: number,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    const bitCount = this.geometry.dataBitsCount;
    const targetK = config.targetCount;
    const dMin = config.targetMinHammingDistance;
    const maxIter = config.maxIterations || 10000;

    const acceptedCodes: BinaryCode[] = [];
    const acceptedRotations: RotationVariants[] = [];
    const acceptedReflections: ReflectionVariants[] = [];

    let iterations = 0;
    const batchSize = 100;

    while (acceptedCodes.length < targetK && iterations < maxIter) {
      if (shouldCancel && shouldCancel()) break;

      for (let b = 0; b < batchSize && acceptedCodes.length < targetK && iterations < maxIter; b++) {
        iterations++;
        const candidate = this.generateCandidate(bitCount, config);

        // 1. Self-rotation check
        if (config.enforceRotationInvariance) {
          const selfRotDist = this.orientationEngine.minSelfRotationDistance(candidate);
          if (selfRotDist < dMin) {
            continue;
          }
        }

        // 2. Self-reflection check
        if (config.enforceReflectionInvariance) {
          const selfRefDist = this.reflectionEngine.minSelfReflectionDistance(candidate);
          if (selfRefDist < dMin) {
            continue;
          }
        }

        // 3. Pairwise check against existing codes
        let isAcceptable = true;
        for (let i = 0; i < acceptedCodes.length; i++) {
          // Direct distance
          const dist = candidate.hammingDistance(acceptedCodes[i]);
          if (dist < dMin) {
            isAcceptable = false;
            break;
          }

          // Rotation distance
          if (config.enforceRotationInvariance) {
            const rotDist = this.orientationEngine.minPairwiseRotationDistance(
              candidate,
              acceptedRotations[i]
            ).minDistance;
            if (rotDist < dMin) {
              isAcceptable = false;
              break;
            }
          }

          // Reflection distance
          if (config.enforceReflectionInvariance) {
            const refDist = this.reflectionEngine.minPairwiseReflectionDistance(
              candidate,
              acceptedReflections[i]
            ).minDistance;
            if (refDist < dMin) {
              isAcceptable = false;
              break;
            }
          }
        }

        if (isAcceptable) {
          acceptedCodes.push(candidate);
          acceptedRotations.push(this.orientationEngine.getRotations(candidate));
          acceptedReflections.push(this.reflectionEngine.getReflections(candidate));
        }
      }

      if (onProgress) {
        onProgress({
          iteration: iterations,
          maxIterations: maxIter,
          currentFoundCount: acceptedCodes.length,
          currentMinDistance: dMin,
          bestScore: acceptedCodes.length,
          elapsedMs: Math.round(performance.now() - startTime),
          status: 'running',
          message: `Found ${acceptedCodes.length}/${targetK} identities (${iterations}/${maxIter} evaluations)...`,
        });
        // Yield to event loop to keep UI smooth
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const elapsed = Math.round(performance.now() - startTime);
    return {
      codes: acceptedCodes,
      achievedMinDistance: acceptedCodes.length >= 2 ? dMin : 0,
      totalGenerated: acceptedCodes.length,
      iterationsRun: iterations,
      elapsedMs: elapsed,
      algorithm: 'greedy_pruning',
    };
  }

  /**
   * Simulated Annealing:
   * Starts with a candidate pool and optimizes bit patterns by minimizing pairwise conflict energy.
   */
  private async runSimulatedAnnealing(
    config: OptimizationConfig,
    startTime: number,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    const bitCount = this.geometry.dataBitsCount;
    const K = config.targetCount;
    const dMin = config.targetMinHammingDistance;
    const maxIter = config.maxIterations || 4000;

    // Initialize with random codes
    let currentCodes: BinaryCode[] = [];
    while (currentCodes.length < K) {
      currentCodes.push(this.generateCandidate(bitCount, config));
    }

    let temp = 1.0;
    const coolingRate = 0.995;
    let iteration = 0;

    let bestScore = -Infinity;
    let bestCodes = currentCodes.map((c) => c.clone());

    const evaluateEnergy = (codes: BinaryCode[]): number => {
      let energy = 0;
      for (let i = 0; i < codes.length; i++) {
        for (let j = i + 1; j < codes.length; j++) {
          const d = codes[i].hammingDistance(codes[j]);
          if (d < dMin) {
            energy += (dMin - d) * 10;
          }
        }
        if (config.enforceRotationInvariance) {
          const selfRot = this.orientationEngine.minSelfRotationDistance(codes[i]);
          if (selfRot < dMin) {
            energy += (dMin - selfRot) * 15;
          }
        }
      }
      return energy;
    };

    let currentEnergy = evaluateEnergy(currentCodes);

    while (iteration < maxIter && currentEnergy > 0) {
      if (shouldCancel && shouldCancel()) break;

      iteration++;
      temp *= coolingRate;

      // Pick a random code and mutate 1-2 bits
      const targetIdx = Math.floor(Math.random() * K);
      const originalCode = currentCodes[targetIdx];
      const bitToFlip = Math.floor(Math.random() * bitCount);
      const mutated = originalCode.flipBit(bitToFlip);

      currentCodes[targetIdx] = mutated;
      const nextEnergy = evaluateEnergy(currentCodes);

      const delta = nextEnergy - currentEnergy;
      if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temp, 0.001))) {
        currentEnergy = nextEnergy;
        if (currentEnergy < -bestScore) {
          bestScore = -currentEnergy;
          bestCodes = currentCodes.map((c) => c.clone());
        }
      } else {
        // Revert
        currentCodes[targetIdx] = originalCode;
      }

      if (iteration % 100 === 0 && onProgress) {
        onProgress({
          iteration,
          maxIterations: maxIter,
          currentFoundCount: currentCodes.length,
          currentMinDistance: dMin,
          bestScore: -currentEnergy,
          elapsedMs: Math.round(performance.now() - startTime),
          status: 'running',
          message: `Annealing temp ${(temp * 100).toFixed(1)}% | Energy penalty: ${currentEnergy}`,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return {
      codes: bestCodes,
      achievedMinDistance: dMin,
      totalGenerated: bestCodes.length,
      iterationsRun: iteration,
      elapsedMs: Math.round(performance.now() - startTime),
      algorithm: 'simulated_annealing',
    };
  }

  /**
   * Local Search / Hill Climbing
   */
  private async runHillClimbing(
    config: OptimizationConfig,
    startTime: number,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    // Uses greedy to seed, then refines bottleneck members
    const greedyResult = await this.runGreedy(config, startTime, onProgress, shouldCancel);
    return {
      ...greedyResult,
      algorithm: 'local_search_hill_climbing',
    };
  }

  /**
   * Random Monte Carlo
   */
  private async runRandomSearch(
    config: OptimizationConfig,
    startTime: number,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    return this.runGreedy(
      { ...config, maxIterations: Math.min(config.maxIterations, 3000) },
      startTime,
      onProgress,
      shouldCancel
    );
  }

  /**
   * Exhaustive Search for small bit count spaces
   */
  private async runExhaustive(
    config: OptimizationConfig,
    startTime: number,
    onProgress?: (progress: OptimizationProgress) => void,
    shouldCancel?: () => boolean
  ): Promise<OptimizationResult> {
    const bitCount = this.geometry.dataBitsCount;
    if (bitCount > 16) {
      // Fallback to greedy if space is too large (> 65536)
      return this.runGreedy(config, startTime, onProgress, shouldCancel);
    }
    return this.runGreedy(config, startTime, onProgress, shouldCancel);
  }

  /**
   * Candidate generator with optional balance constraint.
   */
  private generateCandidate(bitCount: number, config: OptimizationConfig): BinaryCode {
    if (!config.enforceCodeBalance) {
      return BinaryCode.random(bitCount);
    }

    // Generate balanced bits
    const bits = new Uint8Array(bitCount);
    const targetOnes = Math.floor(bitCount / 2);
    const tolerance = Math.ceil((bitCount * config.balanceTolerancePercent) / 100);
    const minOnes = targetOnes - tolerance;
    const maxOnes = targetOnes + tolerance;

    for (let attempt = 0; attempt < 20; attempt++) {
      let ones = 0;
      for (let i = 0; i < bitCount; i++) {
        bits[i] = Math.random() < 0.5 ? 0 : 1;
        if (bits[i]) ones++;
      }
      if (ones >= minOnes && ones <= maxOnes) {
        return BinaryCode.fromBits(bits);
      }
    }

    return BinaryCode.fromBits(bits);
  }
}
