/**
 * AprilTag 3 Layout Engine & Exporter
 * Implements official AprilTag 3 layouts from AprilRobotics/apriltag-generation:
 * - standard_x: data on outside perimeter, black border ring, white border ring, inner data
 * - classic_x: white border perimeter, black border ring, center data
 * - circle_x: circular tag with circular cutoff and black/white border rings
 * - custom_x: custom layout string specifying pixel type (d, w, b, x, r)
 * - Official apriltag_family_t C library header & source generation
 */

import {
  AprilTag3LayoutDefinition,
  AprilTag3PixelType,
  AprilTag3LayoutType,
  AprilTag3CExport
} from '@fiducial/shared-types';

export class AprilTag3LayoutEngine {
  /**
   * L1 Chebyshev distance to nearest outer edge
   */
  public static l1DistToEdge(x: number, y: number, size: number): number {
    return Math.min(Math.min(x, size - 1 - x), Math.min(y, size - 1 - y));
  }

  /**
   * L2 Euclidean distance to grid center
   */
  public static l2DistToCenter(x: number, y: number, size: number): number {
    const r = size / 2.0;
    return Math.hypot(x + 0.5 - r, y + 0.5 - r);
  }

  /**
   * Classic layout (AprilTag 1 & 2):
   * - dist == 0: white border ('w')
   * - dist == 1: black border ('b')
   * - dist >= 2: data bits ('d')
   */
  public static getClassicLayout(size: number): AprilTag3LayoutDefinition {
    const grid: AprilTag3PixelType[][] = [];
    const bitLocations: [number, number][] = [];

    for (let y = 0; y < size; y++) {
      const row: AprilTag3PixelType[] = [];
      for (let x = 0; x < size; x++) {
        const dist = this.l1DistToEdge(x, y, size);
        let pixel: AprilTag3PixelType;
        if (dist === 0) {
          pixel = 'w';
        } else if (dist === 1) {
          pixel = 'b';
        } else {
          pixel = 'd';
          bitLocations.push([x, y]);
        }
        row.push(pixel);
      }
      grid.push(row);
    }

    return {
      layoutType: 'classic',
      name: `Classic${bitLocations.length}`,
      size,
      totalCells: size * size,
      numBits: bitLocations.length,
      borderWidth: 1,
      reversedBorder: false,
      bitLocations,
      layoutGrid: grid
    };
  }

  /**
   * Standard layout (AprilTag 3 flagship innovation):
   * Data on the outside edge!
   * - dist == 1: black border ring ('b')
   * - dist == 2: white border ring ('w')
   * - dist == 0 or dist >= 3: data bits ('d')
   */
  public static getStandardLayout(size: number): AprilTag3LayoutDefinition {
    const grid: AprilTag3PixelType[][] = [];
    const bitLocations: [number, number][] = [];

    for (let y = 0; y < size; y++) {
      const row: AprilTag3PixelType[] = [];
      for (let x = 0; x < size; x++) {
        const dist = this.l1DistToEdge(x, y, size);
        let pixel: AprilTag3PixelType;
        if (dist === 1) {
          pixel = 'b';
        } else if (dist === 2) {
          pixel = 'w';
        } else {
          pixel = 'd';
          bitLocations.push([x, y]);
        }
        row.push(pixel);
      }
      grid.push(row);
    }

    return {
      layoutType: 'standard',
      name: `Standard${bitLocations.length}`,
      size,
      totalCells: size * size,
      numBits: bitLocations.length,
      borderWidth: 1,
      reversedBorder: false,
      bitLocations,
      layoutGrid: grid
    };
  }

  /**
   * Circle layout (AprilTag 3 circular tags):
   * e.g. TagCircle21h7, TagCircle49h12
   */
  public static getCircleLayout(size: number): AprilTag3LayoutDefinition {
    const grid: AprilTag3PixelType[][] = [];
    const bitLocations: [number, number][] = [];
    const cutoff = size / 2.0 - 0.25;
    const borderDistance = Math.ceil(size / 2.0 - cutoff * Math.SQRT1_2 - 0.5);

    for (let y = 0; y < size; y++) {
      const row: AprilTag3PixelType[] = [];
      for (let x = 0; x < size; x++) {
        const dist = this.l1DistToEdge(x, y, size);
        let pixel: AprilTag3PixelType;
        if (dist === borderDistance) {
          pixel = 'b';
        } else if (dist === borderDistance + 1) {
          pixel = 'w';
        } else if (this.l2DistToCenter(x, y, size) <= cutoff) {
          pixel = 'd';
          bitLocations.push([x, y]);
        } else {
          pixel = 'x'; // outside circle cutoff
        }
        row.push(pixel);
      }
      grid.push(row);
    }

    return {
      layoutType: 'circle',
      name: `Circle${bitLocations.length}`,
      size,
      totalCells: size * size,
      numBits: bitLocations.length,
      borderWidth: 1,
      reversedBorder: false,
      bitLocations,
      layoutGrid: grid
    };
  }

