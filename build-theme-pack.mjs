// build-theme-pack.mjs
// Run with: node build-theme-pack.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SRC_THEME_DIR = path.resolve(process.cwd(), 'src/theme');
const PACK_DIR = path.resolve(process.cwd(), 'apisec-theme-pack');
const ZIP_PATH = path.resolve(process.cwd(), 'apisec-theme-pack.zip');

console.log('🚀 Packaging centralized portable theme system from src/theme/ ...');

if (!fs.existsSync(SRC_THEME_DIR)) {
  console.error(`❌ Error: Source theme directory not found at ${SRC_THEME_DIR}`);
  process.exit(1);
}

// 1. Ensure target directory exists and is clean
if (fs.existsSync(PACK_DIR)) {
  fs.rmSync(PACK_DIR, { recursive: true, force: true });
}
fs.mkdirSync(PACK_DIR, { recursive: true });

// 2. Read all files from src/theme and copy them
const files = fs.readdirSync(SRC_THEME_DIR);
let copiedCount = 0;

for (const file of files) {
  const srcFile = path.join(SRC_THEME_DIR, file);
  const stat = fs.statSync(srcFile);
  if (stat.isFile()) {
    const destFile = path.join(PACK_DIR, file);
    fs.copyFileSync(srcFile, destFile);
    copiedCount++;
    console.log(`   ✓ Copied ${file}`);
  }
}

// 3. Write a high-craft README.md for future developers
const readmeContent = `# apisec-theme-pack (v2.0.0)

> **Portable Design System**: Fusion of the **apisec|con 2026 Technical-Editorial Swiss Grid** and **HUD React 18 Tactical Telemetry Architecture**.

## 🚀 Quick Migration to Any New Project

### 1. Copy Folder
Copy this entire directory into your new project's source tree:
\`\`\`bash
cp -r apisec-theme-pack /path/to/new-project/src/theme
\`\`\`

### 2. Import CSS in Entry File
In your main entry file (\`main.tsx\`, \`index.tsx\`, or Next.js \`app/layout.tsx\`):
\`\`\`typescript
import './theme/theme.css';
import { ThemeProvider } from './theme/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <ThemeProvider defaultMode="dark">
      {children}
    </ThemeProvider>
  );
}
\`\`\`

### 3. Use Typed React Primitives
\`\`\`typescript
import {
  AuHudCard,
  AuTabs,
  AuButton,
  AuBadge,
  AuModal,
  AuTelemetryStrip,
  AuCodeViewer,
  AuValidationBox
} from './theme';

export function Dashboard() {
  return (
    <AuHudCard
      kicker="AZURE GOVERNANCE"
      title="Landing Zone Compliance"
      meta="4 Management Groups · 42 Policies Enforced"
      action={<AuButton variant="primary" size="sm">Export IaC</AuButton>}
    >
      <p>All core infrastructure policies are currently in enforce mode.</p>
    </AuHudCard>
  );
}
\`\`\`

## 🎨 Design Tokens & Visual Architecture
- **Palette**: Deep Petrol canvas (\`#06252D\`), surface (\`#12323E\`), elevated (\`#16404C\`), and tactical accents (\`#48A9A6\` teal, \`#64BA6D\` mint, \`#249D79\` HUD emerald).
- **HUD Reticle Cards**: Every \`<AuHudCard>\` features 4-corner hairline reticles (\`.au-card-arrow-tl/tr/bl/br\`) with interactive hover glow.
- **Background Texture**: 22px fixed radial dot-grid canvas.
- **Typography**: Spectral (Editorial Serif Headlines) + IBM Plex Sans (Body) + IBM Plex Mono (Code & Metadata).
`;

fs.writeFileSync(path.join(PACK_DIR, 'README.md'), readmeContent, 'utf8');
console.log(`   ✓ Generated README.md`);

// 4. Generate ZIP archive
try {
  if (fs.existsSync(ZIP_PATH)) {
    fs.rmSync(ZIP_PATH, { force: true });
  }

  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${PACK_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force"`);
  } else {
    execSync(`zip -r "${ZIP_PATH}" apisec-theme-pack`);
  }
  console.log(`\n📦 Successfully bundled ZIP archive: ${ZIP_PATH}`);
} catch (err) {
  console.warn(`⚠️ Zip command warning: ${err.message}`);
}

console.log(`\n✅ Theme Pack Build Complete! (${copiedCount} source files copied to ${PACK_DIR})\n`);