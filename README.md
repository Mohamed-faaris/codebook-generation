# Custom Fiducial Marker Designer & Codebook Generator

A modular, browser-based marker design and codebook generation system designed for computer vision and robotics research.

## Features

- **Decoupled Design Space**: Treat marker geometry, border structure, data encoding, rotation behavior, reflection behavior, and decoding ambiguity as independent design parameters.
- **Arbitrary-Width Binary Codes**: Supported via `BinaryCode` backed by `BigInt` and `Uint8Array`, free from JavaScript finite integer precision limits.
- **8 Border Paradigms**: Solid, Thick (distance/blur), Thin (high density), Double-ring, Orientation-keyed, Corner-enhanced, Finder-pattern, and Multi-level hierarchical borders with an automated computer vision trade-off evaluator.
- **Multi-Strategy Optimization**: Greedy lexicographic pruning, Simulated Annealing, Local Search / Hill Climbing, Random Monte-Carlo, and Exhaustive search.
- **Invariance & Ambiguity Protections**: Enforce 4-rotation (0°, 90°, 180°, 270°) and reflection invariance, plus code balance constraints.
- **Interactive Sandbox & Live Decoder**: Real-time bit manipulation, noise/burst corruption injection, and live confidence/margin classification (`ACCEPTED`, `AMBIGUOUS`, `REJECTED`).
- **Statistical & Quantitative Analysis**: Full $K \times K$ pairwise Hamming distance heatmap, distance histogram, error bounds, and Monte-Carlo stress testing.
- **Cross-Platform Export**: Universal JSON Spec (v1.0.0), Python/OpenCV detection module, C/C++ header, CSV table, and printable sheets with a 100mm calibration test bar.

## Architecture

```text
codebook-generation/
├── apps/
│   └── designer/          # React 18 + Vite scientific workstation UI
├── packages/
│   ├── shared-types/      # TypeScript interfaces and domain schemas
│   ├── core/              # BigInt BinaryCode, geometry, borders, optimizer, decoder
│   ├── renderer/          # SVG and printable target layout renderers
│   └── serialization/     # JSON, Python, C/C++, and CSV serializers
└── scripts/
    └── test-suite.ts      # Automated verification test suite
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 10

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open `http://localhost:5173/` in your browser.

### Production Build

```bash
pnpm build
```

### Verification Test Suite

```bash
pnpm exec tsc -p tsconfig.test.json && node dist-test/scripts/test-suite.js
```
