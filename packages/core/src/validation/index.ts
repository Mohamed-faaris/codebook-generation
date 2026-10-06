import { DecoderAcceptanceCriteria, DecodingResult, RotationAngle } from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';
import { OrientationEngine, RotationVariants } from '../orientation/index.js';
import { ReflectionEngine } from '../reflection/index.js';

export interface CodebookValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  minPairwiseDistance: number;
  minRotationDistance: number;
  minSelfRotationDistance: number;
  minReflectionDistance: number;
}

export class MarkerDecoder {
  readonly geometry: MarkerGeometryModel;
  readonly orientationEngine: OrientationEngine;
  readonly reflectionEngine: ReflectionEngine;
  readonly codebook: BinaryCode[];
  readonly codebookRotations: RotationVariants[];

  constructor(geometry: MarkerGeometryModel, codebook: BinaryCode[]) {
    this.geometry = geometry;
    this.orientationEngine = new OrientationEngine(geometry);
    this.reflectionEngine = new ReflectionEngine(geometry);
    this.codebook = codebook;
    this.codebookRotations = codebook.map((code) => this.orientationEngine.getRotations(code));
  }

  /**
   * Decode an observed binary pattern against codebook.
   */
  decode(observed: BinaryCode, criteria: DecoderAcceptanceCriteria): DecodingResult {
    let bestDist = Infinity;
    let bestId: number | null = null;
    let bestAngle: RotationAngle | null = null;

    let secondBestDist = Infinity;
    let secondBestId: number | null = null;

    const angles: RotationAngle[] = [0, 90, 180, 270];

    for (let id = 0; id < this.codebook.length; id++) {
      const rotVariants = this.codebookRotations[id];
      const dists: Array<{ dist: number; angle: RotationAngle }> = [
        { dist: observed.hammingDistance(rotVariants.deg0), angle: 0 },
        { dist: observed.hammingDistance(rotVariants.deg90), angle: 90 },
        { dist: observed.hammingDistance(rotVariants.deg180), angle: 180 },
        { dist: observed.hammingDistance(rotVariants.deg270), angle: 270 },
      ];

      for (const { dist, angle } of dists) {
        if (dist < bestDist) {
          // Demote current best to second best if different id
          if (bestId !== null && bestId !== id) {
            secondBestDist = bestDist;
            secondBestId = bestId;
          }
          bestDist = dist;
          bestId = id;
          bestAngle = angle;
        } else if (dist < secondBestDist && id !== bestId) {
          secondBestDist = dist;
          secondBestId = id;
        }
      }
    }

    const margin = secondBestDist === Infinity ? 999 : secondBestDist - bestDist;

    // Determine status
    if (bestDist > criteria.maxAcceptanceDistance) {
      return {
        status: 'rejected',
        matchedId: bestId,
        observedHammingDistance: bestDist,
        detectedRotation: bestAngle,
        detectedReflection: 'none',
        runnerUpId: secondBestId,
        runnerUpDistance: secondBestDist === Infinity ? null : secondBestDist,
        ambiguityMargin: margin,
        confidenceScore: 0.0,
        explanation: `Distance ${bestDist} exceeds maximum allowable acceptance distance ${criteria.maxAcceptanceDistance}.`,
      };
    }

    if (bestDist > 0 && margin < criteria.minAmbiguityMargin) {
      return {
        status: 'ambiguous',
        matchedId: bestId,
        observedHammingDistance: bestDist,
        detectedRotation: bestAngle,
        detectedReflection: 'none',
        runnerUpId: secondBestId,
        runnerUpDistance: secondBestDist === Infinity ? null : secondBestDist,
        ambiguityMargin: margin,
        confidenceScore: 0.25,
        explanation: `Ambiguous observation: Distance to ID #${bestId} is ${bestDist}, but runner-up ID #${secondBestId} is only distance ${secondBestDist} (margin ${margin} < required ${criteria.minAmbiguityMargin}).`,
      };
    }

    const confidence = Math.max(
      0.1,
      parseFloat(
        (
          (1 - bestDist / (this.geometry.dataBitsCount || 1)) *
          (Math.min(margin, 10) / 10)
        ).toFixed(3)
      )
    );

    return {
      status: 'accepted',
      matchedId: bestId,
      observedHammingDistance: bestDist,
      detectedRotation: bestAngle,
      detectedReflection: 'none',
      runnerUpId: secondBestId,
      runnerUpDistance: secondBestDist === Infinity ? null : secondBestDist,
      ambiguityMargin: margin,
      confidenceScore: bestDist === 0 ? 1.0 : confidence,
      explanation: `Successfully decoded to Marker ID #${bestId} at ${bestAngle}° rotation with distance ${bestDist} and safety margin ${margin}.`,
    };
  }
}

