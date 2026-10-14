import {expect,it} from 'vitest';
import {normalizeOperationValues,clearOperationSecrets} from './native-operation-values';
it('validates nested rows without silently turning an empty numeric value into zero',()=>{
 const fields=[{key:'records',label:'Registros',type:'records' as const,fields:[{key:'name',label:'Nombre',required:true},{key:'quota',label:'Cuota',type:'number' as const,min:1,max:100}]}];
 expect(()=>normalizeOperationValues({records:[{name:'  ',quota:'20'}]},fields)).toThrow('Name');
 expect(()=>normalizeOperationValues({records:[{name:'db',quota:'NaN'}]},fields)).toThrow('Quota');
 expect(()=>normalizeOperationValues({records:[{name:'db',quota:'101'}]},fields)).toThrow('Quota');
 expect(normalizeOperationValues({records:[{name:'db',quota:''}]},fields)).toEqual({records:[{name:'db',quota:undefined}]});
 expect(normalizeOperationValues({records:[{name:'db',quota:'20'}]},fields)).toEqual({records:[{name:'db',quota:20}]});
});
it('retains false, zero, empty editable strings and unknown properties without mutating the draft',()=>{
 const draft={enabled:false,limit:'0',name:'',extra:'keep',smtp:{port:'465',host:'mail'}};
 const result=normalizeOperationValues(draft,[{key:'limit',label:'Limite',type:'number'},{key:'smtp.port',label:'Puerto',type:'number'}]);
 expect(result).toEqual({...draft,limit:0,smtp:{port:465,host:'mail'}});expect(draft.smtp.port).toBe('465');
});
it('rejects empty required line lists and malformed JSON before transmission',()=>{
 expect(()=>normalizeOperationValues({ids:' \n '},[{key:'ids',label:'IDs',type:'lines',required:true}])).toThrow('IDs');
 expect(()=>normalizeOperationValues({config:'{'},[{key:'config',label:'Config',type:'json'}])).toThrow('JSON');
});
it('clears write-only secrets recursively without changing the source or unrelated values',()=>{
 const values={external:{password:'masked',host:'host'},keys:[{name:'key',value:'secret'}]};
 expect(clearOperationSecrets(values,[{key:'external.password',label:'Pass',type:'secret'},{key:'keys',label:'Keys',type:'records',fields:[{key:'value',label:'Value',type:'secret'}]}])).toEqual({external:{password:'',host:'host'},keys:[{name:'key',value:''}]});
 expect(values.keys[0].value).toBe('secret');expect(values.external.password).toBe('masked');
});
