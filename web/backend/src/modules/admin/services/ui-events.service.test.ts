import { eventBus, Events } from "../../../shared/events/index.js";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({verify:vi.fn(),executor:vi.fn(),override:vi.fn(),chat:vi.fn(),notifications:vi.fn(),send:vi.fn(),dataAllowed:vi.fn(),dataSubscribe:vi.fn()}));
vi.mock("../../../shared/remote-cache/live-resources.js",()=>({canReadResource:mocks.dataAllowed}));
vi.mock("../../../shared/remote-cache/live-events.js",()=>({subscribeData:mocks.dataSubscribe}));
vi.mock("../../../shared/websocket/live-auth.js", () => ({verifyWsAuthorization:mocks.verify}));
vi.mock("../../../shared/websocket/upgrade-auth.js", () => ({extractOverrideBridgeId:(req:any)=>req.bridge,wsSend:mocks.send}));
vi.mock("../../auth/services/token.service.js", () => ({tokenService:{toSessionUser:(value:any)=>value}}));
vi.mock("../../../shared/session/bridge-header.js", () => ({resolveOverrideBridge:mocks.override}));
vi.mock("../../../shared/executor/factory.js", () => ({getExecutorAsync:mocks.executor}));
vi.mock("../../chat/services/tolqia-bridge.service.js", () => ({tolqiaBridge:{activeConversationIds:()=>[]}}));
vi.mock("./module-registry.service.js", () => ({moduleRegistryService:{isEnabled:async()=>true}}));
vi.mock("../../chat/services/chat.service.js", async () => {const {EventEmitter}=await import("node:events");return {chatService:{unreadCount:mocks.chat},chatPresence:{add:vi.fn(),remove:vi.fn()},chatBus:new EventEmitter(),CHAT_EVENTS:{MESSAGE:"message",READ:"read",CALL:"call"}};});
vi.mock("../../notifications/services/notifications.service.js", async () => {const {EventEmitter}=await import("node:events");return {notificationsService:{unreadCount:mocks.notifications},notificationsBus:new EventEmitter(),NOTIFICATION_EVENTS:{CREATED:"created",READ:"read",CLEARED:"cleared"}};});
import { handleUiConnection, uiStatus } from "./ui-events.service.js";
import { chatBus, CHAT_EVENTS } from "../../chat/services/chat.service.js";
import { notificationsBus, NOTIFICATION_EVENTS } from "../../notifications/services/notifications.service.js";
const user={userId:7,username:"alice",kind:"user",modules:[],permissions:{views:["panel.notifications"],actions:[],sidebar:[]}};
const executor={target:{id:"server-A"}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
beforeEach(()=>{vi.clearAllMocks();mocks.verify.mockResolvedValue(user);mocks.override.mockResolvedValue(null);mocks.executor.mockResolvedValue(executor);mocks.chat.mockResolvedValue(3);mocks.notifications.mockResolvedValue(2);mocks.dataAllowed.mockResolvedValue(true);mocks.dataSubscribe.mockResolvedValue(()=>{});});
function socket(){return Object.assign(new EventEmitter(),{readyState:1,close:vi.fn()});}
describe("shared UI events",()=>{
 it("rejects unauthorized resources before opening the data stream",async()=>{
  mocks.dataAllowed.mockResolvedValue(false);const ws=socket();await handleUiConnection(ws as never,{} as never);await settle();
  ws.emit("message",JSON.stringify({type:"data:subscribe",resources:["users/system"]}));await settle();
  expect(mocks.dataSubscribe).not.toHaveBeenCalled();expect(mocks.send).toHaveBeenCalledWith(ws,{type:"data:resync",resources:[],reason:"forbidden"});ws.emit("close");
 });
 it("releases a subscription which resolves after the socket is closed",async()=>{
  let finish!:(release:()=>void)=>void;const release=vi.fn();mocks.dataSubscribe.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const ws=socket();await handleUiConnection(ws as never,{} as never);await settle();
  ws.emit("message",JSON.stringify({type:"data:subscribe",resources:["users/system"]}));await settle();
  ws.emit("close");finish(release);await settle();expect(release).toHaveBeenCalledTimes(1);
 });

 it("sends only counters at connection, forwards own calls, and removes listeners",async()=>{
  const ws=socket();const before=chatBus.listenerCount(CHAT_EVENTS.CALL);
  await handleUiConnection(ws as never,{} as never);await settle();
  expect(mocks.send).toHaveBeenCalledWith(ws,{type:"ui:status",targetId:"server-A",chat:3,notifications:2});
  mocks.send.mockClear();
  for(const row of [{targetId:"server-B",participants:["alice"]},{targetId:"server-A",participants:["bob"]}]) chatBus.emit(CHAT_EVENTS.CALL,row);
  expect(mocks.send).not.toHaveBeenCalled();
  const row={targetId:"server-A",participants:["alice"],event:"ring"};chatBus.emit(CHAT_EVENTS.CALL,row);
  expect(mocks.send).toHaveBeenCalledWith(ws,{type:"chat:call:ring",data:row});
  ws.emit("close");expect(chatBus.listenerCount(CHAT_EVENTS.CALL)).toBe(before);
 });
 it("filters notifications by target and recipient",async()=>{
  const ws=socket();await handleUiConnection(ws as never,{} as never);await settle();mocks.send.mockClear();
  notificationsBus.emit(NOTIFICATION_EVENTS.CREATED,{metadata:{targetId:"server-A"},userId:99});
  notificationsBus.emit(NOTIFICATION_EVENTS.CREATED,{metadata:{targetId:"server-B"},userId:7});
  expect(mocks.send).not.toHaveBeenCalled();
  notificationsBus.emit(NOTIFICATION_EVENTS.CREATED,{metadata:{targetId:"server-A"},userId:7});
  expect(mocks.send).toHaveBeenCalledWith(ws,{type:"ui:notifications-changed"});ws.emit("close");
 });
 it("does not read notifications without the view permission",async()=>{
  const result=await uiStatus({...user,permissions:{views:[],actions:[],sidebar:[]}} as never,executor as never);
  expect(result.notifications).toBeNull();expect(mocks.notifications).not.toHaveBeenCalled();
 });
 it("rejects an unresolved server override before reading anything",async()=>{
  const ws=socket();await handleUiConnection(ws as never,{bridge:"not-owned"} as never);
  expect(ws.close).toHaveBeenCalledWith(1008,"Forbidden");expect(mocks.executor).not.toHaveBeenCalled();expect(mocks.chat).not.toHaveBeenCalled();
 });
 it("coalesces simultaneous counter reads for the same identity",async()=>{
  await Promise.all(Array.from({length:10},()=>uiStatus(user as never,executor as never)));
  expect(mocks.chat).toHaveBeenCalledTimes(1);expect(mocks.notifications).toHaveBeenCalledTimes(1);
 });
 it("scopes module updates to the selected target and releases the listener",async()=>{
  const ws=socket(), before=eventBus.listenerCount(Events.MODULES_CHANGED); await handleUiConnection(ws as never,{} as never); await settle(); mocks.send.mockClear();
  eventBus.emit(Events.MODULES_CHANGED,{targetId:"server-B",revision:1}); expect(mocks.send).not.toHaveBeenCalled();
  eventBus.emit(Events.MODULES_CHANGED,{targetId:"server-A",revision:2}); expect(mocks.send).toHaveBeenCalledWith(ws,{type:"ui:modules-changed",targetId:"server-A",revision:2});
  ws.emit("close"); expect(eventBus.listenerCount(Events.MODULES_CHANGED)).toBe(before);
 });

});