export class CodebookValidator {
  /**
   * Validate a codebook against geometric, rotational, reflection and minimum distance criteria.
   */
  static validate(
    codes: BinaryCode[],
    geometry: MarkerGeometryModel,
    targetMinDistance: number,
    enforceRotation: boolean = true,
    enforceReflection: boolean = false
  ): CodebookValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const orientationEngine = new OrientationEngine(geometry);
    const reflectionEngine = new ReflectionEngine(geometry);

    let minPairwise = Infinity;
    let minRotation = Infinity;
    let minSelfRotation = Infinity;
    let minReflection = Infinity;

    const K = codes.length;

    // 1. Self-rotation symmetry check
    for (let i = 0; i < K; i++) {
      const selfRotDist = orientationEngine.minSelfRotationDistance(codes[i]);
      if (selfRotDist < minSelfRotation) minSelfRotation = selfRotDist;

      if (selfRotDist === 0) {
        errors.push(`Marker #${i} is 100% rotationally symmetric! Its orientation cannot be determined.`);
      } else if (enforceRotation && selfRotDist < targetMinDistance) {
        warnings.push(
          `Marker #${i} self-rotation distance is ${selfRotDist}, which is below target min distance ${targetMinDistance}.`
        );
      }
    }

    // 2. Cross-marker pairwise distance & rotation collisions
    for (let i = 0; i < K; i++) {
      const rotI = orientationEngine.getRotations(codes[i]);
      const refI = enforceReflection ? reflectionEngine.getReflections(codes[i]) : null;

      for (let j = i + 1; j < K; j++) {
        // Base distance
        const baseDist = codes[i].hammingDistance(codes[j]);
        if (baseDist < minPairwise) minPairwise = baseDist;

        if (baseDist === 0) {
          errors.push(`Duplicate code detected between Marker #${i} and #${j}!`);
        } else if (baseDist < targetMinDistance) {
          errors.push(
            `Marker #${i} and #${j} have Hamming distance ${baseDist} < target ${targetMinDistance}.`
          );
        }

        // Rotational distance
        if (enforceRotation) {
          const { minDistance: rotDist, closestAngle } = orientationEngine.minPairwiseRotationDistance(
            codes[j],
            rotI
          );
          if (rotDist < minRotation) minRotation = rotDist;

          if (rotDist === 0) {
            errors.push(
              `Rotation collision: Marker #${j} is an exact ${closestAngle}° rotation of Marker #${i}!`
            );
          } else if (rotDist < targetMinDistance) {
            warnings.push(
              `Marker #${j} and Marker #${i} rotated ${closestAngle}° have distance ${rotDist} < target ${targetMinDistance}.`
            );
          }
        }

        // Reflection distance
        if (enforceReflection && refI) {
          const { minDistance: refDist, axis } = reflectionEngine.minPairwiseReflectionDistance(
            codes[j],
            refI
          );
          if (refDist < minReflection) minReflection = refDist;

          if (refDist === 0) {
            warnings.push(
              `Reflection collision: Marker #${j} is a ${axis} reflection of Marker #${i}.`
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      minPairwiseDistance: minPairwise === Infinity ? 0 : minPairwise,
      minRotationDistance: minRotation === Infinity ? 0 : minRotation,
      minSelfRotationDistance: minSelfRotation === Infinity ? 0 : minSelfRotation,
      minReflectionDistance: minReflection === Infinity ? 0 : minReflection,
    };
  }
}
