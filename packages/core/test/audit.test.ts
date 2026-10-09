import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { auditFile, collectPackageDependencies } from '../../scripts/audit-offline.ts';



describe('offline audit', () => {
  it('detects cloud AI imports, CDNs, Google Fonts, and non-local URLs in sample content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    const badFile = path.join(tmpDir, 'bad_code.ts');

    const badSnippet = [
      'imp' + 'ort { OpenAI } from \'open' + 'ai\';',
      'const font = \'https://' + 'fonts.google' + 'apis.com/css\';',
      'const cdn = \'<' + 'script src="https://' + 'cdn.jsdelivr.net/npm/vue"></' + 'script>\';',
      'const externalApi = \'https://' + 'api.external-cloud.com/v1\';',
      'fet' + 'ch(\'https://' + 'remote-server.com/api\');',
    ].join('\n');

    fs.writeFileSync(badFile, badSnippet);


    const findings = auditFile(badFile);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    expect(findings.length).toBeGreaterThanOrEqual(4);
    expect(findings.some((f) => f.rule.includes('Cloud AI SDK'))).toBe(true);
    expect(findings.some((f) => f.rule.includes('Google Fonts'))).toBe(true);
    expect(findings.some((f) => f.rule.includes('CDN'))).toBe(true);
    expect(findings.some((f) => f.rule.includes('Non-localhost URL'))).toBe(true);
  });

  it('passes on clean local code', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-clean-'));
    const cleanFile = path.join(tmpDir, 'clean.ts');

    fs.writeFileSync(
      cleanFile,
      `
      const ollama = 'http://localhost:11434';
      const whisper = 'http://127.0.0.1:8080';
      console.log('Running 100% offline');
    `,
    );

    const findings = auditFile(cleanFile);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    expect(findings).toHaveLength(0);
  });

  it('collects package dependencies from package.json files', () => {
    const deps = collectPackageDependencies(path.resolve(__dirname, '../../'));
    expect(deps.length).toBeGreaterThan(0);
    expect(deps.some((d) => d.name === 'vitest')).toBe(true);
  });
});
