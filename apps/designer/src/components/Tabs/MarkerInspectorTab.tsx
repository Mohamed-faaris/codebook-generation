import React, { useState, useEffect } from 'react';
import {
  CodebookModel,
  BinaryCode,
  MarkerDecoder,
  OrientationEngine,
  ReflectionEngine,
  ErrorCorruptionModel,
} from '@fiducial/core';
import { SVGMarkerRenderer } from '@fiducial/renderer';
import {
  Search,
  RotateCw,
  FlipHorizontal,
  Bug,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface MarkerInspectorTabProps {
  codebook: CodebookModel;
}

export const MarkerInspectorTab: React.FC<MarkerInspectorTabProps> = ({ codebook }) => {
  const [selectedId, setSelectedId] = useState(0);
  const [activeCode, setActiveCode] = useState<BinaryCode | null>(null);
  const [flippedIndices, setFlippedIndices] = useState<Set<number>>(new Set());

  // Keep active code synced with selected ID
  useEffect(() => {
    if (codebook.codes.length > 0) {
      const idx = Math.min(selectedId, codebook.codes.length - 1);
      setSelectedId(idx);
      setActiveCode(codebook.codes[idx].clone());
      setFlippedIndices(new Set());
    } else {
      setActiveCode(null);
    }
  }, [selectedId, codebook]);

  if (codebook.codes.length === 0 || !activeCode) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No markers in codebook. Run the Optimizer first!</p>
      </div>
    );
  }

  const originalCode = codebook.codes[selectedId];
  const geometry = codebook.geometry;
  const orientationEngine = new OrientationEngine(geometry);
  const reflectionEngine = new ReflectionEngine(geometry);
  const decoder = new MarkerDecoder(geometry, codebook.codes);
  const errorModel = new ErrorCorruptionModel(geometry);

  // 4 Rotations
  const rotVariants = orientationEngine.getRotations(originalCode);
  const d90 = originalCode.hammingDistance(rotVariants.deg90);
  const d180 = originalCode.hammingDistance(rotVariants.deg180);
  const d270 = originalCode.hammingDistance(rotVariants.deg270);

  // Reflections
  const refVariants = reflectionEngine.getReflections(originalCode);
  const dRefH = originalCode.hammingDistance(refVariants.horizontal);
  const dRefV = originalCode.hammingDistance(refVariants.vertical);

  // Live decoding of the currently inspected/manipulated code
  const decodeResult = decoder.decode(activeCode, {
    maxAcceptanceDistance: codebook.distanceAnalysis.errorCorrectionCapability || 2,
    minAmbiguityMargin: 1,
    allowReflection: false,
  });

  // Current active grid
  const currentGrid = geometry.codeToGrid(activeCode);

  // Handle cell click to flip bit
  const handleCellClick = (r: number, c: number) => {
    const bitIdx = geometry.cellToDataBitMap[r][c];
    if (bitIdx < 0) return; // reserved cell

    const newCode = activeCode.flipBit(bitIdx);
    setActiveCode(newCode);

    setFlippedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(bitIdx)) {
        next.delete(bitIdx);
      } else {
        next.add(bitIdx);
      }
      return next;
    });
  };

  // Noise injection helpers
  const handleInjectNoise = (flips: number) => {
    const corrupted = errorModel.corrupt(originalCode, {
      modelType: 'isolated_flips',
      flipCount: flips,
    });
    setActiveCode(corrupted);

    // Track which bits differ
    const origBits = originalCode.toBitArray();
    const currBits = corrupted.toBitArray();
    const diffs = new Set<number>();
    for (let i = 0; i < origBits.length; i++) {
      if (origBits[i] !== currBits[i]) diffs.add(i);
    }
    setFlippedIndices(diffs);
  };

  const handleInjectCluster = () => {
    const corrupted = errorModel.corrupt(originalCode, {
      modelType: 'burst_cluster',
      flipCount: 3,
      clusterRadius: 1.5,
    });
    setActiveCode(corrupted);
    const origBits = originalCode.toBitArray();
    const currBits = corrupted.toBitArray();
    const diffs = new Set<number>();
    for (let i = 0; i < origBits.length; i++) {
      if (origBits[i] !== currBits[i]) diffs.add(i);
    }
    setFlippedIndices(diffs);
  };

  const handleResetFlips = () => {
    setActiveCode(originalCode.clone());
    setFlippedIndices(new Set());
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left Column: Marker Gallery List */}
      <div className="card" style={{ maxHeight: '820px', overflowY: 'auto' }}>
        <div className="card-header">
          <div className="card-title">
            <Search size={16} color="var(--accent-primary)" />
            Codebook Gallery ({codebook.count})
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {codebook.entryStats.map((entry) => {
            const isSelected = entry.id === selectedId;
            return (
              <div
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>Marker #{entry.id}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {entry.hexString}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    1s/0s: {entry.onesCount}/{entry.zerosCount} ({Math.round(entry.balanceRatio * 100)}%)
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className={`badge ${entry.minPairwiseDistance >= 6 ? 'success' : 'warning'}`}>
                    d_min={entry.minPairwiseDistance}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Deep Marker Inspector & Sandbox */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Main Interactive Inspector Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="var(--accent-cyan)" />
              Marker #{selectedId} Interactive Sandbox
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge accent">Hex: {originalCode.toHexString()}</span>
              {flippedIndices.size > 0 && (
                <span className="badge danger">{flippedIndices.size} Bit Flips Injected</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Interactive Grid (Click cells to flip bits) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${geometry.cols}, 1fr)`,
                  width: '280px',
                  height: '280px',
                  border: '12px solid #000',
                  borderRadius: '4px',
                  background: '#000',
                  gap: '2px',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {currentGrid.map((rowArr, r) =>
                  rowArr.map((val, c) => {
                    const bitIdx = geometry.cellToDataBitMap[r][c];
                    const isFlipped = bitIdx >= 0 && flippedIndices.has(bitIdx);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`interactive-marker-cell ${val === 1 ? 'bit-one' : 'bit-zero'} ${
                          isFlipped ? 'flipped' : ''
                        }`}
                        onClick={() => handleCellClick(r, c)}
                        title={`Cell (${r},${c}) | Bit #${bitIdx}: ${val} (Click to flip)`}
                      >
                        {bitIdx >= 0 ? val : 'R'}
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                💡 Click any cell above to flip bits and test decoder tolerance
              </div>
            </div>

            {/* Live Observation & Detector Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Decoder Status Box */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background:
                    decodeResult.status === 'accepted'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : decodeResult.status === 'ambiguous'
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(244, 63, 94, 0.12)',
                  border: `1px solid ${
                    decodeResult.status === 'accepted'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : decodeResult.status === 'ambiguous'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(244, 63, 94, 0.3)'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                    {decodeResult.status === 'accepted' && <CheckCircle2 size={18} color="#34d399" />}
                    {decodeResult.status === 'ambiguous' && <AlertTriangle size={18} color="#fbbf24" />}
                    {decodeResult.status === 'rejected' && <XCircle size={18} color="#fb7185" />}
                    <span
                      style={{
                        color:
                          decodeResult.status === 'accepted'
                            ? '#34d399'
                            : decodeResult.status === 'ambiguous'
                            ? '#fbbf24'
                            : '#fb7185',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Detector Status: {decodeResult.status}
                    </span>
                  </div>
                  <span className="badge accent">Confidence: {Math.round(decodeResult.confidenceScore * 100)}%</span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {decodeResult.explanation}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Matched ID: </span>
                    <strong>#{decodeResult.matchedId ?? 'None'}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Hamming Dist: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{decodeResult.observedHammingDistance}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Safety Margin: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      +{decodeResult.ambiguityMargin}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Noise injection actions */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Inject Theoretical Corruption
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleInjectNoise(1)}>
                    <Bug size={12} /> 1 Bit Flip
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleInjectNoise(2)}>
                    <Bug size={12} /> 2 Bit Flips
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleInjectNoise(3)}>
                    <Bug size={12} /> 3 Bit Flips
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleInjectCluster}>
                    <Bug size={12} /> 2x2 Cluster
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleResetFlips} title="Reset">
                    <RefreshCw size={12} /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Rotations & Reflections Side-by-Side Verification */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <RotateCw size={18} color="var(--accent-primary)" />
              Rotational & Reflection Invariance Analysis
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {/* 0 deg */}
            <div style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>0° Reference</div>
              <div
                style={{ width: '90px', height: '90px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(rotVariants.deg0, geometry, codebook.border, {
                    cellSizePx: 12,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div className="badge accent" style={{ marginTop: '0.5rem' }}>Primary</div>
            </div>

            {/* 90 deg */}
            <div style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>90° Clockwise</div>
              <div
                style={{ width: '90px', height: '90px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(rotVariants.deg90, geometry, codebook.border, {
                    cellSizePx: 12,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div className={`badge ${d90 >= 5 ? 'success' : 'warning'}`} style={{ marginTop: '0.5rem' }}>
                d = {d90} bits
              </div>
            </div>

            {/* 180 deg */}
            <div style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>180° Inverted</div>
              <div
                style={{ width: '90px', height: '90px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(rotVariants.deg180, geometry, codebook.border, {
                    cellSizePx: 12,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div className={`badge ${d180 >= 5 ? 'success' : 'warning'}`} style={{ marginTop: '0.5rem' }}>
                d = {d180} bits
              </div>
            </div>

            {/* 270 deg */}
            <div style={{ textAlign: 'center', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>270° Clockwise</div>
              <div
                style={{ width: '90px', height: '90px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(rotVariants.deg270, geometry, codebook.border, {
                    cellSizePx: 12,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div className={`badge ${d270 >= 5 ? 'success' : 'warning'}`} style={{ marginTop: '0.5rem' }}>
                d = {d270} bits
              </div>
            </div>
          </div>

          {/* Reflections Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div
                style={{ width: '70px', height: '70px' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(refVariants.horizontal, geometry, codebook.border, {
                    cellSizePx: 10,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Horizontal Reflection (Flip X)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Separation: <strong style={{ color: 'var(--accent-cyan)' }}>d = {dRefH} bits</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div
                style={{ width: '70px', height: '70px' }}
                dangerouslySetInnerHTML={{
                  __html: SVGMarkerRenderer.renderFromCode(refVariants.vertical, geometry, codebook.border, {
                    cellSizePx: 10,
                    showOrientationIndicator: false,
                  }),
                }}
              />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Vertical Reflection (Flip Y)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Separation: <strong style={{ color: 'var(--accent-cyan)' }}>d = {dRefV} bits</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
