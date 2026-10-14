import {describe,expect,it} from 'vitest';
import {buildHistoryOrderOptions} from './helpers';
import {getCli} from '../cli-registry';
describe('history ordering',()=>{
 it('uses all persistent history modes even if no CLI binary is installed',()=>{const options=buildHistoryOrderOptions([getCli('default')!],'Terminal');expect(options).toHaveLength(6);expect(new Set(options.map(o=>o.value)).size).toBe(6);for(const option of options)expect(option.value.split(',').sort()).toEqual(['claude','codex','commands']);});
 it('keeps option values stable across probe/installation changes',()=>{expect(buildHistoryOrderOptions([getCli('claude')!],'Terminal')).toEqual(buildHistoryOrderOptions([getCli('codex')!,getCli('claude')!],'Terminal'));});
});
