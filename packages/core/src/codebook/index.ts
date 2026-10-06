import {
  BorderConfiguration,
  CodebookDistanceAnalysis,
  CodebookEntryStats,
  MarkerGeometry,
  PhysicalDimensions,
} from '@fiducial/shared-types';
import { BinaryCode } from '../binary-code/index.js';
import { PRESET_BORDERS } from '../borders/index.js';
import { MarkerGeometryModel } from '../geometry/index.js';
import { HammingAnalyzer } from '../hamming/index.js';
import { OrientationEngine } from '../orientation/index.js';
import { ReflectionEngine } from '../reflection/index.js';

export interface CodebookMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: string;
  algorithmId: string;
  targetMinDistance: number;
}

export class CodebookModel {
  readonly geometry: MarkerGeometryModel;
  border: BorderConfiguration;
  physical: PhysicalDimensions;
  metadata: CodebookMetadata;
  codes: BinaryCode[];

  private _cachedEntryStats: CodebookEntryStats[] | null = null;
  private _cachedDistanceAnalysis: CodebookDistanceAnalysis | null = null;

  constructor(
    geometry: MarkerGeometryModel | MarkerGeometry,
    border: BorderConfiguration = PRESET_BORDERS.solid,
    codes: BinaryCode[] = [],
    metadata?: Partial<CodebookMetadata>
  ) {
    this.geometry =
      geometry instanceof MarkerGeometryModel ? geometry : new MarkerGeometryModel(geometry);
    this.border = border;
    this.codes = codes;
    this.physical = MarkerGeometryModel.computePhysicalDimensions(
      this.geometry,
      this.border.widthInCells,
      this.border.quietZoneInCells
    );

    this.metadata = {
      name: metadata?.name || 'Custom Marker Family',
      description: metadata?.description || 'Research fiducial marker codebook',
      version: metadata?.version || '1.0.0',
      createdAt: metadata?.createdAt || new Date().toISOString(),
      algorithmId: metadata?.algorithmId || 'greedy_pruning',
      targetMinDistance: metadata?.targetMinDistance || 5,
    };
  }

  get count(): number {
    return this.codes.length;
  }

  get entryStats(): CodebookEntryStats[] {
    if (!this._cachedEntryStats) {
      this.recalculateStats();
    }
    return this._cachedEntryStats!;
  }

  get distanceAnalysis(): CodebookDistanceAnalysis {
    if (!this._cachedDistanceAnalysis) {
      this.recalculateStats();
    }
    return this._cachedDistanceAnalysis!;
  }

  addCode(code: BinaryCode): void {
    if (code.bitLength !== this.geometry.dataBitsCount) {
      throw new Error(`Code length ${code.bitLength} does not match expected ${this.geometry.dataBitsCount}`);
    }
    this.codes.push(code);
    this.invalidateCache();
  }

  setCodes(codes: BinaryCode[]): void {
    this.codes = codes;
    this.invalidateCache();
  }

  removeCode(index: number): void {
    if (index >= 0 && index < this.codes.length) {
      this.codes.splice(index, 1);
      this.invalidateCache();
    }
  }

  invalidateCache(): void {
    this._cachedEntryStats = null;
    this._cachedDistanceAnalysis = null;
  }

  private recalculateStats(): void {
    const orientationEngine = new OrientationEngine(this.geometry);
    const reflectionEngine = new ReflectionEngine(this.geometry);
    const analysis = HammingAnalyzer.analyze(this.codes);
    this._cachedDistanceAnalysis = analysis;

    const nearestList = HammingAnalyzer.findNearestNeighbors(this.codes);
    const stats: CodebookEntryStats[] = [];

    for (let i = 0; i < this.codes.length; i++) {
      const code = this.codes[i];
      const rots = orientationEngine.getRotations(code);
      const refs = reflectionEngine.getReflections(code);

      const ones = code.popcount();
      const zeros = code.bitLength - ones;

      stats.push({
        id: i,
        binaryString: code.toBinaryString(),
        hexString: code.toHexString(),
        bigIntValue: code.toBigInt().toString(),
        rotations: {
          deg0: rots.deg0.toBinaryString(),
          deg90: rots.deg90.toBinaryString(),
          deg180: rots.deg180.toBinaryString(),
          deg270: rots.deg270.toBinaryString(),
        },
        reflections: {
          horizontal: refs.horizontal.toBinaryString(),
          vertical: refs.vertical.toBinaryString(),
        },
        minSelfRotationDistance: orientationEngine.minSelfRotationDistance(code),
        minSelfReflectionDistance: reflectionEngine.minSelfReflectionDistance(code),
        minPairwiseDistance: nearestList[i]?.distance ?? 0,
        nearestNeighborId: nearestList[i]?.neighborId ?? -1,
        onesCount: ones,
        zerosCount: zeros,
        balanceRatio: Number((ones / code.bitLength).toFixed(3)),
      });
    }

    this._cachedEntryStats = stats;
  }

