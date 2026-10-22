// build-tactical-ui.mjs
// Run with: node build-tactical-ui.mjs (or npm run build:theme)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SRC_THEME_DIR = path.resolve(process.cwd(), 'portal/src/theme');
const PACK_DIR = path.resolve(process.cwd(), 'tactical-ui');
const ZIP_PATH = path.resolve(process.cwd(), 'tactical-ui.zip');

console.log('🚀 Packaging centralized portable theme system from portal/src/theme/ ...');

if (!fs.existsSync(SRC_THEME_DIR)) {
  console.error(`❌ Error: Source theme directory not found at ${SRC_THEME_DIR}`);
  process.exit(1);
}

// 1. Ensure target directory exists and is clean
if (fs.existsSync(PACK_DIR)) {
  fs.rmSync(PACK_DIR, { recursive: true, force: true });
}
fs.mkdirSync(PACK_DIR, { recursive: true });

// 2. Read all files from portal/src/theme and copy them
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

// 3. Write developer README.md inside tactical-ui/
const readmeContent = `# @0ccupi3r/tactical-ui (v2.0.0)

> **Portable Design System**: Tactical HUD & Editorial Swiss Grid React 18/19 UI Architecture.

---

## 🚀 Quick Migration to Any Project

### Option A: Direct Copy / Unzip
Copy or unzip this folder into your new project's source tree:
\`\`\`bash
# If unzipping archive:
unzip tactical-ui.zip -d ./my-project/src/theme

# If copying directory:
cp -r tactical-ui /path/to/my-project/src/theme
\`\`\`

### Option B: Local npm Install
You can install this folder directly as a local package:
\`\`\`bash
npm install /path/to/tactical-ui
\`\`\`
Or install from the packaged tarball:
\`\`\`bash
npm install ./0ccupi3r-tactical-ui-2.0.0.tgz
\`\`\`

---

## 📦 Setup in 3 Simple Steps

### 1. Install Peer Dependencies
\`\`\`bash
npm install lucide-react
\`\`\`
*(Requires React 18+ or React 19)*

### 2. Import CSS in App Root
In your main entry file (\`main.tsx\`, \`index.tsx\`, or Next.js \`app/layout.tsx\`):
\`\`\`typescript
import './theme/theme.css';
import { ThemeProvider } from './theme';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultMode="dark">
      {children}
    </ThemeProvider>
  );
}
\`\`\`

### 3. Use Typed React Primitives & Validators
\`\`\`typescript
import React, { useState } from 'react';
import {
  AuHudCard,
  AuTabs,
  AuButton,
  AuBadge,
  AuModal,
  AuSelect,
  AuValidatedInput,
  AuCheckbox,
  AuTokenChip,
  AuCodeViewer,
  validateTagKey,
  validateNamingPattern
} from './theme';

export function Dashboard() {
  const [env, setEnv] = useState('prod');

  return (
    <AuHudCard
      kicker="TACTICAL GOVERNANCE"
      title="Platform Operations Telemetry"
      meta="4 Management Groups · 42 Policies Enforced"
      action={<AuButton variant="primary" size="sm">Export Artifacts</AuButton>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <AuSelect
          label="Environment Tier"
          value={env}
          onChange={setEnv}
          options={[
            { value: 'prod', label: 'Production (Strict)' },
            { value: 'nonprod', label: 'Non-Production' },
            { value: 'dev', label: 'Development' }
          ]}
        />
        
        <AuValidatedInput
          label="Resource Name"
          defaultValue="corp-hub-vnet"
          validator={(val) => validateNamingPattern(val)}
        />
      </div>
    </AuHudCard>
  );
}
\`\`\`

---

## 🎨 Visual Identity & Architecture
- **Palette**: Deep Petrol canvas (\`#06252D\`), surface (\`#12323E\`), elevated (\`#16404C\`), tactical teal (\`#48A9A6\`), mint (\`#64BA6D\`), and HUD emerald (\`#249D79\`).
- **HUD Reticle Cards**: Every \`<AuHudCard>\` features 4-corner hairline reticles with interactive hover glow.
- **Background Texture**: 22px fixed radial dot-grid canvas.
- **Typography**: Spectral (Editorial Serif Headlines) + IBM Plex Sans (Body) + IBM Plex Mono (Code & Metadata).
- **Tailwind Preset**: Integrate directly with Tailwind CSS via \`tailwind.preset.js\`.
`;

fs.writeFileSync(path.join(PACK_DIR, 'README.md'), readmeContent, 'utf8');
// 3.5 Copy agent skill & rule templates into tactical-ui/
const agentSkillSrc = path.resolve(process.cwd(), '.agents/skills/init-tactical-ui/SKILL.md');
const agentRuleSrc = path.resolve(process.cwd(), '.agents/rules/theme_system.md');

if (fs.existsSync(agentSkillSrc)) {
  const skillDestDir = path.join(PACK_DIR, 'skills/init-tactical-ui');
  fs.mkdirSync(skillDestDir, { recursive: true });
  fs.copyFileSync(agentSkillSrc, path.join(skillDestDir, 'SKILL.md'));
  console.log(`   ✓ Packaged agent skill (init-tactical-ui)`);
}

if (fs.existsSync(agentRuleSrc)) {
  const ruleDestDir = path.join(PACK_DIR, 'rules');
  fs.mkdirSync(ruleDestDir, { recursive: true });
  fs.copyFileSync(agentRuleSrc, path.join(ruleDestDir, 'theme_system.md'));
  console.log(`   ✓ Packaged agent rule (theme_system.md)`);
}

// 4. Generate npm pack tarball inside PACK_DIR (kept in tactical-ui/ without cluttering root)
try {
  const packOutput = execSync('npm pack', { cwd: PACK_DIR, encoding: 'utf8' }).trim();
  const tarballName = packOutput.split('\n').pop().trim();
  if (tarballName && tarballName.endsWith('.tgz')) {
    console.log(`   ✓ Built npm tarball: tactical-ui/${tarballName}`);
  }
} catch (err) {
  console.warn(`   ⚠️ npm pack warning: ${err.message}`);
}

// 5. Generate ZIP archive
try {
  if (fs.existsSync(ZIP_PATH)) {
    fs.rmSync(ZIP_PATH, { force: true });
  }

  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${PACK_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force"`);
  } else {
    execSync(`zip -r "${ZIP_PATH}" tactical-ui`);
  }
  console.log(`\n📦 Successfully bundled ZIP archive: ${ZIP_PATH}`);
} catch (err) {
  console.warn(`⚠️ Zip command warning: ${err.message}`);
}

console.log(`\n✅ Tactical UI Theme Pack Build Complete! (${copiedCount} source files copied to ${PACK_DIR})\n`);
