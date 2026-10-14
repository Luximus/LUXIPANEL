import React, {useState} from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it} from 'vitest';
import {useLanguage} from './useLanguage';
import {nativeText} from '../i18n/native-text';
import {saveSessionState} from '../lib/session-state';
it('updates mounted forms on language change while retaining their draft',async()=>{
 await saveSessionState({language:'es'});
 function Form(){const language=useLanguage();const[draft,setDraft]=useState('');return React.createElement('form',{label:nativeText('Guardar',undefined,language),draft,onChange:setDraft});}
 let tree!:ReturnType<typeof create>;
 await act(async()=>{tree=create(<Form/>);});
 await act(async()=>{tree.root.findByType('form').props.onChange('unsaved input');});
 expect(tree.root.findByType('form').props.label).toBe('Guardar');
 await act(async()=>{await saveSessionState({language:'ja'});});
 expect(tree.root.findByType('form').props.label).toBe('保存');
 expect(tree.root.findByType('form').props.draft).toBe('unsaved input');
 await act(async()=>tree.unmount());await saveSessionState({language:'en'});
});
