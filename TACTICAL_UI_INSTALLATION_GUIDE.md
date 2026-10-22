# Tactical UI Design System: Installation & Transfer Guide

> **Package**: `@0ccupi3r/tactical-ui` (v2.0.0)  
> **Architecture**: Tactical HUD & Editorial Swiss Grid React UI Theme System  
> **Source Directory**: `portal/src/theme/`  
> **Portable Archive**: `tactical-ui.zip`  
> **npm Tarball**: `0ccupi3r-tactical-ui-2.0.0.tgz`  
> **License**: MIT  

---

## 🚀 Transferring the Theme to Another Laptop

You have **three simple ways** to transfer and install this theme library on any another laptop or in a new repository:

### Method 1: Drop-In ZIP Extraction (Recommended for Simple Projects)
The pre-bundled `tactical-ui.zip` file in the root of this project contains all components, styles, design tokens, and TypeScript interfaces.

1. Copy `tactical-ui.zip` to your other laptop (via USB, AirDrop, GitHub, or Cloud Drive).
2. Extract the archive directly into your project's `src/` directory:
   ```bash
   # From your new project root:
   unzip /path/to/tactical-ui.zip -d ./src/
   
   # Rename folder to theme if desired:
   mv ./src/tactical-ui ./src/theme
   ```

### Method 2: Direct Directory Copy
Copy the `tactical-ui/` directory directly:
```bash
cp -r /path/to/int-policy/tactical-ui /path/to/my-new-app/src/theme
```

### Method 3: Local npm Package Installation
If you prefer managing the theme through `package.json` dependencies:
```bash
# Option A: Install from local folder
npm install /path/to/tactical-ui

# Option B: Install from the pre-built tarball
npm install /path/to/0ccupi3r-tactical-ui-2.0.0.tgz
```

---

## 📦 3-Step Setup in Any React / Next.js / Vite Project

### Step 1: Install Peer Dependencies
The theme requires React 18+ or React 19, and uses Lucide icons:
```bash
npm install lucide-react
```

### Step 2: Import Styles in Application Entry
In your main entry file (`src/main.tsx`, `src/index.tsx`, or Next.js `app/layout.tsx`):

```typescript
// If using drop-in folder:
import './theme/theme.css';
import { ThemeProvider } from './theme';

// If installed via npm package:
// import '@0ccupi3r/tactical-ui/theme.css';
// import { ThemeProvider } from '@0ccupi3r/tactical-ui';
```

### Step 3: Wrap Your App Root with `<ThemeProvider>`
Wrap your application tree in `<ThemeProvider>` to enable automatic dark/light theme persistence and telemetry CSS custom properties:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './theme';
import App from './App';
import './theme/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultMode="dark">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

---

## 🎨 Optional: Tailwind CSS Integration

If your new project uses Tailwind CSS, import the pre-configured preset in your `tailwind.config.js`:

```javascript
// tailwind.config.js
import tacticalPreset from './src/theme/tailwind.preset.js';

export default {
  presets: [tacticalPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
```

---

## 💻 Component Usage Cheatsheet

### 1. Tactical HUD Reticle Card (`<AuHudCard>`)
Interactive container featuring 4-corner hairline reticles, status kickers, action slots, and subtle hover glow:

```tsx
import { AuHudCard, AuButton, AuBadge } from './theme';

export function GovernanceCard() {
  return (
    <AuHudCard
      kicker="AZURE GOVERNANCE"
      title="Platform Operations Telemetry"
      meta={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AuBadge variant="mint">4 Subscriptions</AuBadge>
          <span className="au-mono-meta">· 36 Policies Enforced</span>
        </div>
      }
      action={
        <AuButton variant="primary" size="sm" onClick={() => alert('Exporting...')}>
          Export IaC
        </AuButton>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Scaffold and enforce enterprise Cloud Adoption Framework rules.
      </p>
    </AuHudCard>
  );
}
```

### 2. High-Density Form Controls (`<AuSelect>`, `<AuValidatedInput>`)
Zero-white-flash, dark canvas inputs with live validation:

```tsx
import { useState } from 'react';
import { AuSelect, AuValidatedInput, validateNamingPattern } from './theme';

export function ConfigurationForm() {
  const [env, setEnv] = useState('prod');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
        helperText="Must match {org}-{env}-{abbr}-{instance}"
      />
    </div>
  );
}
```

### 3. Tactical Modal Dialog (`<AuModal>`)
Backdrop-blurred modal dialog with smooth animations and keyboard ESC support:

```tsx
import { useState } from 'react';
import { AuModal, AuButton } from './theme';

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AuButton onClick={() => setIsOpen(true)}>Open Settings</AuButton>

      <AuModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Workspace Configuration"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <AuButton variant="secondary" onClick={() => setIsOpen(false)}>Cancel</AuButton>
            <AuButton variant="primary" onClick={() => setIsOpen(false)}>Save Changes</AuButton>
          </div>
        }
      >
        <p>Configure parameters and governance policies for this tenant.</p>
      </AuModal>
    </>
  );
}
```

### 4. Zero-Dependency Syntax Highlighter (`<AuCodeViewer>`)
Interactive code viewer supporting Bicep, ARM JSON, PowerShell, and Bash syntax highlighting:

```tsx
import { AuCodeViewer } from './theme';

export function CodePreview() {
  const bicepCode = `
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'corp-hub-vnet'
  location: 'canadacentral'
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
  }
}
  `.trim();

  return (
    <AuCodeViewer
      code={bicepCode}
      language="bicep"
      filename="main.bicep"
      showLineNumbers={true}
    />
  );
}
```

---

## 🛠️ Rebuilding & Updating the Theme Archive

Whenever you add new components or modify tokens in `portal/src/theme/`, run the packaging command from the repository root:

```bash
npm run build:theme
```

This single command automatically:
1. Copies all canonical files from `portal/src/theme/` to `tactical-ui/`.
2. Generates updated `README.md` and TypeScript definitions.
3. Packages a fresh **`tactical-ui.zip`** in the repository root.
4. Generates an installable npm tarball: **`0ccupi3r-tactical-ui-2.0.0.tgz`**.
