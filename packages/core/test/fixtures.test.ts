import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Segment } from '../src/types.js';

describe('fixtures', () => {
  it('loads lecture1.json and validates Segment[] structure and duration', () => {
    const p = path.resolve(__dirname, '../fixtures/lecture1.json');
    const content = fs.readFileSync(p, 'utf-8');
    const segments: Segment[] = JSON.parse(content) as Segment[];

    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(15);
    expect(segments[0].start).toBe(0.0);
    const lastSeg = segments[segments.length - 1];
    // Check duration is roughly 15-20 min (around 800 - 1200 seconds)
    expect(lastSeg.end).toBeGreaterThanOrEqual(800);

    for (const seg of segments) {
      expect(typeof seg.start).toBe('number');
      expect(typeof seg.end).toBe('number');
      expect(typeof seg.text).toBe('string');
      expect(seg.end).toBeGreaterThan(seg.start);
      expect(seg.text.length).toBeGreaterThan(10);
    }
  });

  it('loads lecture2.json and validates Segment[] structure and duration', () => {
    const p = path.resolve(__dirname, '../fixtures/lecture2.json');
    const content = fs.readFileSync(p, 'utf-8');
    const segments: Segment[] = JSON.parse(content) as Segment[];

    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(15);
    expect(segments[0].start).toBe(0.0);
    const lastSeg = segments[segments.length - 1];
    expect(lastSeg.end).toBeGreaterThanOrEqual(900);

    for (const seg of segments) {
      expect(typeof seg.start).toBe('number');
      expect(typeof seg.end).toBe('number');
      expect(typeof seg.text).toBe('string');
      expect(seg.end).toBeGreaterThan(seg.start);
      expect(seg.text.length).toBeGreaterThan(10);
    }
  });
});
