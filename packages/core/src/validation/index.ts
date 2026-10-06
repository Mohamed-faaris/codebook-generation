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

/**
 * AprilTag 2 O(1) Hash Table Quick Decoder (Wang & Olson, IROS 2016, Section III-E)
 * Precomputes an O(1) lookup table for up to 2-bit error corrections across all valid codes
 * and their 4 rotations. Replaces O(4N) linear scanning with instant O(1) hash table lookup.
 */
export class AprilTag2QuickDecoder {
  readonly geometry: MarkerGeometryModel;
  readonly maxErrors: number;
  private readonly lookupTable = new Map<
    string,
    {
      id: number;
      rotation: RotationAngle;
      distance: number;
      isAmbiguous: boolean;
    }
  >();
  private readonly _entryCount: number;

  constructor(
    geometry: MarkerGeometryModel,
    codebook: BinaryCode[],
    maxErrors: number = 2
  ) {
    this.geometry = geometry;
    this.maxErrors = maxErrors;
    const orient = new OrientationEngine(geometry);
    const bitCount = geometry.dataBitsCount;

    // Build the O(1) lookup table
    for (let id = 0; id < codebook.length; id++) {
      const rots = orient.getRotations(codebook[id]);
      const angleCodes: Array<{ code: BinaryCode; angle: RotationAngle }> = [
        { code: rots.deg0, angle: 0 },
        { code: rots.deg90, angle: 90 },
        { code: rots.deg180, angle: 180 },
        { code: rots.deg270, angle: 270 },
      ];

      for (const { code, angle } of angleCodes) {
        // 0-error entry
        this.insertEntry(code.toBigInt().toString(), id, angle, 0);

        if (maxErrors >= 1) {
          // 1-error entries: flip 1 bit
          for (let i = 0; i < bitCount; i++) {
            const flipped1 = code.flipBit(i);
            this.insertEntry(flipped1.toBigInt().toString(), id, angle, 1);

            if (maxErrors >= 2) {
              // 2-error entries: flip 2 bits
              for (let j = i + 1; j < bitCount; j++) {
                const flipped2 = flipped1.flipBit(j);
                this.insertEntry(flipped2.toBigInt().toString(), id, angle, 2);
              }
            }
          }
        }
      }
    }

    this._entryCount = this.lookupTable.size;
  }

  get tableSize(): number {
    return this._entryCount;
  }

  private insertEntry(key: string, id: number, angle: RotationAngle, dist: number): void {
    const existing = this.lookupTable.get(key);
    if (!existing) {
      this.lookupTable.set(key, { id, rotation: angle, distance: dist, isAmbiguous: false });
    } else {
      if (existing.distance > dist) {
        // Closer distance wins
        this.lookupTable.set(key, { id, rotation: angle, distance: dist, isAmbiguous: false });
      } else if (existing.distance === dist && existing.id !== id) {
        // Tie between two different marker IDs -> mark ambiguous!
        existing.isAmbiguous = true;
      }
    }
  }

  /**
   * O(1) instant decode.
   */
  decode(observed: BinaryCode): DecodingResult {
    const start = performance.now();
    const key = observed.toBigInt().toString();
    const hit = this.lookupTable.get(key);
    const lookupTimeUs = Math.round((performance.now() - start) * 1000);

    if (!hit) {
      return {
        status: 'rejected',
        matchedId: null,
        observedHammingDistance: this.maxErrors + 1,
        detectedRotation: null,
        detectedReflection: 'none',
        runnerUpId: null,
        runnerUpDistance: null,
        ambiguityMargin: 0,
        confidenceScore: 0.0,
        explanation: `AprilTag 2 Quick Decoder: Pattern not found in O(1) hash table (Hamming error > ${this.maxErrors} bits). Rejected in ${lookupTimeUs}µs.`,
      };
    }

    if (hit.isAmbiguous) {
      return {
        status: 'ambiguous',
        matchedId: hit.id,
        observedHammingDistance: hit.distance,
        detectedRotation: hit.rotation,
        detectedReflection: 'none',
        runnerUpId: null,
        runnerUpDistance: hit.distance,
        ambiguityMargin: 0,
        confidenceScore: 0.2,
        explanation: `AprilTag 2 Quick Decoder: Ambiguous collision detected at Hamming distance ${hit.distance} (tie between multiple identities). Resolved in ${lookupTimeUs}µs.`,
      };
    }

    return {
      status: 'accepted',
      matchedId: hit.id,
      observedHammingDistance: hit.distance,
      detectedRotation: hit.rotation,
      detectedReflection: 'none',
      runnerUpId: null,
      runnerUpDistance: null,
      ambiguityMargin: 1,
      confidenceScore: hit.distance === 0 ? 1.0 : hit.distance === 1 ? 0.9 : 0.75,
      explanation: `AprilTag 2 O(1) Hash Table Hit: Matched ID #${hit.id} (${hit.rotation}°) with distance ${hit.distance} bits in ${lookupTimeUs}µs.`,
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
