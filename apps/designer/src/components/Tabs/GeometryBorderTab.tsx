import React, { useState } from 'react';
import {
  BorderConfiguration,
  BorderType,
  MarkerGeometry,
} from '@fiducial/shared-types';
import {
  BorderEvaluator,
  CodebookModel,
  MarkerGeometryModel,
  PRESET_BORDERS,
} from '@fiducial/core';
import { SVGMarkerRenderer } from '@fiducial/renderer';
import { Sliders, Shield, Eye, Info, CheckCircle2 } from 'lucide-react';

interface GeometryBorderTabProps {
  codebook: CodebookModel;
  onUpdateGeometryAndBorder: (geometry: MarkerGeometry, border: BorderConfiguration) => void;
}

export const GeometryBorderTab: React.FC<GeometryBorderTabProps> = ({
  codebook,
  onUpdateGeometryAndBorder,
}) => {
  const [rows, setRows] = useState(codebook.geometry.rows);
  const [cols, setCols] = useState(codebook.geometry.cols);
  const [borderType, setBorderType] = useState<BorderType>(codebook.border.type);
  const [borderWidth, setBorderWidth] = useState(codebook.border.widthInCells);
  const [quietZone, setQuietZone] = useState(codebook.border.quietZoneInCells);
  const [reservedMode, setReservedMode] = useState<'none' | 'corners'>(
    codebook.geometry.reservedCells.length > 0 ? 'corners' : 'none'
  );
  const [physicalSizeMm, setPhysicalSizeMm] = useState(codebook.physical.totalSizeMm || 100);

  // SVG display options
  const [showGridLines, setShowGridLines] = useState(true);
  const [showBitIndices, setShowBitIndices] = useState(true);
  const [showOrientation, setShowOrientation] = useState(true);

  // Recompute border metrics
  const currentBorderConfig: BorderConfiguration = {
    ...PRESET_BORDERS[borderType],
    widthInCells: borderWidth,
    quietZoneInCells: quietZone,
  };

  const evaluation = BorderEvaluator.evaluate(currentBorderConfig, rows, cols);

  // Create temporary geometry for preview
  const currentGeom =
    reservedMode === 'corners'
      ? MarkerGeometryModel.createWithCornerOrientation(rows, cols)
      : MarkerGeometryModel.createDefault(rows, cols);

  // Sample or first code
  const sampleCode = codebook.codes.length > 0 && codebook.codes[0].bitLength === currentGeom.dataBits
    ? codebook.codes[0]
    : undefined;

  const dummyGrid = sampleCode
    ? new MarkerGeometryModel(currentGeom).codeToGrid(sampleCode)
    : Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ((r + c) % 2 === 0 ? 1 : 0))
      );

  const previewSvg = SVGMarkerRenderer.render(dummyGrid, currentBorderConfig, {
    cellSizePx: 44,
    showGridLines,
    showBitIndices,
    showOrientationIndicator: showOrientation,
  });

  const handleApply = () => {
    onUpdateGeometryAndBorder(currentGeom, currentBorderConfig);
  };

  const totalModuleUnits = rows + (borderWidth * 2) + (quietZone * 2);
  const cellPitchMm = Number((physicalSizeMm / totalModuleUnits).toFixed(2));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
      {/* Column 1: Geometry & Border Configuration Controls */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sliders size={18} color="var(--accent-primary)" />
            Marker Geometry
          </div>
        </div>

        {/* Grid Dimensions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Grid Rows</label>
            <input
              type="number"
              min={2}
              max={12}
              className="form-control"
              value={rows}
              onChange={(e) => setRows(Math.max(2, parseInt(e.target.value) || 2))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Grid Columns</label>
            <input
              type="number"
              min={2}
              max={12}
              className="form-control"
              value={cols}
              onChange={(e) => setCols(Math.max(2, parseInt(e.target.value) || 2))}
            />
          </div>
        </div>

        {/* Reserved Cells */}
        <div className="form-group">
          <label className="form-label">Reserved Geometric Anchors</label>
          <select
            className="form-select"
            value={reservedMode}
            onChange={(e) => setReservedMode(e.target.value as any)}
          >
            <option value="none">Standard Payload (0 Reserved Cells)</option>
            <option value="corners">4 Corner Anchors (Fixed 1/0 Orientation)</option>
          </select>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Data Payload: <strong style={{ color: 'var(--accent-cyan)' }}>{currentGeom.dataBits} bits</strong> ({Math.pow(2, Math.min(currentGeom.dataBits, 32)).toLocaleString()} theoretical states)
          </div>
        </div>

        <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border-subtle)' }} />

        {/* Border Strategy */}
        <div className="form-group">
          <label className="form-label">Border Strategy</label>
          <select
            className="form-select"
            value={borderType}
            onChange={(e) => {
              const b = e.target.value as BorderType;
              setBorderType(b);
              setBorderWidth(PRESET_BORDERS[b].widthInCells);
              setQuietZone(PRESET_BORDERS[b].quietZoneInCells);
            }}
          >
            <option value="solid">Solid Border (1.0x - AprilTag/ArUco Standard)</option>
            <option value="thick">Thick Border (2.0x - Long Distance/Motion Blur)</option>
            <option value="thin">Thin Border (0.5x - High Density Payload)</option>
            <option value="double">Double Concentric Ring (False-Positive Rejection)</option>
            <option value="orientation_asymmetric">Orientation Keyed Border (Top Notch)</option>
            <option value="corner_finder">Corner-Enhanced Border (Sub-pixel Quad)</option>
            <option value="finder_pattern">Finder Pattern Border (Scale Invariant)</option>
            <option value="multi_level">Multi-Level Perimeter (Hierarchical)</option>
          </select>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {PRESET_BORDERS[borderType].description}
          </div>
        </div>

        {/* Border Width Slider */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label className="form-label">Border Width</label>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              {borderWidth} cells
            </span>
          </div>
          <input
            type="range"
            min={0.25}
            max={3.0}
            step={0.25}
            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            value={borderWidth}
            onChange={(e) => setBorderWidth(parseFloat(e.target.value))}
          />
        </div>

        {/* Quiet Zone Slider */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label className="form-label">Quiet Zone Margin</label>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {quietZone} cells
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.5}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            value={quietZone}
            onChange={(e) => setQuietZone(parseFloat(e.target.value))}
          />
        </div>

        {/* Physical Marker Scale */}
        <div className="form-group">
          <label className="form-label">Target Printed Size (mm)</label>
          <input
            type="number"
            min={10}
            max={1000}
            className="form-control"
            value={physicalSizeMm}
            onChange={(e) => setPhysicalSizeMm(parseInt(e.target.value) || 100)}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total modules: {totalModuleUnits} | Cell pitch: <strong style={{ color: 'var(--text-primary)' }}>{cellPitchMm} mm/cell</strong>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={handleApply}>
          <CheckCircle2 size={16} />
          Apply Geometry & Border
        </button>
      </div>

      {/* Column 2: Live Marker Visual Preview */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="card-header" style={{ width: '100%' }}>
          <div className="card-title">
            <Eye size={18} color="var(--accent-cyan)" />
            Live Structural Preview
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge accent">{rows}×{cols} Grid</span>
            <span className="badge success">{borderType.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>

        {/* Render container */}
        <div
          style={{
            background: '#ffffff',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />

        {/* Preview View Toggles */}
        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={showGridLines}
              onChange={(e) => setShowGridLines(e.target.checked)}
            />
            Grid Lines
          </label>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={showBitIndices}
              onChange={(e) => setShowBitIndices(e.target.checked)}
            />
            Bit Indices
          </label>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={showOrientation}
              onChange={(e) => setShowOrientation(e.target.checked)}
            />
            Orientation Guide
          </label>
        </div>

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Physical Dimensions: <strong>{physicalSizeMm} mm × {physicalSizeMm} mm</strong> at 300 DPI
        </div>
      </div>

      {/* Column 3: Border Evaluation Scorecard */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Shield size={18} color="var(--accent-emerald)" />
            Border Trade-Off Radar
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Localization Reliability</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.localizationReliability}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.localizationReliability}%`, height: '100%', background: 'var(--accent-primary)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Corner Localization Accuracy</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.cornerAccuracy}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.cornerAccuracy}%`, height: '100%', background: 'var(--accent-cyan)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Detection Distance</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.detectionDistance}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.detectionDistance}%`, height: '100%', background: 'var(--accent-emerald)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Motion Blur Tolerance</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.blurTolerance}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.blurTolerance}%`, height: '100%', background: 'var(--accent-amber)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Perspective Distortion Tolerance</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.perspectiveTolerance}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.perspectiveTolerance}%`, height: '100%', background: '#a855f7' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>False-Positive Resistance</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evaluation.falsePositiveResistance}/100</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${evaluation.falsePositiveResistance}%`, height: '100%', background: '#ec4899' }} />
            </div>
          </div>
        </div>

        {/* Physical Area Distribution */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Physical Area Consumption
          </div>
          <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div
              style={{ width: `${evaluation.dataAreaPercent}%`, background: 'var(--accent-cyan)' }}
              title={`Data: ${evaluation.dataAreaPercent}%`}
            />
            <div
              style={{ width: `${evaluation.physicalAreaOverheadPercent}%`, background: 'var(--accent-rose)' }}
              title={`Border Overhead: ${evaluation.physicalAreaOverheadPercent}%`}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>■ Data Payload: {evaluation.dataAreaPercent}%</span>
            <span style={{ color: 'var(--accent-rose)' }}>■ Border Overhead: {evaluation.physicalAreaOverheadPercent}%</span>
          </div>
        </div>

        {/* Detector compatibility */}
        <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            <Info size={14} color="var(--accent-cyan)" />
            Detector Compatibility
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {evaluation.detectorCompatibility}
          </div>
        </div>
      </div>
    </div>
  );
};
