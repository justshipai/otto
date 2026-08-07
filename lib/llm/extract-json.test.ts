import { describe, expect, it } from 'vitest';
import { extractJsonArray } from '@/lib/llm/extract-json';

const ops = [{ op: 'answer', text: 'hi' }];

describe('extractJsonArray', () => {
  it('parses a bare JSON array', () => {
    expect(extractJsonArray(JSON.stringify(ops))).toEqual(ops);
  });

  it('parses a fenced code block', () => {
    expect(extractJsonArray('```json\n' + JSON.stringify(ops) + '\n```')).toEqual(ops);
  });

  it('parses an unlabelled fence with prose around it', () => {
    const text = 'Sure! Here you go:\n```\n' + JSON.stringify(ops) + '\n```\nLet me know!';
    expect(extractJsonArray(text)).toEqual(ops);
  });

  it('parses JSON embedded in prose without fences', () => {
    expect(extractJsonArray('Here are the operations: ' + JSON.stringify(ops) + ' — done.')).toEqual(ops);
  });

  it('unwraps an { operations: [...] } object', () => {
    expect(extractJsonArray(JSON.stringify({ operations: ops }))).toEqual(ops);
  });

  it('wraps a single bare operation object in an array', () => {
    expect(extractJsonArray(JSON.stringify(ops[0]))).toEqual(ops);
  });

  it('returns undefined for prose with no JSON', () => {
    expect(extractJsonArray('I am not sure what you mean.')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(extractJsonArray('[{"op": "answer", "text": ')).toBeUndefined();
  });
});
