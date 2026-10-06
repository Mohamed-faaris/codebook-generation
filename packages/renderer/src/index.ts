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
