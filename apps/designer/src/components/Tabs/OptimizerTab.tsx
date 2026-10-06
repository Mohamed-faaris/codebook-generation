import React, { useState } from 'react';
import {
  OptimizationAlgorithm,
  OptimizationConfig,
  OptimizationProgress,
} from '@fiducial/shared-types';
import { BinaryCode, CodebookModel, CodebookOptimizer } from '@fiducial/core';
import { Cpu, Play, Square, CheckCircle, AlertTriangle, Sparkles, Terminal } from 'lucide-react';

interface OptimizerTabProps {
  codebook: CodebookModel;
  onUpdateCodes: (newCodes: BinaryCode[], targetMinDistance: number, algorithmId: string) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export const OptimizerTab: React.FC<OptimizerTabProps> = ({
  codebook,
  onUpdateCodes,
  isGenerating,
  setIsGenerating,
}) => {
  const [targetCount, setTargetCount] = useState(codebook.count > 0 ? codebook.count : 8);
  const [targetMinDistance, setTargetMinDistance] = useState(codebook.metadata.targetMinDistance || 7);
  const [enforceRotation, setEnforceRotation] = useState(true);
  const [enforceReflection, setEnforceReflection] = useState(false);
  const [enforceBalance, setEnforceBalance] = useState(true);
  const [balanceTolerance, setBalanceTolerance] = useState(15);
  // AprilTag 2 / Wang & Olson 2016 Minimum Complexity Heuristics
  const [enforceComplexity, setEnforceComplexity] = useState(true);
  const [minTransitions, setMinTransitions] = useState(Math.floor(codebook.geometry.totalCells * 0.35));
  const [maxRunLength, setMaxRunLength] = useState(Math.max(3, Math.ceil(codebook.geometry.cols * 0.6)));
  const [algorithm, setAlgorithm] = useState<OptimizationAlgorithm>('greedy_pruning');
  const [maxIterations, setMaxIterations] = useState(10000);

  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const cancelRef = React.useRef(false);

  const handleStartOptimization = async () => {
    cancelRef.current = false;
    setIsGenerating(true);
    setProgress({
      iteration: 0,
      maxIterations,
      currentFoundCount: 0,
      currentMinDistance: targetMinDistance,
      bestScore: 0,
      elapsedMs: 0,
      status: 'running',
      message: 'Initializing candidate search...',
    });

    setLogMessages((prev) => [
      `[${new Date().toLocaleTimeString()}] Starting ${algorithm} search: target K=${targetCount}, d_min=${targetMinDistance}, grid=${codebook.geometry.rows}x${codebook.geometry.cols}`,
      `[${new Date().toLocaleTimeString()}] AprilTag 2 Complexity Filter: ${enforceComplexity ? `ACTIVE (minTransitions=${minTransitions}, maxRun=${maxRunLength})` : 'OFF'}`,
      ...prev,
    ]);

    const optimizer = new CodebookOptimizer(codebook.geometry);
    const config: OptimizationConfig = {
      algorithm,
      targetCount,
      targetMinHammingDistance: targetMinDistance,
      enforceRotationInvariance: enforceRotation,
      enforceReflectionInvariance: enforceReflection,
      enforceCodeBalance: enforceBalance,
      balanceTolerancePercent: balanceTolerance,
      enforceAprilTag2Complexity: enforceComplexity,
      minTransitions,
      maxRunLength,
      maxIterations,
      weights: {
        hammingSeparation: 1.0,
        rotationSeparation: 1.2,
        reflectionSeparation: 0.8,
        codeBalance: 0.5,
        spatialDispersion: 0.5,
      },
    };

    try {
      const result = await optimizer.optimize(
        config,
        (p) => {
          setProgress(p);
        },
        () => cancelRef.current
      );

      setIsGenerating(false);
      setProgress({
        iteration: result.iterationsRun,
        maxIterations,
        currentFoundCount: result.totalGenerated,
        currentMinDistance: result.achievedMinDistance,
        bestScore: result.totalGenerated,
        elapsedMs: result.elapsedMs,
        status: cancelRef.current ? 'cancelled' : 'completed',
        message: cancelRef.current
          ? `Cancelled after ${result.iterationsRun} iterations.`
          : `Finished! Generated ${result.totalGenerated} markers in ${result.elapsedMs}ms.`,
      });

      setLogMessages((prev) => [
        `[${new Date().toLocaleTimeString()}] Optimization completed: ${result.totalGenerated} codes generated in ${result.elapsedMs}ms (d_min=${result.achievedMinDistance})`,
        ...prev,
      ]);

      if (result.codes.length > 0) {
        onUpdateCodes(result.codes, targetMinDistance, algorithm);
      }
    } catch (err: any) {
      setIsGenerating(false);
      setLogMessages((prev) => [
        `[${new Date().toLocaleTimeString()}] Error during optimization: ${err.message}`,
        ...prev,
      ]);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const progressPercent = progress
    ? Math.min(100, Math.round((progress.currentFoundCount / targetCount) * 100))
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left: Configuration Form */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Cpu size={18} color="var(--accent-primary)" />
            Optimization Parameters
          </div>
          <span className="badge accent">{codebook.geometry.dataBitsCount} Bits Available</span>
        </div>

        {/* Target Identity Count K */}
        <div className="form-group">
          <label className="form-label">Target Identities Count (K)</label>
          <input
            type="number"
            min={2}
            max={256}
            className="form-control"
            value={targetCount}
            onChange={(e) => setTargetCount(Math.max(2, parseInt(e.target.value) || 2))}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Number of distinct valid marker identities to generate.
          </div>
        </div>

        {/* Target Min Hamming Distance */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label className="form-label">Target Min Distance (d_min)</label>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              d = {targetMinDistance} bits
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.min(18, Math.floor(codebook.geometry.dataBitsCount * 0.5))}
            step={1}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            value={targetMinDistance}
            onChange={(e) => setTargetMinDistance(parseInt(e.target.value))}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Theoretical error correction: <strong>e_corr = {Math.floor((targetMinDistance - 1) / 2)} bits</strong>
          </div>
        </div>

        {/* Algorithm Strategy */}
        <div className="form-group">
          <label className="form-label">Search Strategy</label>
          <select
            className="form-select"
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as OptimizationAlgorithm)}
          >
            <option value="greedy_pruning">Greedy Lexicographic Pruning (Fast & High Distance)</option>
            <option value="simulated_annealing">Simulated Annealing (Global Energy Optimization)</option>
            <option value="local_search_hill_climbing">Local Search / Hill Climbing</option>
            <option value="random_monte_carlo">Random Monte-Carlo Baseline</option>
            <option value="exhaustive_search">Exhaustive Search (Small bit spaces)</option>
          </select>
        </div>

        {/* Multi-Objective Constraints */}
        <div className="form-group">
          <label className="form-label">Separation Constraints</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={enforceRotation}
                onChange={(e) => setEnforceRotation(e.target.checked)}
              />
              Enforce 4-Rotation Invariance (0°, 90°, 180°, 270°)
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={enforceReflection}
                onChange={(e) => setEnforceReflection(e.target.checked)}
              />
              Enforce Reflection Invariance (Mirrored images)
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={enforceBalance}
                onChange={(e) => setEnforceBalance(e.target.checked)}
              />
              Enforce Code Balance (0/1 ratio near 50%)
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={enforceComplexity}
                onChange={(e) => setEnforceComplexity(e.target.checked)}
              />
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                AprilTag 2 Complexity Filter (Wang & Olson 2016)
              </span>
            </label>
          </div>
        </div>

        {enforceComplexity && (
          <div className="form-group" style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--accent-cyan)', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Rejects low-frequency patterns, solid blocks, and stripes to suppress natural scene false positives.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Min Transitions</label>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>≥ {minTransitions} edges</span>
            </div>
            <input
              type="range"
              min={2}
              max={codebook.geometry.totalCells}
              step={1}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)', marginBottom: '0.6rem' }}
              value={minTransitions}
              onChange={(e) => setMinTransitions(parseInt(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Max Continuous Run-Length</label>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>≤ {maxRunLength} cells</span>
            </div>
            <input
              type="range"
              min={2}
              max={codebook.geometry.cols}
              step={1}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              value={maxRunLength}
              onChange={(e) => setMaxRunLength(parseInt(e.target.value))}
            />
          </div>
        )}

        {enforceBalance && (
          <div className="form-group" style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Balance Tolerance</label>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>±{balanceTolerance}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              value={balanceTolerance}
              onChange={(e) => setBalanceTolerance(parseInt(e.target.value))}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Max Iterations Limit</label>
          <input
            type="number"
            min={1000}
            max={100000}
            step={1000}
            className="form-control"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10000)}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          {!isGenerating ? (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleStartOptimization}>
              <Play size={16} />
              Run Optimizer
            </button>
          ) : (
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleCancel}>
              <Square size={16} />
              Stop / Cancel
            </button>
          )}
        </div>
      </div>

