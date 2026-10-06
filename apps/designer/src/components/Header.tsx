import React from 'react';
import { Layers, Download, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { CodebookModel } from '@fiducial/core';

interface HeaderProps {
  codebook: CodebookModel;
  onSelectPreset: (preset: 'apriltag_36h11' | 'aruco_5x5' | 'micro_4x4' | 'asymmetric_robotics' | 'scale_invariant_double') => void;
  onOpenExport: () => void;
  onTriggerGenerate: () => void;
  isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  codebook,
  onSelectPreset,
  onOpenExport,
  onTriggerGenerate,
  isGenerating,
}) => {
  const analysis = codebook.distanceAnalysis;

  return (
    <header className="top-nav">
      <div className="brand-section">
        <div className="brand-icon-box">
          <Layers size={22} color="#ffffff" />
        </div>
        <div>
          <div className="brand-title">FIDUCIAL STUDIO</div>
          <div className="brand-subtitle">Custom Marker Designer & Codebook Generator</div>
        </div>
      </div>

      <div className="nav-actions">
        {/* Preset Selector */}
        <div className="preset-dropdown">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Preset:</span>
          <select
            className="form-select"
            style={{ padding: '0.35rem 1.8rem 0.35rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
            onChange={(e) => onSelectPreset(e.target.value as any)}
            defaultValue="apriltag_36h11"
          >
            <option value="apriltag_36h11">AprilTag 36h11 (6x6)</option>
            <option value="aruco_5x5">ArUco 5x5 Equivalent</option>
            <option value="micro_4x4">Micro-Fiducial 4x4 (Thin)</option>
            <option value="asymmetric_robotics">Robotics Keyed (5x5)</option>
            <option value="scale_invariant_double">Dual-Ring (6x6)</option>
          </select>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="badge accent">
            Grid: {codebook.geometry.rows}×{codebook.geometry.cols} ({codebook.geometry.dataBitsCount}b)
          </div>
          <div className="badge success">
            Identities: {codebook.count}
          </div>
          <div className={`badge ${analysis.minDistance >= 5 ? 'success' : analysis.minDistance > 0 ? 'warning' : 'danger'}`}>
            d_min = {analysis.minDistance}
          </div>
        </div>

        {/* Generate / Action Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onTriggerGenerate}
          disabled={isGenerating}
          title="Run Codebook Optimization"
        >
          <Play size={14} />
          {isGenerating ? 'Optimizing...' : 'Generate Codes'}
        </button>

        {/* Export Button */}
        <button className="btn btn-secondary btn-sm" onClick={onOpenExport} title="Export Codebook">
          <Download size={14} />
          Export Hub
        </button>
      </div>
    </header>
  );
};
