import { describe, expect, it } from 'vitest';
import {
  operationListJsonSchema,
  operationListSchema,
  operationSchema,
} from '@/lib/core/operations';

describe('operation schemas — the safety boundary', () => {
  it('accepts a well-formed createSurface + addRecord batch', () => {
    const result = operationListSchema.safeParse([
      {
        op: 'createSurface',
        title: 'Job search',
        icon: '💼',
        viewType: 'board',
        fields: [
          { key: 'company', label: 'Company', type: 'text' },
          { key: 'stage', label: 'Stage', type: 'status', options: ['Researching', 'Applied', 'Interview', 'Offer'] },
        ],
        narration: 'A board to track applications by stage.',
      },
      { op: 'addRecord', surface: 'Job search', values: { company: 'Linear', stage: 'Interview' } },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects an operation kind outside the closed set', () => {
    expect(operationSchema.safeParse({ op: 'runCode', code: 'alert(1)' }).success).toBe(false);
    expect(operationSchema.safeParse({ op: 'deleteSurface', surface: 'x' }).success).toBe(false);
  });

  it('rejects non-primitive record values (no nested payloads)', () => {
    expect(
      operationSchema.safeParse({
        op: 'addRecord',
        surface: 'x',
        values: { sneaky: { nested: 'object' } },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid field keys and empty updates', () => {
    expect(
      operationSchema.safeParse({
        op: 'addField',
        surface: 'x',
        field: { key: 'Not A Key!', label: 'Bad', type: 'text' },
      }).success,
    ).toBe(false);
    expect(
      operationSchema.safeParse({ op: 'updateField', surface: 'x', key: 'a', changes: {} }).success,
    ).toBe(false);
  });

  it('rejects an empty operation list', () => {
    expect(operationListSchema.safeParse([]).success).toBe(false);
  });

  it('exports a JSON schema for text-only providers without throwing', () => {
    const schema = operationListJsonSchema();
    expect(schema.type).toBe('array');
    expect(JSON.stringify(schema)).toContain('createSurface');
  });
});
