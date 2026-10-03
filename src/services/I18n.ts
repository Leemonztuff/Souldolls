import esDictionary from '../data/text/es.json';

export class I18n {
  private static instance: I18n;
  private currentLanguage = 'es';
  private dictionary: Record<string, any> = esDictionary;

  private constructor() {}

  public static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  public t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.dictionary;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Fallback to key itself
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramVal]) => {
        return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramVal));
      }, value);
    }

    return value;
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }
}

export const GlobalI18n = I18n.getInstance();
