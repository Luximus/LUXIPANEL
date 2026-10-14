import { describe, expect, it } from 'vitest';
import text from './native/text.json';
import errors from './native/errors.json';
import { LOCALES, normalizeLocale } from './locales';
import { nativeText } from './native-text';
import { saveSessionState } from '../lib/session-state';
import { administrationExtras } from '../screens/server/native-extras/administration';
import { filesExtras } from '../screens/server/native-extras/files';
import { serviceExtras } from '../screens/server/native-extras/services';

const placeholders=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
it('provides all 11 languages and preserves the parameters of every new message',()=>{
 for(const [source,row]of Object.entries(text))for(const {code}of LOCALES){
  expect(row[code],`${source} / ${code}`).toBeTruthy();
  expect(placeholders(row[code]),`${source} / ${code}`).toEqual(placeholders(row.es));
 }
 for(const {code}of LOCALES)expect(Object.keys(errors[code])).toEqual(Object.keys(errors.es));
});
it('translates visible copy without changing arbitrary server content',()=>{
 expect(nativeText('Guardar',undefined,'ja')).toBe('保存');
 expect(nativeText('Delete DNS record',undefined,'es')).toBe('Eliminar DNS');
 expect(nativeText('/home/usuario/Save',undefined,'ar')).toBe('/home/usuario/Save');
 expect(nativeText('customer-created-title',undefined,'zh')).toBe('customer-created-title');
 expect(nativeText('Se eliminará {p0}.',{p0:'file-{p1}'},'en')).toBe('file-{p1} will be deleted.');
 expect(nativeText('Guardar',undefined,'es-CO')).toBe('Guardar');
 expect(normalizeLocale('PT_br')).toBe('pt');
 expect(normalizeLocale('unsupported')).toBe('en');
});
it('keeps operation identifiers and endpoints stable when changing language',async()=>{
 const groups=[...filesExtras,...Object.values(serviceExtras).flat(),...Object.values(administrationExtras).flat()];
 const ids=()=>groups.map(group=>[group.title,...group.operations.map(op=>[op.title,op.readPath,typeof op.path==='string'?op.path:undefined])]);
 await saveSessionState({language:'es'});const before=ids();
 const field=groups.flatMap(g=>g.operations).flatMap(o=>o.fields??[]).find(f=>f.label==='Nombre');
 expect(field).toBeDefined();
 await saveSessionState({language:'ja'});
 expect(ids()).toEqual(before);
 expect(field!.label).toBe(nativeText('Nombre'));
 await saveSessionState({language:'en'});
});