      {/* Right: Live Monitor & Progress Dashboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Progress Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Sparkles size={18} color="var(--accent-cyan)" />
              Optimization Monitor
            </div>
            {isGenerating && (
              <span className="badge accent animate-pulse-glow">
                Computing ({progress?.elapsedMs || 0} ms)
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Identities Discovered: <strong>{progress?.currentFoundCount || codebook.count} / {targetCount}</strong>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{ height: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'var(--accent-gradient)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min Distance</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {progress?.currentMinDistance ?? codebook.distanceAnalysis.minDistance}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Evaluations</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {progress?.iteration ?? 0}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elapsed Time</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {progress ? `${(progress.elapsedMs / 1000).toFixed(1)}s` : '0.0s'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Error Correction</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                {Math.max(0, Math.floor(((progress?.currentMinDistance ?? codebook.distanceAnalysis.minDistance) - 1) / 2))} b
              </div>
            </div>
          </div>

          {progress?.message && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {progress.message}
            </div>
          )}
        </div>

        {/* Live Execution Console Log */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="var(--accent-emerald)" />
              Search & Convergence Log
            </div>
          </div>
          <div
            style={{
              background: '#070a10',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: '#34d399',
              height: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {logMessages.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Awaiting optimization run...</span>
            ) : (
              logMessages.map((msg, idx) => <div key={idx}>{msg}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
