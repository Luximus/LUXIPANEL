#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(process.cwd(), 'package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  const problematicBindings = [];

  // Check all dependency sections
  ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].forEach(section => {
    if (packageJson[section]) {
      Object.keys(packageJson[section]).forEach(dep => {
        // Match platform-specific bindings like @rolldown/binding-win32-x64-msvc
        if (/@(rolldown|esbuild)\/binding-/.test(dep)) {
          problematicBindings.push(`${section}: ${dep}`);
        }
      });
    }
  });

  if (problematicBindings.length > 0) {
    console.error('❌ ERROR: Found platform-specific native bindings declared directly in package.json:');
    problematicBindings.forEach(binding => {
      console.error(`   - ${binding}`);
    });
    console.error('\nℹ️  Platform-specific bindings should not be declared as direct dependencies.');
    console.error('   These should come as transitive dependencies from their parent packages (e.g., rolldown, esbuild).');
    console.error('   The package manager will select the correct binding for the current platform automatically.\n');
    process.exit(1);
  }

  console.log('✅ No platform-specific bindings found in package.json');
  process.exit(0);
} catch (error) {
  console.error('Error reading package.json:', error.message);
  process.exit(1);
}
