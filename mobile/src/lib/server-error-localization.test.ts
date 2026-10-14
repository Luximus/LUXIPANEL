import { describe, expect, it } from 'vitest';
import { localizeServerError } from './server-error-localization';
import errors from '../i18n/native/errors.json';
import { LOCALES } from '../i18n/locales';
import { nativeText } from '../i18n/native-text';
import { saveSessionState } from './session-state';

describe.each(LOCALES.map(l => l.code))('server errors in %s', locale => {
  it.each([
    ['Forbidden','forbidden'], ['EACCES: permission denied, open /root/test','forbidden'],
    ['Network request failed','network'], ['PANEL_UNAVAILABLE','unavailable'],
    ['DIRECT_AUTH_REQUIRED','connect'], ['Invalid credentials','credentials'],
    ['VALIDATION_ERROR','validation'], ['ETIMEDOUT','timeout'], ['No space left on device','quota'],
    ['RATE_LIMIT','rateLimit'], ['Resource already exists','conflict'],
    ['Not found','notFound'], ['Invalid server response','invalidResponse'],
  ] as const)('translates %s', (message,key) => {
    expect(localizeServerError(message,locale)).toBe(errors[locale][key]);
  });
  it('uses structured status and nested envelopes without exposing unknown diagnostics', () => {
    expect(localizeServerError({status:403,data:{ok:false,error:'opaque backend message'}},locale)).toBe(errors[locale].forbidden);
    expect(localizeServerError({data:{error:{code:'RATE_LIMIT',message:'opaque backend message'}}},locale)).toBe(errors[locale].rateLimit);
    expect(localizeServerError(new Error('Unrecognized raw diagnostic /root/private-config'),locale)).toBe(errors[locale].failed);
    expect(localizeServerError(null,locale)).toBe(errors[locale].failed);
    expect(localizeServerError(Object.assign(new Error('opaque failure'),{code:'EACCES',status:403}),locale)).toBe(errors[locale].forbidden);
  });
  it('translates known form errors and retains interpolation values', () => {
    const englishValidation = nativeText('Completa {p0}.',{p0:nativeText('Nombre',undefined,'en')},'en');
    expect(localizeServerError(englishValidation,locale)).toBe(nativeText('Completa {p0}.',{p0:nativeText('Nombre',undefined,locale)},locale));
    const template='Descarga fallida (HTTP {p0}).';
    expect(localizeServerError('Descarga fallida (HTTP 413).',locale)).toBe(nativeText(template,{p0:413},locale));
    const name='example-user';
    const message=nativeText('Se eliminará {p0}.',{p0:name},locale);
    expect(message).toContain(name);
    expect(localizeServerError(message,locale)).toBe(message);
  });
});
it('uses the current language for a delayed error and for an error already on screen',async()=>{
 await saveSessionState({language:'es'});
 expect(localizeServerError('Permission denied')).toBe(errors.es.forbidden);
 const spanish=localizeServerError('Permission denied');
 await saveSessionState({language:'ja'});
 expect(localizeServerError(spanish)).toBe(errors.ja.forbidden);
 expect(localizeServerError('Permission denied')).toBe(errors.ja.forbidden);
 await saveSessionState({language:'en'});
});
