import React, { useState } from 'react';
import {
  BorderConfiguration,
  MarkerGeometry,
} from '@fiducial/shared-types';
import {
  BinaryCode,
  CodebookModel,
  MarkerGeometryModel,
} from '@fiducial/core';
import { Header } from './components/Header';
import { GeometryBorderTab } from './components/Tabs/GeometryBorderTab';
import { OptimizerTab } from './components/Tabs/OptimizerTab';
import { MarkerInspectorTab } from './components/Tabs/MarkerInspectorTab';
import { AnalysisTab } from './components/Tabs/AnalysisTab';
import { ExportTab } from './components/Tabs/ExportTab';
import {
  Sliders,
  Cpu,
  Search,
  BarChart3,
  Download,
} from 'lucide-react';

export const App: React.FC = () => {
  const [codebook, setCodebook] = useState<CodebookModel>(() =>
    CodebookModel.createPreset('apriltag_36h11')
  );
  const [activeTab, setActiveTab] = useState<'geometry' | 'optimizer' | 'inspector' | 'analysis' | 'export'>(
    'geometry'
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelectPreset = (preset: any) => {
    const newCodebook = CodebookModel.createPreset(preset);
    setCodebook(newCodebook);
  };

  const handleUpdateGeometryAndBorder = (newGeom: MarkerGeometry, newBorder: BorderConfiguration) => {
    // Reconstruct CodebookModel preserving codes if length matches, else blank codes
    const newGeomModel = new MarkerGeometryModel(newGeom);
    const validCodes = codebook.codes.filter((c) => c.bitLength === newGeomModel.dataBitsCount);
    const updated = new CodebookModel(newGeomModel, newBorder, validCodes, {
      name: `${newGeom.rows}x${newGeom.cols} Custom Family`,
      description: `Custom ${newGeom.rows}x${newGeom.cols} grid with ${newBorder.label}`,
      targetMinDistance: codebook.metadata.targetMinDistance,
    });
    setCodebook(updated);
  };

  const handleUpdateCodes = (
    newCodes: BinaryCode[],
    targetMinDistance: number,
    algorithmId: string
  ) => {
    const updated = new CodebookModel(codebook.geometry, codebook.border, newCodes, {
      ...codebook.metadata,
      algorithmId,
      targetMinDistance,
    });
    setCodebook(updated);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        codebook={codebook}
        onSelectPreset={handleSelectPreset}
        onOpenExport={() => setActiveTab('export')}
        onTriggerGenerate={() => setActiveTab('optimizer')}
        isGenerating={isGenerating}
      />

      {/* Main Tabs Navigation */}
      <nav className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'geometry' ? 'active' : ''}`}
          onClick={() => setActiveTab('geometry')}
        >
          <Sliders size={16} />
          1. Geometry & Border Space
        </button>
        <button
          className={`tab-btn ${activeTab === 'optimizer' ? 'active' : ''}`}
          onClick={() => setActiveTab('optimizer')}
        >
          <Cpu size={16} />
          2. Codebook Generator & Optimizer
        </button>
        <button
          className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Search size={16} />
          3. Marker Inspector & Error Sandbox
        </button>
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={16} />
          4. Distance Matrix & Robustness
        </button>
        <button
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <Download size={16} />
          5. Export & Detector Integration
        </button>
      </nav>

      {/* Main Content Workspace */}
      <main className="main-view">
        {activeTab === 'geometry' && (
          <GeometryBorderTab
            codebook={codebook}
            onUpdateGeometryAndBorder={handleUpdateGeometryAndBorder}
          />
        )}
        {activeTab === 'optimizer' && (
          <OptimizerTab
            codebook={codebook}
            onUpdateCodes={handleUpdateCodes}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        )}
        {activeTab === 'inspector' && <MarkerInspectorTab codebook={codebook} />}
        {activeTab === 'analysis' && <AnalysisTab codebook={codebook} />}
        {activeTab === 'export' && <ExportTab codebook={codebook} />}
      </main>
    </div>
  );
};
