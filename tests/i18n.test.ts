import { describe, expect, it } from 'vitest';
import { MESSAGES, resolveLanguage, t, TranslationKey } from '../src/utils/i18n';

describe('i18n utility tests', () => {
  it('has identical keys in both zh_CN and en dictionaries', () => {
    const zhKeys = Object.keys(MESSAGES.zh_CN) as TranslationKey[];
    const enKeys = Object.keys(MESSAGES.en) as TranslationKey[];

    expect(zhKeys.sort()).toEqual(enKeys.sort());
  });

  it('correctly resolves explicit language preferences', () => {
    expect(resolveLanguage('zh_CN')).toBe('zh_CN');
    expect(resolveLanguage('en')).toBe('en');
  });

  it('translates messages and substitutes parameter variables', () => {
    expect(t('sourceLangPrefix', { lang: 'EN' }, 'zh_CN')).toBe('源: EN');
    expect(t('sourceLangPrefix', { lang: 'EN' }, 'en')).toBe('Src: EN');

    expect(t('totalEntries', { count: 42 }, 'zh_CN')).toBe('共 42 条记录');
    expect(t('totalEntries', { count: 42 }, 'en')).toBe('42 records');
  });

  it('falls back to key or chinese if missing in target locale', () => {
    expect(t('save', undefined, 'zh_CN')).toBe('保存');
    expect(t('save', undefined, 'en')).toBe('Save');
  });
});
