import { BorderConfiguration, BorderEvaluationMetrics, BorderType } from '@fiducial/shared-types';

export const PRESET_BORDERS: Record<BorderType, BorderConfiguration> = {
  solid: {
    type: 'solid',
    widthInCells: 1.0,
    quietZoneInCells: 1.0,
    label: 'Standard Solid Border (1.0x)',
    description: 'Classic 1-module black border. Optimal quadrilateral segmentation and well-balanced area overhead.',
  },
  thick: {
    type: 'thick',
    widthInCells: 2.0,
    quietZoneInCells: 1.5,
    label: 'Thick Robust Border (2.0x)',
    description: 'Extra thick border for long-range detection, severe motion blur tolerance, and low-resolution cameras.',
  },
  thin: {
    type: 'thin',
    widthInCells: 0.5,
    quietZoneInCells: 0.5,
    label: 'High-Density Thin Border (0.5x)',
    description: 'Thin border maximizing active data payload region at the expense of distant quad extraction.',
  },
  double: {
    type: 'double',
    widthInCells: 1.0,
    innerGapInCells: 0.5,
    quietZoneInCells: 1.0,
    label: 'Double Ring Border',
    description: 'Dual concentric black rings with inner white space. High candidate verification and false-positive rejection.',
  },
  orientation_asymmetric: {
    type: 'orientation_asymmetric',
    widthInCells: 1.0,
    asymmetryFeature: 'top_notch',
    quietZoneInCells: 1.0,
    label: 'Orientation Keyed Border',
    description: 'Border featuring an asymmetric top orientation key/notch to resolve orientation prior to payload decoding.',
  },
  corner_finder: {
    type: 'corner_finder',
    widthInCells: 1.0,
    cornerSizeInCells: 1.5,
    asymmetryFeature: 'corner_triangle',
    quietZoneInCells: 1.0,
    label: 'Corner-Enhanced Border',
    description: 'High-contrast corner enhancement structures for sub-pixel corner localization under acute perspective warp.',
  },
  finder_pattern: {
    type: 'finder_pattern',
    widthInCells: 1.2,
    asymmetryFeature: 'l_shape',
    quietZoneInCells: 1.0,
    label: 'Finder Pattern Border',
    description: 'Nested multi-scale L-shaped perimeter pattern providing robust scale-invariant initial hypothesis detection.',
  },
  multi_level: {
    type: 'multi_level',
    widthInCells: 1.5,
    innerGapInCells: 0.75,
    quietZoneInCells: 1.5,
    label: 'Multi-Level Hierarchical Border',
    description: 'Hierarchical multi-band perimeter engineered for extreme distance variations and scale transitions.',
  },
};

export class BorderEvaluator {
  /**
   * Evaluate a border configuration against physical & computer vision trade-offs.
   */
  static evaluate(config: BorderConfiguration, gridRows: number, gridCols: number = gridRows): BorderEvaluationMetrics {
    const dataModules = gridRows * gridCols;
    const totalOuterWidth = gridCols + (config.widthInCells * 2) + (config.quietZoneInCells * 2);
    const totalOuterHeight = gridRows + (config.widthInCells * 2) + (config.quietZoneInCells * 2);
    const totalAreaModules = totalOuterWidth * totalOuterHeight;
    const dataAreaPercent = Math.round((dataModules / totalAreaModules) * 100);
    const physicalAreaOverheadPercent = 100 - dataAreaPercent;

    switch (config.type) {
      case 'thick':
        return {
          localizationReliability: 96,
          cornerAccuracy: 88,
          detectionDistance: 95,
          blurTolerance: 94,
          perspectiveTolerance: 89,
          falsePositiveResistance: 92,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Exceptional. Ideal for OpenCV findContours / Apriltag quad detection at high range.',
        };
      case 'thin':
        return {
          localizationReliability: 68,
          cornerAccuracy: 74,
          detectionDistance: 62,
          blurTolerance: 58,
          perspectiveTolerance: 72,
          falsePositiveResistance: 70,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Good for close-up macro imaging. May fail quad detection under heavy blur.',
        };
      case 'double':
        return {
          localizationReliability: 92,
          cornerAccuracy: 93,
          detectionDistance: 82,
          blurTolerance: 78,
          perspectiveTolerance: 86,
          falsePositiveResistance: 97,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'High false-positive rejection. Requires dual-contour verification in detector pipeline.',
        };
      case 'orientation_asymmetric':
        return {
          localizationReliability: 89,
          cornerAccuracy: 86,
          detectionDistance: 84,
          blurTolerance: 80,
          perspectiveTolerance: 83,
          falsePositiveResistance: 94,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Eliminates 4x rotation decoding search. Fast single-hypothesis decoding.',
        };
      case 'corner_finder':
        return {
          localizationReliability: 94,
          cornerAccuracy: 98,
          detectionDistance: 86,
          blurTolerance: 82,
          perspectiveTolerance: 95,
          falsePositiveResistance: 91,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Outstanding for extreme perspective angles and robotic homography estimation.',
        };
      case 'finder_pattern':
        return {
          localizationReliability: 95,
          cornerAccuracy: 94,
          detectionDistance: 89,
          blurTolerance: 85,
          perspectiveTolerance: 91,
          falsePositiveResistance: 96,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Compatible with quick multi-scale 1D scanline finders similar to QR / MaxiCode.',
        };
      case 'multi_level':
        return {
          localizationReliability: 93,
          cornerAccuracy: 90,
          detectionDistance: 92,
          blurTolerance: 89,
          perspectiveTolerance: 88,
          falsePositiveResistance: 95,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Best for drone / mobile robot approaching marker from distant to contact range.',
        };
      case 'solid':
      default:
        return {
          localizationReliability: 88,
          cornerAccuracy: 85,
          detectionDistance: 85,
          blurTolerance: 82,
          perspectiveTolerance: 85,
          falsePositiveResistance: 86,
          physicalAreaOverheadPercent,
          dataAreaPercent,
          detectorCompatibility: 'Standard 100% compatible with AprilTag 3, ArUco, and OpenCV fiducial detectors.',
        };
    }
  }
}
