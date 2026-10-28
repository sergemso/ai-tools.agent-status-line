import { test, expect } from 'vitest';
import { splitArgs } from '../../hooks/args.js';
test('splits plain words', () => {
    expect(splitArgs('model opus')).toEqual(['model', 'opus']);
});
test('keeps quoted phrases together', () => {
    expect(splitArgs('model "Claude Opus 5.5" x')).toEqual(['model', 'Claude Opus 5.5', 'x']);
});
test('empty input gives no words', () => {
    expect(splitArgs('   ')).toEqual([]);
});
test('handles single quotes', () => {
    expect(splitArgs("model 'Claude Opus 5.5' x")).toEqual(['model', 'Claude Opus 5.5', 'x']);
});
test('handles mixed quotes', () => {
    expect(splitArgs('model "Claude Opus 5.5" \'test\' x')).toEqual(['model', 'Claude Opus 5.5', 'test', 'x']);
});
//# sourceMappingURL=args.test.js.map