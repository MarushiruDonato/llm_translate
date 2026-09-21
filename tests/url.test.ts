import { describe, expect, it } from 'vitest';
import { cleanBaseUrl, normalizeToMatchPattern } from '../src/utils/url';

describe('normalizeToMatchPattern', () => {
  it('should normalize standard https URL with subpath', () => {
    expect(normalizeToMatchPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(normalizeToMatchPattern('https://api.deepseek.com/v1/')).toBe('https://api.deepseek.com/*');
  });

  it('should preserve port if specified', () => {
    expect(normalizeToMatchPattern('http://localhost:11434/v1')).toBe('http://localhost:11434/*');
    expect(normalizeToMatchPattern('https://custom-host.com:8443/api/v1')).toBe('https://custom-host.com:8443/*');
  });

  it('should add https scheme if missing', () => {
    expect(normalizeToMatchPattern('api.anthropic.com/v1')).toBe('https://api.anthropic.com/*');
  });

  it('should throw error for empty or invalid strings', () => {
    expect(() => normalizeToMatchPattern('')).toThrow('Base URL 不能为空');
    expect(() => normalizeToMatchPattern('   ')).toThrow('Base URL 不能为空');
    expect(() => normalizeToMatchPattern('ftp://not-supported.com')).toThrow('仅支持 HTTP / HTTPS');
  });
});

describe('cleanBaseUrl', () => {
  it('should trim whitespace and trailing slashes', () => {
    expect(cleanBaseUrl('  https://api.openai.com/v1/  ')).toBe('https://api.openai.com/v1');
    expect(cleanBaseUrl('api.deepseek.com/v1///')).toBe('https://api.deepseek.com/v1');
  });
});
