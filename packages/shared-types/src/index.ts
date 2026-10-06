/**
 * Shared Type Definitions for Fiducial Marker Designer & Codebook Generator
 */

export type RotationAngle = 0 | 90 | 180 | 270;

export type ReflectionAxis = 'none' | 'horizontal' | 'vertical' | 'diagonal_main' | 'diagonal_anti';

export type BorderType =
  | 'solid'
  | 'thick'
  | 'thin'
  | 'double'
  | 'orientation_asymmetric'
  | 'corner_finder'
  | 'finder_pattern'
  | 'multi_level';

export interface BorderConfiguration {
  type: BorderType;
  /** Width in logical module/cell units (e.g. 1.0, 2.0, 0.5) */
  widthInCells: number;
  /** Double border inner gap in cell units */
  innerGapInCells?: number;
  /** For orientation/asymmetric border: top notch or asymmetric thickness */
  asymmetryFeature?: 'top_notch' | 'left_thick' | 'corner_triangle' | 'l_shape';
  /** For corner finder: corner size in cell units */
  cornerSizeInCells?: number;
  /** Outer white quiet zone in cell units */
  quietZoneInCells: number;
  /** Custom label */
  label: string;
  description: string;
}

export interface BorderEvaluationMetrics {
  localizationReliability: number; // 0 - 100
  cornerAccuracy: number;          // 0 - 100
  detectionDistance: number;       // 0 - 100
  blurTolerance: number;           // 0 - 100
  perspectiveTolerance: number;    // 0 - 100
  falsePositiveResistance: number; // 0 - 100
  physicalAreaOverheadPercent: number; // % area taken by border vs total
  dataAreaPercent: number;         // % area left for data
  detectorCompatibility: string;
}

export interface ReservedCell {
  row: number;
  col: number;
  purpose: 'orientation_fixed' | 'parity' | 'finder' | 'alignment';
  fixedValue?: 0 | 1;
}

export interface MarkerGeometry {
  /** Grid dimensions (must be >= 2) */
  rows: number;
  cols: number;
  /** Total data cell count = rows * cols - reservedCells.length */
  totalCells: number;
  dataBits: number;
  reservedCells: ReservedCell[];
  aspectRatio: number; // usually 1.0 (square)
}

export interface PhysicalDimensions {
  /** Outer physical dimension in millimeters (including quiet zone) */
  totalSizeMm: number;
  quietZoneMm: number;
  borderWidthMm: number;
  dataRegionSizeMm: number;
  cellPitchMm: number;
  dpi: number;
  foregroundColor: string;
  backgroundColor: string;
}

export interface CodebookEntryStats {
  id: number;
  binaryString: string;
  hexString: string;
  bigIntValue: string;
  /** 4 Rotations as binary strings */
  rotations: {
    deg0: string;
    deg90: string;
    deg180: string;
    deg270: string;
  };
  /** Reflections as binary strings */
  reflections: {
    horizontal: string;
    vertical: string;
  };
  minSelfRotationDistance: number;
  minSelfReflectionDistance: number;
  minPairwiseDistance: number;
  nearestNeighborId: number;
  onesCount: number;
  zerosCount: number;
  balanceRatio: number; // ones / totalBits
}

export interface CodebookDistanceAnalysis {
  minDistance: number;
  maxDistance: number;
  meanDistance: number;
  stdDeviation: number;
  pairwiseMatrix: number[][]; // size K x K
  distanceHistogram: Record<number, number>; // distance -> count
  errorDetectionCapability: number; // d_min - 1
  errorCorrectionCapability: number; // floor((d_min - 1) / 2)
  totalIdentities: number;
  totalPairwiseComparisons: number;
}

export type OptimizationAlgorithm =
  | 'greedy_pruning'
  | 'simulated_annealing'
  | 'local_search_hill_climbing'
  | 'random_monte_carlo'
  | 'exhaustive_search';

export interface OptimizationConfig {
  algorithm: OptimizationAlgorithm;
  targetCount: number;
  targetMinHammingDistance: number;
  enforceRotationInvariance: boolean;
  enforceReflectionInvariance: boolean;
  enforceCodeBalance: boolean;
  balanceTolerancePercent: number; // e.g. 15% deviation from 50/50
  maxIterations: number;
  randomSeed?: number;
  weights: {
    hammingSeparation: number;
    rotationSeparation: number;
    reflectionSeparation: number;
    codeBalance: number;
    spatialDispersion: number;
  };
}

export interface OptimizationProgress {
  iteration: number;
  maxIterations: number;
  currentFoundCount: number;
  currentMinDistance: number;
  bestScore: number;
  elapsedMs: number;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';
  message: string;
}

export type DecodingStatus = 'accepted' | 'rejected' | 'ambiguous';

export interface DecoderAcceptanceCriteria {
  maxAcceptanceDistance: number; // max allowable Hamming distance (e.g. <= error correction bound)
  minAmbiguityMargin: number;    // dist(2nd) - dist(1st) must be >= this margin
  allowReflection: boolean;
}

export interface DecodingResult {
  status: DecodingStatus;
  matchedId: number | null;
  observedHammingDistance: number;
  detectedRotation: RotationAngle | null;
  detectedReflection: ReflectionAxis;
  runnerUpId: number | null;
  runnerUpDistance: number | null;
  ambiguityMargin: number;
  confidenceScore: number; // 0.0 - 1.0
  explanation: string;
}

export interface ErrorSimulationConfig {
  modelType: 'isolated_flips' | 'burst_cluster' | 'random_uniform' | 'edge_corrupt';
  flipCount: number;
  clusterRadius?: number;
  noiseProbability?: number;
}

export interface SimulationBenchmarkResult {
  testCount: number;
  flipsPerMarker: number;
  correctAcceptanceRate: number; // %
  falsePositiveRate: number;      // %
  ambiguousRejectionRate: number; // %
  totalRejectedRate: number;     // %
  averageMargin: number;
}

export interface CodebookExportSchema {
  formatVersion: '1.0.0';
  systemName: 'FiducialMarkerDesigner';
  exportTimestamp: string;
  metadata: {
    name: string;
    description: string;
    algorithmId: string;
    algorithmVersion: string;
    randomSeed?: number;
    targetMinDistance: number;
    achievedMinDistance: number;
    identityCount: number;
  };
  geometry: MarkerGeometry;
  border: BorderConfiguration;
  physical: PhysicalDimensions;
  decoderConfig: DecoderAcceptanceCriteria;
  identities: {
    id: number;
    codeBinary: string;
    codeHex: string;
    codeBigInt: string;
    rotations: {
      deg0: string;
      deg90: string;
      deg180: string;
      deg270: string;
    };
  }[];
  analysisSummary: {
    minHammingDistance: number;
    maxHammingDistance: number;
    averageHammingDistance: number;
    errorDetectionLimit: number;
    errorCorrectionLimit: number;
  };
}
