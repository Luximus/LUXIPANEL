import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({motion:true,timing:vi.fn(),start:vi.fn(),stop:vi.fn()}));
vi.mock('../../hooks/useAmbientMotion',()=>({useAmbientMotion:()=>mocks.motion}));
vi.mock('react-native',()=>({Animated:{View:'AnimatedView',Value:class{constructor(public value:number){}setValue(value:number){this.value=value}interpolate(){return 0}},timing:(...args:unknown[])=>{mocks.timing(...args);return{start:mocks.start,stop:mocks.stop}}},Easing:{out:()=> 'ease-out',cubic:()=>{}}}));
import{LoginFormTransition}from './LoginFormTransition';
let tree:ReactTestRenderer;
beforeEach(()=>{vi.clearAllMocks();mocks.motion=true;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());});
it('animates a form change on the native driver without replaying when the theme changes',async()=>{
 await act(async()=>{tree=create(<LoginFormTransition mode="login"><>{'Login'}</></LoginFormTransition>);});
 expect(mocks.timing).not.toHaveBeenCalled();
 await act(async()=>tree.update(<LoginFormTransition mode="connection"><>{'Connection'}</></LoginFormTransition>));
 expect(mocks.timing).toHaveBeenCalledOnce();expect(mocks.timing).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({duration:240,useNativeDriver:true}));expect(mocks.start).toHaveBeenCalledOnce();
 await act(async()=>tree.update(<LoginFormTransition mode="connection"><>{'New theme'}</></LoginFormTransition>));expect(mocks.timing).toHaveBeenCalledOnce();
});
it('switches forms immediately when reduced motion is enabled and stops a previous animation',async()=>{
 await act(async()=>{tree=create(<LoginFormTransition mode="login"><>{'Login'}</></LoginFormTransition>);});
 await act(async()=>tree.update(<LoginFormTransition mode="connection"><>{'Connection'}</></LoginFormTransition>));
 mocks.motion=false;await act(async()=>tree.update(<LoginFormTransition mode="login"><>{'Login'}</></LoginFormTransition>));
 expect(mocks.stop).toHaveBeenCalledOnce();expect(mocks.timing).toHaveBeenCalledOnce();
});
