import { BorderConfiguration, PhysicalDimensions } from '@fiducial/shared-types';
import { BinaryCode, CodebookModel, MarkerGeometryModel } from '@fiducial/core';

export interface MarkerRenderOptions {
  cellSizePx?: number;
  showGridLines?: boolean;
  showBitIndices?: boolean;
  showOrientationIndicator?: boolean;
  foregroundColor?: string;
  backgroundColor?: string;
  marginCells?: number;
}

export class SVGMarkerRenderer {
  /**
   * Render a logical marker grid and border to a standalone SVG string.
   */
  static render(
    grid: number[][],
    border: BorderConfiguration,
    options: MarkerRenderOptions = {}
  ): string {
    const rows = grid.length;
    const cols = grid[0].length;
    const cellSize = options.cellSizePx ?? 40;
    const fg = options.foregroundColor ?? '#000000';
    const bg = options.backgroundColor ?? '#ffffff';
    const showGrid = options.showGridLines ?? false;
    const showIndices = options.showBitIndices ?? false;
    const showOrientation = options.showOrientationIndicator ?? true;

    const bWidth = border.widthInCells;
    const qZone = border.quietZoneInCells;

    const totalCols = cols + (bWidth + qZone) * 2;
    const totalRows = rows + (bWidth + qZone) * 2;

    const widthPx = totalCols * cellSize;
    const heightPx = totalRows * cellSize;

    const dataStartX = (qZone + bWidth) * cellSize;
    const dataStartY = (qZone + bWidth) * cellSize;

    const borderStartX = qZone * cellSize;
    const borderStartY = qZone * cellSize;
    const borderWidthPx = (cols + bWidth * 2) * cellSize;
    const borderHeightPx = (rows + bWidth * 2) * cellSize;

    const elements: string[] = [];

    // 1. Background (Quiet zone)
    elements.push(`<rect width="${widthPx}" height="${heightPx}" fill="${bg}" />`);

    // 2. Border rendering by strategy
    switch (border.type) {
      case 'double': {
        const outerThick = bWidth * 0.5 * cellSize;
        const gap = (border.innerGapInCells ?? 0.4) * cellSize;
        const innerThick = bWidth * 0.3 * cellSize;

        // Outer ring
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        // Middle gap
        elements.push(
          `<rect x="${borderStartX + outerThick}" y="${borderStartY + outerThick}" width="${borderWidthPx - outerThick * 2}" height="${borderHeightPx - outerThick * 2}" fill="${bg}" />`
        );
        // Inner ring
        const innerX = borderStartX + outerThick + gap;
        const innerY = borderStartY + outerThick + gap;
        const innerW = borderWidthPx - (outerThick + gap) * 2;
        const innerH = borderHeightPx - (outerThick + gap) * 2;
        elements.push(
          `<rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" fill="${fg}" />`
        );
        // Data background cutout
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        break;
      }

      case 'orientation_asymmetric': {
        // Solid border
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        // Data cutout
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        // Top asymmetric notch (white triangular notch at top center border)
        const notchW = cellSize * 1.2;
        const notchH = (bWidth * cellSize) * 0.75;
        const notchX = borderStartX + borderWidthPx / 2 - notchW / 2;
        const notchY = borderStartY;
        elements.push(
          `<polygon points="${notchX},${notchY} ${notchX + notchW},${notchY} ${notchX + notchW / 2},${notchY + notchH}" fill="${bg}" />`
        );
        break;
      }

      case 'corner_finder': {
        // Solid border
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        // Data cutout
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        // Four corner finder squares / circles
        const cornerSize = (border.cornerSizeInCells ?? 1.2) * cellSize * 0.7;
        const corners = [
          { x: borderStartX, y: borderStartY },
          { x: borderStartX + borderWidthPx - cornerSize, y: borderStartY },
          { x: borderStartX, y: borderStartY + borderHeightPx - cornerSize },
          { x: borderStartX + borderWidthPx - cornerSize, y: borderStartY + borderHeightPx - cornerSize },
        ];
        for (const c of corners) {
          elements.push(
            `<rect x="${c.x}" y="${c.y}" width="${cornerSize}" height="${cornerSize}" fill="${bg}" stroke="${fg}" stroke-width="${cellSize * 0.1}" />`
          );
        }
        break;
      }

      case 'finder_pattern': {
        // L-shaped outer perimeter
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        // Data cutout
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        // Alternating perimeter timing track on top & right
        for (let i = 0; i < cols; i += 2) {
          const x = dataStartX + i * cellSize;
          const y = borderStartY;
          elements.push(
            `<rect x="${x}" y="${y}" width="${cellSize}" height="${bWidth * cellSize * 0.6}" fill="${bg}" />`
          );
        }
        break;
      }

      case 'multi_level': {
        // Stepped rings
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        const step = bWidth * 0.3 * cellSize;
        elements.push(
          `<rect x="${borderStartX + step}" y="${borderStartY + step}" width="${borderWidthPx - step * 2}" height="${borderHeightPx - step * 2}" fill="${bg}" />`
        );
        elements.push(
          `<rect x="${borderStartX + step * 2}" y="${borderStartY + step * 2}" width="${borderWidthPx - step * 4}" height="${borderHeightPx - step * 4}" fill="${fg}" />`
        );
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        break;
      }

      case 'solid':
      case 'thick':
      case 'thin':
      default: {
        // Standard solid perimeter
        elements.push(
          `<rect x="${borderStartX}" y="${borderStartY}" width="${borderWidthPx}" height="${borderHeightPx}" fill="${fg}" />`
        );
        elements.push(
          `<rect x="${dataStartX}" y="${dataStartY}" width="${cols * cellSize}" height="${rows * cellSize}" fill="${bg}" />`
        );
        break;
      }
    }

    // 3. Render Data Cells
    let bitCounter = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = dataStartX + c * cellSize;
        const y = dataStartY + r * cellSize;
        const isOne = grid[r][c] === 1;

        if (isOne) {
          elements.push(
            `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fg}" shape-rendering="crispEdges" />`
          );
        }

        if (showIndices) {
          const textColor = isOne ? bg : fg;
          elements.push(
            `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 4}" font-size="${Math.max(9, cellSize * 0.28)}" fill="${textColor}" text-anchor="middle" font-family="monospace">${bitCounter}</text>`
          );
          bitCounter++;
        }
      }
    }

    // 4. Grid lines overlay (optional)
    if (showGrid) {
      for (let r = 0; r <= rows; r++) {
        const y = dataStartY + r * cellSize;
        elements.push(
          `<line x1="${dataStartX}" y1="${y}" x2="${dataStartX + cols * cellSize}" y2="${y}" stroke="rgba(128,128,128,0.5)" stroke-width="1" stroke-dasharray="2 2" />`
        );
      }
      for (let c = 0; c <= cols; c++) {
        const x = dataStartX + c * cellSize;
        elements.push(
          `<line x1="${x}" y1="${dataStartY}" x2="${x}" y2="${dataStartY + rows * cellSize}" stroke="rgba(128,128,128,0.5)" stroke-width="1" stroke-dasharray="2 2" />`
        );
      }
    }

    // 5. Orientation arrow indicator (optional subtle top guide)
    if (showOrientation) {
      const arrowY = borderStartY * 0.5;
      const arrowX = widthPx / 2;
      const arrowSize = cellSize * 0.25;
      elements.push(
        `<polygon points="${arrowX},${arrowY - arrowSize} ${arrowX + arrowSize},${arrowY + arrowSize} ${arrowX - arrowSize},${arrowY + arrowSize}" fill="rgba(239, 68, 68, 0.8)" />`
      );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}" style="display:block;">${elements.join('')}</svg>`;
  }

  /**
   * Helper to render directly from code and geometry model.
   */
  static renderFromCode(
    code: BinaryCode,
    geometry: MarkerGeometryModel,
    border: BorderConfiguration,
    options: MarkerRenderOptions = {}
  ): string {
    const grid = geometry.codeToGrid(code);
    return SVGMarkerRenderer.render(grid, border, options);
  }
}

