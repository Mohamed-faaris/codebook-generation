import {
  BinaryCode,
  MarkerGeometryModel,
  PRESET_BORDERS,
  BorderEvaluator,
  OrientationEngine,
  ReflectionEngine,
  HammingAnalyzer,
  CodebookOptimizer,
  MarkerDecoder,
  AprilTag2QuickDecoder,
  CodebookAnalyzer,
  CodebookModel,
} from '../packages/core/src/index.js';
import { CodebookSerializer } from '../packages/serialization/src/index.js';
import { SVGMarkerRenderer, PrintSheetRenderer } from '../packages/renderer/src/index.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log('🧪 Starting Fiducial Core Verification Suite...\n');

  // 1. BinaryCode Tests
  console.log('1. Testing BinaryCode arbitrary-width BigInt operations...');
  const b1 = BinaryCode.fromString('11010011');
  assert(b1.bitLength === 8, 'b1 bitLength');
  assert(b1.popcount() === 5, 'b1 popcount');
  assert(b1.toBinaryString() === '11010011', 'b1 binary string');
  assert(b1.toHexString() === '0xd3', 'b1 hex string');

  const b2 = BinaryCode.fromString('11110000');
  assert(b1.hammingDistance(b2) === 3, 'b1 vs b2 Hamming distance');

  // Test 64-bit and 128-bit width codes (arbitrary width)
  const bigVal = (1n << 120n) | 42n;
  const bigCode = BinaryCode.fromBigInt(bigVal, 128);
  assert(bigCode.bitLength === 128, 'bigCode bitLength');
  assert(bigCode.popcount() === 4, 'bigCode popcount');
  console.log('   ✓ BinaryCode passed (small and 128-bit arbitrary width codes verified).');

  // 2. Geometry Model
  console.log('2. Testing MarkerGeometryModel...');
  const geom = new MarkerGeometryModel(MarkerGeometryModel.createDefault(5, 5));
  assert(geom.dataBitsCount === 25, '5x5 grid bits count');
  const dummyCode = BinaryCode.fromBits(new Uint8Array(25).fill(1));
  const grid = geom.codeToGrid(dummyCode);
  assert(grid.length === 5 && grid[0].length === 5, 'grid dimensions');
  assert(grid[2][2] === 1, 'grid cell value');
  console.log('   ✓ MarkerGeometryModel passed.');

  // 3. Border Evaluator
  console.log('3. Testing BorderEvaluator...');
  const evalSolid = BorderEvaluator.evaluate(PRESET_BORDERS.solid, 5, 5);
  assert(evalSolid.localizationReliability > 80, 'solid border reliability');
  const evalThick = BorderEvaluator.evaluate(PRESET_BORDERS.thick, 5, 5);
  assert(evalThick.blurTolerance > evalSolid.blurTolerance, 'thick border higher blur tolerance');
  console.log('   ✓ BorderEvaluator passed.');

  // 4. Orientation & Rotation Engine
  console.log('4. Testing OrientationEngine 2D rotations...');
  const orientEngine = new OrientationEngine(geom);
  // Asymmetric code with single corner bit
  const bits = new Uint8Array(25);
  bits[0] = 1; // top-left (0, 0)
  const codeAsym = BinaryCode.fromBits(bits);
  const rots = orientEngine.getRotations(codeAsym);
  assert(rots.deg0.toBitArray()[0] === 1, 'rot 0 deg top-left');
  // 90 deg clockwise moves (0, 0) to (0, 4) which is bit index 4
  assert(rots.deg90.toBitArray()[4] === 1, 'rot 90 deg top-right');
  assert(codeAsym.hammingDistance(rots.deg90) === 2, 'self-rotation distance between 0 and 90');
  console.log('   ✓ OrientationEngine passed (4-rotation permutation verified).');

  // 5. Codebook Optimizer (Greedy Search)
  console.log('5. Testing CodebookOptimizer generation...');
  const optimizer = new CodebookOptimizer(geom);
  const optResult = await optimizer.optimize({
    algorithm: 'greedy_pruning',
    targetCount: 4,
    targetMinHammingDistance: 6,
    enforceRotationInvariance: true,
    enforceReflectionInvariance: false,
    enforceCodeBalance: true,
    balanceTolerancePercent: 20,
    maxIterations: 5000,
    weights: {
      hammingSeparation: 1,
      rotationSeparation: 1,
      reflectionSeparation: 0.5,
      codeBalance: 0.5,
      spatialDispersion: 0.5,
    },
  });
  assert(optResult.codes.length === 4, `generated 4 codes, got ${optResult.codes.length}`);
  console.log(`   ✓ Optimizer generated ${optResult.codes.length} codes in ${optResult.elapsedMs}ms with d_min=${optResult.achievedMinDistance}.`);

  // 6. Hamming Analysis & Decoder Model
  console.log('6. Testing HammingAnalyzer & MarkerDecoder...');
  const analysis = HammingAnalyzer.analyze(optResult.codes);
  assert(analysis.minDistance >= 6, `achieved min distance >= 6, was ${analysis.minDistance}`);
  assert(analysis.errorCorrectionCapability >= 2, 'error correction bound');

  const decoder = new MarkerDecoder(geom, optResult.codes);
  // Test exact decode
  const exactDec = decoder.decode(optResult.codes[0], {
    maxAcceptanceDistance: analysis.errorCorrectionCapability,
    minAmbiguityMargin: 1,
    allowReflection: false,
  });
  assert(exactDec.status === 'accepted' && exactDec.matchedId === 0, 'exact decode match');

  // Test 1-bit corruption decode
  const corrupt1 = optResult.codes[0].flipBit(2);
  const dec1 = decoder.decode(corrupt1, {
    maxAcceptanceDistance: analysis.errorCorrectionCapability,
    minAmbiguityMargin: 1,
    allowReflection: false,
  });
  assert(dec1.status === 'accepted' && dec1.matchedId === 0, '1-bit corrupted decode recovered ID 0');

  // Test severe corruption decode (should reject or flag ambiguous)
  const corruptSevere = optResult.codes[0].flipBits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const decSevere = decoder.decode(corruptSevere, {
    maxAcceptanceDistance: analysis.errorCorrectionCapability,
    minAmbiguityMargin: 1,
    allowReflection: false,
  });
  assert(decSevere.status !== 'accepted', 'severe corruption was not falsely accepted');
  console.log('   ✓ MarkerDecoder passed (exact, 1-bit recovery, and severe noise rejection).');

  // 7. Serialization & Rendering
  console.log('7. Testing CodebookSerializer & SVG/Print Sheet Renderers...');
  const model = new CodebookModel(geom, PRESET_BORDERS.solid, optResult.codes);
  const jsonExport = CodebookSerializer.toJson(model);
  assert(jsonExport.identities.length === 4, 'exported identities length');
  assert(jsonExport.formatVersion === '1.0.0', 'json format version');

  const pythonExport = CodebookSerializer.toPython(model);
  assert(pythonExport.includes('CODEBOOK = {'), 'python codebook export');

  const cExport = CodebookSerializer.toCHeader(model);
  assert(cExport.includes('FIDUCIAL_CODES'), 'C header export');

  const svg = SVGMarkerRenderer.renderFromCode(optResult.codes[0], geom, PRESET_BORDERS.solid);
  assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'valid SVG output');

  const printHtml = PrintSheetRenderer.generatePrintableHtml(model);
  assert(printHtml.includes('Printable Sheet') && printHtml.includes('ruler-100mm'), 'printable HTML output');
  console.log('   ✓ Serialization and rendering engines passed.');

  // 8. AprilTag 2 Specific Enhancements (Wang & Olson IROS 2016)
  console.log('8. Testing AprilTag 2 O(1) Quick Decoder & FPR Analyzer...');
  const quickDecoder = new AprilTag2QuickDecoder(geom, optResult.codes, 2);
  assert(quickDecoder.tableSize > 0, 'quickDecoder populated table');

  const qDecExact = quickDecoder.decode(optResult.codes[0]);
  assert(qDecExact.status === 'accepted' && qDecExact.matchedId === 0, 'quickDecoder exact match');

  const qDec1 = quickDecoder.decode(corrupt1);
  assert(qDec1.status === 'accepted' && qDec1.matchedId === 0 && qDec1.observedHammingDistance === 1, 'quickDecoder 1-bit recovery');

  const fprProfiles = CodebookAnalyzer.computeAprilTag2FPRProfiles(25, 4);
  assert(fprProfiles.length === 3, 'FPR profiles for E=0, 1, 2');
  assert(fprProfiles[0].theoreticalFPR < fprProfiles[1].theoreticalFPR, 'FPR monotonically increases with E');

  const apriltag2CHeader = CodebookSerializer.toAprilTag2CHeader(model);
  assert(apriltag2CHeader.includes('apriltag_family_t'), 'apriltag_family_t exported in C header');
  console.log(`   ✓ AprilTag 2 Quick Decoder (${quickDecoder.tableSize} states) and FPR profiles passed.`);

  console.log('\n🎉 ALL 8 SYSTEM VERIFICATION SUITES PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