  /**
   * Custom string layout (e.g. "custom_wwwwwwwwwbbbbbbwwbddddbww...")
   * Characters:
   * 'd' = data bit
   * 'w' = white border
   * 'b' = black border
   * 'x' = masked / transparent outside
   * 'r' = recursive tag block
   */
  public static getCustomLayout(name: string, spec: string): AprilTag3LayoutDefinition {
    const cleaned = spec.startsWith('custom_') ? spec.slice(7) : spec;
    const size = Math.round(Math.sqrt(cleaned.length));
    if (size * size !== cleaned.length) {
      throw new Error(`Custom layout string length (${cleaned.length}) is not a perfect square.`);
    }

    const grid: AprilTag3PixelType[][] = [];
    const bitLocations: [number, number][] = [];

    for (let y = 0; y < size; y++) {
      const row: AprilTag3PixelType[] = [];
      for (let x = 0; x < size; x++) {
        const char = cleaned[y * size + x].toLowerCase();
        let pixel: AprilTag3PixelType = 'x';
        if (char === 'd') {
          pixel = 'd';
          bitLocations.push([x, y]);
        } else if (char === 'w') {
          pixel = 'w';
        } else if (char === 'b') {
          pixel = 'b';
        } else if (char === 'r') {
          pixel = 'r';
        } else {
          pixel = 'x';
        }
        row.push(pixel);
      }
      grid.push(row);
    }

    return {
      layoutType: 'custom',
      name: name || `Custom${bitLocations.length}`,
      size,
      totalCells: size * size,
      numBits: bitLocations.length,
      borderWidth: 1,
      reversedBorder: false,
      bitLocations,
      layoutGrid: grid,
      rawLayoutString: cleaned
    };
  }

  /**
   * Generates official AprilTag 3 C library implementation (matching TagToC.java)
   */
  public static generateAprilTag3C(
    layout: AprilTag3LayoutDefinition,
    codes: bigint[],
    minHamming: number
  ): AprilTag3CExport {
    const familyName = `tag${layout.name}h${minHamming}`;
    const macroName = `_TAG${layout.name.toUpperCase()}H${minHamming}`;
    const numCodes = Math.min(codes.length, 65535);

    // Generate Header File (.h)
    const headerFile = `/*
 * AprilTag 3 Tag Family Definition: ${familyName}
 * Automatically generated by Custom Fiducial Marker Designer
 * Compatible with official AprilRobotics/apriltag and AprilRobotics/apriltag-generation
 */

#ifndef ${macroName}
#define ${macroName}

#include "apriltag.h"

#ifdef __cplusplus
extern "C" {
#endif

apriltag_family_t *${familyName}_create();
void ${familyName}_destroy(apriltag_family_t *tf);

#ifdef __cplusplus
}
#endif

#endif // ${macroName}
`;

    // Generate C Source File (.c)
    const codeDataEntries = codes
      .slice(0, numCodes)
      .map((c) => `   0x${c.toString(16).padStart(16, '0')}ULL,`)
      .join('\n');

    const bitXEntries = layout.bitLocations
      .map(([x], i) => `   tf->bit_x[${i}] = ${x};`)
      .join('\n');

    const bitYEntries = layout.bitLocations
      .map(([, y], i) => `   tf->bit_y[${i}] = ${y};`)
      .join('\n');

    const cSourceFile = `/*
 * AprilTag 3 Tag Family Implementation: ${familyName}
 * Bits: ${layout.numBits}, Min Hamming Distance: ${minHamming}, Codes: ${numCodes}
 * Layout Size: ${layout.size}x${layout.size} (${layout.layoutType})
 */

#include <stdlib.h>
#include <string.h>
#include "${familyName}.h"

static uint64_t codedata[${numCodes}] = {
${codeDataEntries}
};

apriltag_family_t *${familyName}_create()
{
   apriltag_family_t *tf = (apriltag_family_t *)calloc(1, sizeof(apriltag_family_t));
   tf->name = strdup("${familyName}");
   tf->h = ${minHamming};
   tf->ncodes = ${numCodes};
   tf->codes = codedata;
   tf->nbits = ${layout.numBits};
   tf->bit_x = (uint32_t *)calloc(${layout.numBits}, sizeof(uint32_t));
   tf->bit_y = (uint32_t *)calloc(${layout.numBits}, sizeof(uint32_t));

${bitXEntries}

${bitYEntries}

   tf->width_at_border = ${layout.borderWidth};
   tf->total_width = ${layout.size};
   tf->reversed_border = ${layout.reversedBorder ? 1 : 0};

   return tf;
}

void ${familyName}_destroy(apriltag_family_t *tf)
{
   if (tf) {
      free(tf->bit_x);
      free(tf->bit_y);
      free(tf->name);
      free(tf);
   }
}
`;

    return {
      headerFile,
      cSourceFile,
      familyName,
      bitCount: layout.numBits,
      minHamming
    };
  }
}