  /**
   * Factory for creating rich research presets.
   */
  static createPreset(presetName: 'apriltag_36h11' | 'aruco_5x5' | 'micro_4x4' | 'asymmetric_robotics' | 'scale_invariant_double'): CodebookModel {
    switch (presetName) {
      case 'apriltag_36h11': {
        const geom = MarkerGeometryModel.createDefault(6, 6);
        // Preload sample verified 6x6 codes with d_min = 10
        const codes = [
          BinaryCode.fromHex('0xd473b18e3', 36),
          BinaryCode.fromHex('0x59b2075a1', 36),
          BinaryCode.fromHex('0xaa5b39920', 36),
          BinaryCode.fromHex('0x72a5d629f', 36),
          BinaryCode.fromHex('0x28f01b34e', 36),
          BinaryCode.fromHex('0xf14d89670', 36),
          BinaryCode.fromHex('0x192e46b5a', 36),
          BinaryCode.fromHex('0x8c70fa523', 36),
        ];
        return new CodebookModel(geom, PRESET_BORDERS.solid, codes, {
          name: 'AprilTag 36h11 Benchmark Family',
          description: '6x6 data grid (36 bits) with 1-module black solid border. High distance separation for robotics.',
          targetMinDistance: 10,
        });
      }

      case 'aruco_5x5': {
        const geom = MarkerGeometryModel.createDefault(5, 5);
        const codes = [
          BinaryCode.fromHex('0x15a2e94', 25),
          BinaryCode.fromHex('0x0e7b165', 25),
          BinaryCode.fromHex('0x1f09c52', 25),
          BinaryCode.fromHex('0x02d64a8', 25),
          BinaryCode.fromHex('0x184c731', 25),
          BinaryCode.fromHex('0x0b938ef', 25),
        ];
        return new CodebookModel(geom, PRESET_BORDERS.solid, codes, {
          name: 'ArUco 5x5 Family Equivalent',
          description: '5x5 data grid (25 bits) with standard black border. Fast OpenCV dictionary compatibility.',
          targetMinDistance: 7,
        });
      }

      case 'micro_4x4': {
        const geom = MarkerGeometryModel.createDefault(4, 4);
        const codes = [
          BinaryCode.fromHex('0xa659', 16),
          BinaryCode.fromHex('0x59a6', 16),
          BinaryCode.fromHex('0x3c96', 16),
          BinaryCode.fromHex('0xc369', 16),
        ];
        return new CodebookModel(geom, PRESET_BORDERS.thin, codes, {
          name: 'Micro-Fiducial 4x4 High-Density',
          description: '4x4 data grid with ultra-thin border for miniature components, PCB inspection, and micro-aerial vehicles.',
          targetMinDistance: 5,
        });
      }

      case 'asymmetric_robotics': {
        const geom = MarkerGeometryModel.createDefault(5, 5);
        const codes = [
          BinaryCode.fromHex('0x14e5a93', 25),
          BinaryCode.fromHex('0x09b62f1', 25),
          BinaryCode.fromHex('0x170a4c8', 25),
          BinaryCode.fromHex('0x03df81e', 25),
        ];
        return new CodebookModel(geom, PRESET_BORDERS.orientation_asymmetric, codes, {
          name: 'Asymmetric Robotics Keyed Family',
          description: '5x5 payload with top-notch keyed orientation border. Eliminates 4x rotational hypothesis search in drone localization.',
          targetMinDistance: 8,
        });
      }

      case 'scale_invariant_double': {
        const geom = MarkerGeometryModel.createDefault(6, 6);
        const codes = [
          BinaryCode.fromHex('0xdb14856f2', 36),
          BinaryCode.fromHex('0x629f0ec1a', 36),
          BinaryCode.fromHex('0x9d4b31a87', 36),
          BinaryCode.fromHex('0x2e80d754b', 36),
        ];
        return new CodebookModel(geom, PRESET_BORDERS.double, codes, {
          name: 'Scale-Invariant Dual Ring Family',
          description: '6x6 data grid with concentric double perimeter. High false-positive resistance under harsh clutter.',
          targetMinDistance: 11,
        });
      }
    }
  }
}
