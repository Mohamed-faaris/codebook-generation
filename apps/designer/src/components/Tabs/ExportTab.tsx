import React, { useState } from 'react';
import { CodebookModel } from '@fiducial/core';
import { CodebookSerializer } from '@fiducial/serialization';
import { PrintSheetRenderer, SVGMarkerRenderer } from '@fiducial/renderer';
import {
  Download,
  Copy,
  Check,
  FileCode,
  FileSpreadsheet,
  Printer,
  Code2,
  FileJson,
} from 'lucide-react';

interface ExportTabProps {
  codebook: CodebookModel;
}

export const ExportTab: React.FC<ExportTabProps> = ({ codebook }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'json' | 'python' | 'apriltag_c' | 'c_header' | 'csv' | 'print'>('json');

  const jsonContent = JSON.stringify(CodebookSerializer.toJson(codebook), null, 2);
  const pythonContent = CodebookSerializer.toPython(codebook);
  const apriltagCContent = CodebookSerializer.toAprilTag2CHeader(codebook);
  const cHeaderContent = CodebookSerializer.toCHeader(codebook);
  const csvContent = CodebookSerializer.toCsv(codebook);
  const printHtml = PrintSheetRenderer.generatePrintableHtml(codebook);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenPrintPreview = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printHtml);
      win.document.close();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left Column: Format Navigation */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Download size={18} color="var(--accent-primary)" />
            Export Targets
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <button
            className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('json')}
          >
            <FileJson size={16} /> JSON Specification
          </button>
          <button
            className={`tab-btn ${activeTab === 'python' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('python')}
          >
            <FileCode size={16} /> Python / O(1) Quick Decoder
          </button>
          <button
            className={`tab-btn ${activeTab === 'apriltag_c' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('apriltag_c')}
          >
            <Code2 size={16} color="var(--accent-cyan)" /> AprilTag 2/3 C Library (apriltag_family_t)
          </button>
          <button
            className={`tab-btn ${activeTab === 'c_header' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('c_header')}
          >
            <Code2 size={16} /> C / C++ Standalone Header
          </button>
          <button
            className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('csv')}
          >
            <FileSpreadsheet size={16} /> CSV Code Table
          </button>
          <button
            className={`tab-btn ${activeTab === 'print' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => setActiveTab('print')}
          >
            <Printer size={16} /> Printable Sheet (A4)
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            All exports include complete rotation definitions and boundary tolerances for downstream computer vision pipelines.
          </div>
        </div>
      </div>

      {/* Right Column: Code Viewer & Download Actions */}
      <div className="card">
        {activeTab === 'json' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <FileJson size={18} color="var(--accent-primary)" />
                Universal Codebook JSON (Spec v1.0)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(jsonContent, 'json')}
                >
                  {copiedKey === 'json' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  {copiedKey === 'json' ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    handleDownload(jsonContent, `${codebook.metadata.name.toLowerCase().replace(/\s+/g, '_')}_codebook.json`, 'application/json')
                  }
                >
                  <Download size={14} /> Download .json
                </button>
              </div>
            </div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '520px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                color: '#e2e8f0',
              }}
            >
              {jsonContent}
            </pre>
          </div>
        )}

        {activeTab === 'python' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <FileCode size={18} color="#38bdf8" />
                Python Detector & OpenCV Integration
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(pythonContent, 'python')}
                >
                  {copiedKey === 'python' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  {copiedKey === 'python' ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownload(pythonContent, 'fiducial_detector.py', 'text/x-python')}
                >
                  <Download size={14} /> Download .py
                </button>
              </div>
            </div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '520px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                color: '#38bdf8',
              }}
            >
              {pythonContent}
            </pre>
          </div>
        )}

        {activeTab === 'apriltag_c' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <Code2 size={18} color="var(--accent-cyan)" />
                AprilTag 2 / 3 C Library Integration (apriltag_family_t)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(apriltagCContent, 'apriltag_c')}
                >
                  {copiedKey === 'apriltag_c' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  {copiedKey === 'apriltag_c' ? 'Copied!' : 'Copy AprilTag Header'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    handleDownload(apriltagCContent, `tag${codebook.geometry.rows}x${codebook.geometry.cols}h${codebook.distanceAnalysis.minDistance}.h`, 'text/x-c')
                  }
                >
                  <Download size={14} /> Download tag_family.h
                </button>
              </div>
            </div>
            <div style={{ padding: '0.5rem 0.85rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              Standard C structure compatible with <code>apriltag_detector_add_family_bits()</code> in <code>libapriltag</code> (AprilTag 2 &amp; 3).
            </div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '480px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                color: '#38bdf8',
              }}
            >
              {apriltagCContent}
            </pre>
          </div>
        )}

        {activeTab === 'c_header' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <Code2 size={18} color="#a855f7" />
                C/C++ Header File
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(cHeaderContent, 'c_header')}
                >
                  {copiedKey === 'c_header' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  {copiedKey === 'c_header' ? 'Copied!' : 'Copy Header'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownload(cHeaderContent, 'fiducial_codebook.h', 'text/x-c')}
                >
                  <Download size={14} /> Download .h
                </button>
              </div>
            </div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '520px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                color: '#c084fc',
              }}
            >
              {cHeaderContent}
            </pre>
          </div>
        )}

        {activeTab === 'csv' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <FileSpreadsheet size={18} color="#34d399" />
                CSV Table Export
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(csvContent, 'csv')}
                >
                  {copiedKey === 'csv' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  {copiedKey === 'csv' ? 'Copied!' : 'Copy CSV'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownload(csvContent, 'codebook_summary.csv', 'text/csv')}
                >
                  <Download size={14} /> Download .csv
                </button>
              </div>
            </div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '520px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                color: '#34d399',
              }}
            >
              {csvContent}
            </pre>
          </div>
        )}

        {activeTab === 'print' && (
          <div>
            <div className="card-header">
              <div className="card-title">
                <Printer size={18} color="var(--accent-amber)" />
                Printable Target Sheet Generator
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleOpenPrintPreview}>
                  <Printer size={14} /> Open Printable Sheet in New Tab
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              The printable sheet arranges all {codebook.count} markers with exact millimeter scaling, high-contrast crisp vector lines, 100mm physical calibration check ruler, and cutting guidelines.
            </p>

            <div
              style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '450px',
                overflowY: 'auto',
                color: '#111',
              }}
            >
              <iframe
                title="Print Preview"
                srcDoc={printHtml}
                style={{ width: '100%', height: '420px', border: 'none' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
