import React, { useState } from 'react';
import { CodebookModel, CodebookAnalyzer } from '@fiducial/core';
import { SimulationBenchmarkResult } from '@fiducial/shared-types';
import { BarChart3, Grid, ShieldCheck, Activity, Play, Zap } from 'lucide-react';

interface AnalysisTabProps {
  codebook: CodebookModel;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({ codebook }) => {
  const analysis = codebook.distanceAnalysis;
  const [hoveredPair, setHoveredPair] = useState<{ i: number; j: number; dist: number } | null>(null);

  // Monte-Carlo benchmark results state
  const [benchmarkResults, setBenchmarkResults] = useState<SimulationBenchmarkResult[] | null>(null);
  const [isRunningSim, setIsRunningSim] = useState(false);

  // Compute histogram bars
  const histogramEntries = Object.entries(analysis.distanceHistogram)
    .map(([dist, count]) => ({ dist: parseInt(dist), count }))
    .sort((a, b) => a.dist - b.dist);

  const maxHistCount = Math.max(1, ...histogramEntries.map((h) => h.count));

  // Heatmap color helper
  const getCellColor = (dist: number, i: number, j: number) => {
    if (i === j) return 'var(--bg-tertiary)';
    if (dist < (codebook.metadata.targetMinDistance || 5)) {
      return 'rgba(244, 63, 94, 0.4)';
    }
    // Interpolate between indigo and cyan
    const norm = Math.min(1.0, dist / (codebook.geometry.dataBitsCount || 25));
    return `rgba(99, 102, 241, ${0.2 + norm * 0.7})`;
  };

  const handleRunSimulation = () => {
    setIsRunningSim(true);
    setTimeout(() => {
      const results: SimulationBenchmarkResult[] = [];
      const testFlipLevels = [1, 2, 3, 4];
      for (const flips of testFlipLevels) {
        const res = CodebookAnalyzer.runMonteCarloBenchmark(
          codebook.geometry,
          codebook.codes,
          flips,
          15
        );
        results.push(res);
      }
      setBenchmarkResults(results);
      setIsRunningSim(false);
    }, 50);
  };

  const fpEstimate = CodebookAnalyzer.estimateFalsePositiveProbability(
    codebook.geometry.dataBitsCount,
    codebook.count,
    analysis.errorCorrectionCapability
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Row: Theoretical Coding Bounds */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min Distance (d_min)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
            {analysis.minDistance}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minimum bit separation</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Error Detection</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            ≤ {analysis.errorDetectionCapability} bits
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Guaranteed detection</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Error Correction</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
            ≤ {analysis.errorCorrectionCapability} bits
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unambiguous correction</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mean Distance (μ ± σ)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {analysis.meanDistance} ± {analysis.stdDeviation}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pairwise average</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>False-Positive Resistance</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
            {fpEstimate < 0.0001 ? '< 0.01%' : `${(fpEstimate * 100).toFixed(2)}%`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Uniform noise collision</div>
        </div>
      </div>

      {/* Middle Row: Distance Matrix Heatmap + Histogram */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Pairwise Distance Matrix Heatmap */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Grid size={18} color="var(--accent-primary)" />
              Pairwise Hamming Distance Matrix ({codebook.count}×{codebook.count})
            </div>
            {hoveredPair && (
              <span className="badge accent">
                Pair (#{hoveredPair.i}, #{hoveredPair.j}) : d = {hoveredPair.dist} bits
              </span>
            )}
          </div>

          <div className="matrix-container">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>ID</th>
                  {codebook.codes.map((_, idx) => (
                    <th key={idx} style={{ minWidth: '32px' }}>{idx}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.pairwiseMatrix.map((row, i) => (
                  <tr key={i}>
                    <th>{i}</th>
                    {row.map((dist, j) => (
                      <td
                        key={j}
                        style={{
                          backgroundColor: getCellColor(dist, i, j),
                          color: i === j ? 'var(--text-muted)' : '#ffffff',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoveredPair({ i, j, dist })}
                        onMouseLeave={() => setHoveredPair(null)}
                      >
                        {i === j ? '-' : dist}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distance Distribution Histogram */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={18} color="var(--accent-cyan)" />
              Hamming Distance Distribution
            </div>
            <span className="badge accent">{analysis.totalPairwiseComparisons} Total Pairs</span>
          </div>

          <div className="histogram-container">
            {histogramEntries.map(({ dist, count }) => {
              const heightPct = Math.round((count / maxHistCount) * 100);
              return (
                <div key={dist} className="histogram-bar-wrap" title={`Distance ${dist}: ${count} pairs`}>
                  <span className="histogram-count">{count}</span>
                  <div className="histogram-bar" style={{ height: `${Math.max(6, heightPct)}%` }} />
                  <span className="histogram-label">{dist}</span>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Hamming Distance (Bits)
          </div>
        </div>
      </div>

      {/* Bottom Row: Monte-Carlo Error Resilience Stress Test */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={18} color="var(--accent-emerald)" />
            Monte-Carlo Camera Corruption & Decoder Stress Test
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleRunSimulation} disabled={isRunningSim}>
            <Play size={14} />
            {isRunningSim ? 'Running Simulation...' : 'Run Resilience Test'}
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Simulates optical bit flips, blur, and noise across 100+ random trials to evaluate true-positive decoding, false-positive detection, and ambiguity rejection.
        </p>

        {benchmarkResults ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="matrix-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Bit Flips</th>
                  <th>Total Trials</th>
                  <th>Correct Identification</th>
                  <th>Ambiguous Rejection</th>
                  <th>False Identification</th>
                  <th>Rejected Over-Distance</th>
                  <th>Mean Safety Margin</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkResults.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.flipsPerMarker} bit(s)</td>
                    <td>{r.testCount}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>{r.correctAcceptanceRate}%</td>
                    <td style={{ color: '#fbbf24' }}>{r.ambiguousRejectionRate}%</td>
                    <td style={{ color: r.falsePositiveRate > 0 ? '#fb7185' : 'var(--text-muted)' }}>
                      {r.falsePositiveRate}%
                    </td>
                    <td>{r.totalRejectedRate}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>+{r.averageMargin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Click <strong>"Run Resilience Test"</strong> to inject systematic errors and verify decoder response curves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
