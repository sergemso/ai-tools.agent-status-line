import { test, expect } from 'vitest';
import { fmtDur, fmtTok, money } from './formatting.js';
test('fmtDur formats seconds correctly (matches bash behavior)', () => {
    expect(fmtDur(0)).toBe('0s');
    expect(fmtDur(59)).toBe('59s');
    expect(fmtDur(60)).toBe('1m 0s'); // bash shows two units even when second is 0
    expect(fmtDur(61)).toBe('1m 1s');
    expect(fmtDur(3599)).toBe('59m 59s');
    expect(fmtDur(3600)).toBe('1h 0m'); // bash shows two units
    expect(fmtDur(3661)).toBe('1h 1m');
    expect(fmtDur(86399)).toBe('23h 59m');
    expect(fmtDur(86400)).toBe('1d 0h'); // bash shows two units
    expect(fmtDur(90000)).toBe('1d 1h');
    expect(fmtDur(2592000)).toBe('1mo 0d'); // bash shows two units
});
test('fmtTok formats token counts correctly (matches bash behavior)', () => {
    expect(fmtTok(500)).toBe('500');
    expect(fmtTok(1500)).toBe('1.5k');
    expect(fmtTok(15000)).toBe('15k');
    expect(fmtTok(150000)).toBe('150k');
    expect(fmtTok(1500000)).toBe('1.5M');
    expect(fmtTok(15000000)).toBe('15.0M'); // bash always shows one decimal for millions
});
test('money formats dollars correctly (matches bash behavior)', () => {
    // bash: c = x * 100; if (c < 1) print "<1¢"
    expect(money(0.005)).toBe('<1¢'); // c=0.5 < 1, bash shows "<1¢"
    expect(money(0.004)).toBe('<1¢'); // c=0.4 < 1
    expect(money(0.01)).toBe('1¢'); // c=1.0 >= 1, rounds to 1
    expect(money(0.42)).toBe('42¢');
    expect(money(0.99)).toBe('99¢');
    expect(money(1.00)).toBe('$1.00');
    expect(money(5.60)).toBe('$5.60');
    expect(money(100.00)).toBe('$100.00');
});
//# sourceMappingURL=formatting.test.js.map