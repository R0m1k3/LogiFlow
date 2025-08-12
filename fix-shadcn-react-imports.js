#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script pour corriger automatiquement tous les imports React dans shadcn/ui
const uiComponentsDir = path.join(__dirname, 'client/src/components/ui');

function fixReactImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remplacer les imports React namespace
  if (content.includes('import * as React from "react"')) {
    // Analyser quels hooks React sont utilisés
    const reactHooks = [];
    if (content.includes('React.useState')) reactHooks.push('useState');
    if (content.includes('React.useEffect')) reactHooks.push('useEffect');
    if (content.includes('React.useContext')) reactHooks.push('useContext');
    if (content.includes('React.useCallback')) reactHooks.push('useCallback');
    if (content.includes('React.useMemo')) reactHooks.push('useMemo');
    if (content.includes('React.useRef')) reactHooks.push('useRef');
    if (content.includes('React.useId')) reactHooks.push('useId');
    if (content.includes('React.forwardRef')) reactHooks.push('forwardRef');
    if (content.includes('React.createContext')) reactHooks.push('createContext');

    // Créer le nouvel import
    const uniqueHooks = [...new Set(reactHooks)];
    const newImport = uniqueHooks.length > 0 
      ? `import React, { ${uniqueHooks.join(', ')} } from "react"`
      : `import React from "react"`;

    content = content.replace('import * as React from "react"', newImport);

    // Remplacer les usages React.hook par hook direct
    uniqueHooks.forEach(hook => {
      const regex = new RegExp(`React\\.${hook}`, 'g');
      content = content.replace(regex, hook);
    });

    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed: ${path.relative(__dirname, filePath)}`);
    return true;
  }

  return false;
}

function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  let totalFixed = 0;

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      totalFixed += processDirectory(itemPath);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      if (fixReactImports(itemPath)) {
        totalFixed++;
      }
    }
  }

  return totalFixed;
}

console.log('🔧 Fixing React imports in shadcn/ui components...');
const fixed = processDirectory(uiComponentsDir);
console.log(`✅ Fixed ${fixed} files`);