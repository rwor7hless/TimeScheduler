import { csvEscape } from './export.controller';

describe('csvEscape', () => {
  it('leaves a plain string alone', () => {
    expect(csvEscape('hello')).toBe('hello');
  });

  it('quotes a value with commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('quotes and doubles inner double-quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a value with newlines', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('cr\rlf')).toBe('"cr\rlf"');
  });

  it('leaves empty string alone', () => {
    expect(csvEscape('')).toBe('');
  });
});