export class PrintSheetRenderer {
  /**
   * Generate complete printable HTML sheet (A4 / US Letter) with cutting guidelines and millimeter scale.
   */
  static generatePrintableHtml(
    codebook: CodebookModel,
    options: {
      pageSize?: 'A4' | 'Letter';
      columns?: number;
      markerPhysicalSizeMm?: number;
    } = {}
  ): string {
    const pageSize = options.pageSize || 'A4';
    const cols = options.columns || 3;
    const sizeMm = options.markerPhysicalSizeMm || codebook.physical.totalSizeMm || 60;

    const markersHtml = codebook.codes
      .map((code, idx) => {
        const svg = SVGMarkerRenderer.renderFromCode(
          code,
          codebook.geometry,
          codebook.border,
          { cellSizePx: 30, showOrientationIndicator: true }
        );
        return `
        <div class="marker-card">
          <div class="marker-header">ID #${idx} (${code.toHexString()})</div>
          <div class="marker-svg-wrap">${svg}</div>
          <div class="marker-footer">Physical Size: ${sizeMm} mm</div>
        </div>
      `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${codebook.metadata.name} - Printable Sheet</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      color: #111;
      background: #fff;
    }
    .sheet-header {
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sheet-title {
      font-size: 18px;
      font-weight: bold;
    }
    .sheet-meta {
      font-size: 11px;
      color: #555;
    }
    .calibration-bar {
      margin-bottom: 20px;
      padding: 6px 10px;
      border: 1px dashed #666;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ruler-100mm {
      width: 100mm;
      height: 6px;
      background: repeating-linear-gradient(90deg, #000 0mm, #000 1mm, #fff 1mm, #fff 10mm);
      border: 1px solid #000;
    }
    .grid-container {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 20px;
    }
    .marker-card {
      border: 1px dashed #aaa;
      padding: 10px;
      text-align: center;
      page-break-inside: avoid;
    }
    .marker-header {
      font-family: monospace;
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .marker-svg-wrap svg {
      width: 100%;
      height: auto;
      max-width: ${sizeMm}mm;
      margin: 0 auto;
    }
    .marker-footer {
      font-size: 10px;
      color: #666;
      margin-top: 6px;
    }
    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet-header">
    <div>
      <div class="sheet-title">${codebook.metadata.name}</div>
      <div class="sheet-meta">Algorithm: ${codebook.metadata.algorithmId} | Min Hamming Separation: d = ${codebook.distanceAnalysis.minDistance}</div>
    </div>
    <div class="sheet-meta">Total Markers: ${codebook.count}</div>
  </div>

  <div class="calibration-bar">
    <span>Calibration Check (Verify 100mm with physical ruler):</span>
    <div class="ruler-100mm"></div>
    <span>100 mm</span>
  </div>

  <div class="grid-container">
    ${markersHtml}
  </div>
</body>
</html>`;
  }
}

/**
 * Mosaic Renderer (Official AprilTag Distribution Format: apriltag-imgs mosaic)
 * Generates a unified reference mosaic containing every tag in the codebook.
 */
export class MosaicRenderer {
  static renderMosaicSvg(
    codebook: CodebookModel,
    columns: number = 6,
    markerCellSizePx: number = 18
  ): string {
    const K = codebook.count;
    const cols = Math.min(columns, K);
    const rows = Math.ceil(K / cols);

    const singleMarkerUnits = codebook.geometry.cols + (codebook.border.widthInCells + codebook.border.quietZoneInCells) * 2;
    const tagSizePx = singleMarkerUnits * markerCellSizePx;
    const cardPaddingPx = 16;
    const labelHeightPx = 22;

    const cellWidthPx = tagSizePx + cardPaddingPx * 2;
    const cellHeightPx = tagSizePx + cardPaddingPx * 2 + labelHeightPx;

    const totalWidthPx = cols * cellWidthPx;
    const totalHeightPx = rows * cellHeightPx + 40; // top title bar

    const items: string[] = [];

    // Header background
    items.push(`<rect width="${totalWidthPx}" height="${totalHeightPx}" fill="#0f172a" />`);
    items.push(
      `<text x="${totalWidthPx / 2}" y="28" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="bold" fill="#f8fafc" text-anchor="middle">${codebook.metadata.name} - Complete Family Mosaic (${K} Tags, d_min=${codebook.distanceAnalysis.minDistance})</text>`
    );

    for (let idx = 0; idx < K; idx++) {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = c * cellWidthPx;
      const y = 40 + r * cellHeightPx;

      const code = codebook.codes[idx];
      const tagSvgRaw = SVGMarkerRenderer.renderFromCode(code, codebook.geometry, codebook.border, {
        cellSizePx: markerCellSizePx,
        showOrientationIndicator: false,
      });

      // Extract inner elements of tag SVG
      const innerSvg = tagSvgRaw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

      items.push(`
        <g transform="translate(${x + cardPaddingPx}, ${y + cardPaddingPx})">
          <rect x="-4" y="-4" width="${tagSizePx + 8}" height="${tagSizePx + labelHeightPx + 8}" fill="#1e293b" rx="6" stroke="#334155" stroke-width="1" />
          <g transform="translate(0, 0)">${innerSvg}</g>
          <text x="${tagSizePx / 2}" y="${tagSizePx + 16}" font-family="monospace" font-size="11" font-weight="bold" fill="#38bdf8" text-anchor="middle">ID #${idx} (${code.toHexString()})</text>
        </g>
      `);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidthPx} ${totalHeightPx}" width="${totalWidthPx}" height="${totalHeightPx}">${items.join('')}</svg>`;
  }
}

/**
 * Camera Calibration Target Board Generator (AprilCal Architecture - Richardson & Olson, IROS 2013)
 * Produces accurate planar camera calibration targets with known metric corner coordinates.
 */
export class CalibrationBoardRenderer {
  static renderCalibrationBoard(
    codebook: CodebookModel,
    options: {
      boardRows?: number;
      boardCols?: number;
      tagSizeMm?: number;
      tagSpacingMm?: number;
    } = {}
  ): {
    svg: string;
    targetYaml: string;
    totalTags: number;
    boardWidthMm: number;
    boardHeightMm: number;
  } {
    const bRows = options.boardRows || 4;
    const bCols = options.boardCols || 6;
    const tagSizeMm = options.tagSizeMm || 35;
    const spacingMm = options.tagSpacingMm || 10;

    const totalTags = Math.min(codebook.count, bRows * bCols);
    const marginMm = 15;
    const boardWidthMm = marginMm * 2 + bCols * tagSizeMm + (bCols - 1) * spacingMm;
    const boardHeightMm = marginMm * 2 + bRows * tagSizeMm + (bRows - 1) * spacingMm;

    const scale = 3.7795; // mm to pixels at 96 DPI
    const boardWidthPx = boardWidthMm * scale;
    const boardHeightPx = boardHeightMm * scale;

    const elements: string[] = [];
    elements.push(`<rect width="${boardWidthPx}" height="${boardHeightPx}" fill="#ffffff" />`);

    const cornerCoordsList: Array<{ id: number; corners: Array<{ x: number; y: number; z: number }> }> = [];

    let tagIdx = 0;
    for (let r = 0; r < bRows; r++) {
      for (let c = 0; c < bCols; c++) {
        if (tagIdx >= totalTags) break;

        const posXmm = marginMm + c * (tagSizeMm + spacingMm);
        const posYmm = marginMm + r * (tagSizeMm + spacingMm);

        const posXPx = posXmm * scale;
        const posYPx = posYmm * scale;
        const sizePx = tagSizeMm * scale;

        const code = codebook.codes[tagIdx];
        const singleTagSvg = SVGMarkerRenderer.renderFromCode(code, codebook.geometry, codebook.border, {
          cellSizePx: Math.floor(sizePx / (codebook.geometry.cols + 4)),
          showOrientationIndicator: false,
        });

        const innerSvg = singleTagSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
        elements.push(`
          <g transform="translate(${posXPx}, ${posYPx})">
            ${innerSvg}
            <text x="${sizePx / 2}" y="${sizePx + 12}" font-family="monospace" font-size="9" fill="#000000" text-anchor="middle">ID:${tagIdx}</text>
          </g>
        `);

        // Record 3D planar corner coordinates in millimeters (counter-clockwise from top-left)
        cornerCoordsList.push({
          id: tagIdx,
          corners: [
            { x: posXmm, y: posYmm, z: 0.0 },
            { x: posXmm + tagSizeMm, y: posYmm, z: 0.0 },
            { x: posXmm + tagSizeMm, y: posYmm + tagSizeMm, z: 0.0 },
            { x: posXmm, y: posYmm + tagSizeMm, z: 0.0 },
          ],
        });

        tagIdx++;
      }
    }

    // Top calibration check ruler
    const rulerXPx = marginMm * scale;
    const rulerYPx = 6 * scale;
    const rulerWPx = 100 * scale;
    elements.push(`
      <g transform="translate(${rulerXPx}, ${rulerYPx})">
        <rect width="${rulerWPx}" height="4" fill="#000000" />
        <text x="${rulerWPx + 6}" y="6" font-family="sans-serif" font-size="8" fill="#555555">100 mm Calibration Scale</text>
      </g>
    `);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boardWidthPx} ${boardHeightPx}" width="${boardWidthPx}" height="${boardHeightPx}">${elements.join('')}</svg>`;

    // Format AprilCal / OpenCV camera calibration YAML
    const yamlLines = [
      `# AprilCal Camera Calibration Board Definition`,
      `# Reference: Richardson & Olson, IROS 2013`,
      `tag_family: "${codebook.metadata.name}"`,
      `grid_rows: ${bRows}`,
      `grid_cols: ${bCols}`,
      `tag_size_meters: ${(tagSizeMm / 1000).toFixed(4)}`,
      `tag_spacing_meters: ${(spacingMm / 1000).toFixed(4)}`,
      `board_width_meters: ${(boardWidthMm / 1000).toFixed(4)}`,
      `board_height_meters: ${(boardHeightMm / 1000).toFixed(4)}`,
      `tags:`,
    ];

    for (const item of cornerCoordsList) {
      yamlLines.push(`  - id: ${item.id}`);
      yamlLines.push(`    corners:`);
      for (const pt of item.corners) {
        yamlLines.push(`      - [${(pt.x / 1000).toFixed(4)}, ${(pt.y / 1000).toFixed(4)}, 0.0]`);
      }
    }

    return {
      svg,
      targetYaml: yamlLines.join('\n'),
      totalTags,
      boardWidthMm,
      boardHeightMm,
    };
  }
}

