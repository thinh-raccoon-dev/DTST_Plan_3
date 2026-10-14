import { describe, expect, it } from 'vitest';
import { extractQrCode } from './qr';

describe('extractQrCode', () => {
  it('accepts bare codes and platform URLs', () => {
    expect(extractQrCode('tramchim-01')).toBe('TRAMCHIM-01');
    expect(extractQrCode('https://dtst.example.vn/qr/HTL-01')).toBe('HTL-01');
    expect(extractQrCode('http://localhost:5173/qr/gothap-01/')).toBe('GOTHAP-01');
  });

  it('rejects unrelated content', () => {
    expect(extractQrCode('https://evil.example/login')).toBeNull();
    expect(extractQrCode('javascript:alert(1)')).toBeNull();
    expect(extractQrCode('WIFI:S:home;T:WPA;P:secret;;')).toBeNull();
    expect(extractQrCode('ab')).toBeNull();
  });
});
