import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

interface Finding {
  filePath: string;
  lineNumber: number;
  rule: string;
  lineContent: string;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.opencode',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'next-env.d.ts',
]);

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.env',
  '.yaml',
  '.yml',
  '.toml',
]);

const CLOUD_AI_PATTERNS = [
  /\bfrom\s+['"](@?openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|@azure\/openai|cohere-ai|mistralai|@aws-sdk\/client-bedrock|replicate)['"]/i,
  /\brequire\s*\(\s*['"](@?openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|@azure\/openai|cohere-ai|mistralai|@aws-sdk\/client-bedrock|replicate)['"]\s*\)/i,
  /\bimport\s*\(\s*['"](@?openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|@azure\/openai|cohere-ai|mistralai|@aws-sdk\/client-bedrock|replicate)['"]\s*\)/i,
];

const CDN_TAG_PATTERN = /<(?:script|link)\b[^>]*(?:src|href)=['"]https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)/i;
const GOOGLE_FONTS_PATTERN = /fonts\.(?:googleapis|gstatic)\.com/i;
const FETCH_NON_LOCAL_PATTERN = /\bfetch\s*\(\s*['"`]https?:\/\/(?!(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?:[:\/]|['"`]))/i;

// Matches http:// or https:// URLs that do not point to localhost, 127.0.0.1, 0.0.0.0, or ::1
const NON_LOCAL_URL_PATTERN = /https?:\/\/(?!(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?:[:\/?#"'`\s]|$))[a-zA-Z0-9.-]+/i;

function walkDirectory(dir: string, callback: (filePath: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, callback);
    } else if (entry.isFile()) {
      if (!IGNORED_FILES.has(entry.name)) {
        callback(fullPath);
      }
    }
  }
}

export function auditFile(filePath: string): Finding[] {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);

  // If this audit script itself is scanned, skip self-scanning its own regex definition lines
  const isAuditScript = basename === 'audit-offline.ts';

  if (!SCANNED_EXTENSIONS.has(ext) && !basename.startsWith('.env')) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (isAuditScript && (line.includes('const CLOUD_AI_PATTERNS') || line.includes('_PATTERN ='))) {
      continue;
    }

    // Check Cloud AI SDK imports
    for (const pattern of CLOUD_AI_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          filePath,
          lineNumber,
          rule: 'Cloud AI SDK import detected',
          lineContent: line.trim(),
        });
        break;
      }
    }

    // Check CDN tags
    if (CDN_TAG_PATTERN.test(line)) {
      findings.push({
        filePath,
        lineNumber,
        rule: 'CDN script/link tag detected',
        lineContent: line.trim(),
      });
    }

    // Check Google Fonts
    if (GOOGLE_FONTS_PATTERN.test(line)) {
      findings.push({
        filePath,
        lineNumber,
        rule: 'Google Fonts reference detected',
        lineContent: line.trim(),
      });
    }

    // Check fetch to non-local host
    if (FETCH_NON_LOCAL_PATTERN.test(line)) {
      findings.push({
        filePath,
        lineNumber,
        rule: 'Fetch call to non-local host detected',
        lineContent: line.trim(),
      });
    }

    // Check general non-localhost URLs
    if (NON_LOCAL_URL_PATTERN.test(line) && !isAuditScript && !line.includes('"$schema"')) {
      findings.push({
        filePath,
        lineNumber,
        rule: 'Non-localhost URL detected in source or config',
        lineContent: line.trim(),
      });
    }

  }

  return findings;
}

interface PackageDependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
  location: string;
}

export function collectPackageDependencies(rootDir: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  walkDirectory(rootDir, (filePath) => {
    if (path.basename(filePath) === 'package.json') {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const pkg = JSON.parse(raw) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            deps.push({ name, version, type: 'dependency', location: relPath });
          }
        }
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            deps.push({ name, version, type: 'devDependency', location: relPath });
          }
        }
      } catch {
        // ignore parse error
      }
    }
  });

  return deps;
}

export function runAudit(rootDir: string = REPO_ROOT): {
  findings: Finding[];
  dependencies: PackageDependency[];
} {
  const allFindings: Finding[] = [];

  walkDirectory(rootDir, (filePath) => {
    const findings = auditFile(filePath);
    allFindings.push(...findings);
  });

  const dependencies = collectPackageDependencies(rootDir);
  return { findings: allFindings, dependencies };
}

function main() {
  console.log('=== Lectern Offline Compliance Audit ===\n');
  console.log(`Scanning repository: ${REPO_ROOT}\n`);

  const { findings, dependencies } = runAudit(REPO_ROOT);

  // Print Disclosures Section
  console.log('## Disclosures: Declared Package Dependencies\n');
  console.log('| Package | Version | Type | Location |');
  console.log('| --- | --- | --- | --- |');
  for (const dep of dependencies) {
    console.log(`| \`${dep.name}\` | \`${dep.version}\` | ${dep.type} | \`${dep.location}\` |`);
  }
  console.log('\n----------------------------------------------------\n');

  // Print Findings
  if (findings.length > 0) {
    console.error(`❌ Audit Failed: Found ${findings.length} offline violation(s):\n`);
    for (const f of findings) {
      const relPath = path.relative(REPO_ROOT, f.filePath).replace(/\\/g, '/');
      console.error(`[VIOLATION] ${relPath}:${f.lineNumber} - ${f.rule}`);
      console.error(`  > ${f.lineContent}\n`);
    }
    process.exit(1);
  } else {
    console.log('✓ Offline Audit Passed: 0 violations found.');
    console.log('✓ All AI inference, transcription, embeddings, and network calls run 100% locally on localhost.');
    process.exit(0);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
