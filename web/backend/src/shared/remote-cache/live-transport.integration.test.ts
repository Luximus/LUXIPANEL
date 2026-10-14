import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {Server as SshServer} from "ssh2";
import {Redis} from "ioredis";
import {connect} from "node:net";
import {generateKeyPairSync} from "node:crypto";
import {spawn, execFileSync, type ChildProcess} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {performance} from "node:perf_hooks";
vi.mock("../redis/index.js", () => ({getRedis:()=>({set:async()=>"OK",get:async()=>null,del:async()=>1})}));
import {DirectSshExecutor} from "../executor/direct-ssh-executor.js";
import {persistentCache, resetPersistentCaches} from "./persistent-client.js";
import {readVersioned, forgetVersioned} from "./versioned-read.js";
import {subscribeData} from "./live-events.js";
import {runWithExecutor} from "../executor/context.js";

const integration = describe;
integration("real Redis and SSH direct-tcpip transport (disposable local fixtures)", () => {
  let dir: string, redisProcess: ChildProcess, redis: Redis, ssh: SshServer, executor: DirectSshExecutor;
  let channels = 0, bytes = 0;
  const clients = new Set<any>(), sockets = new Set<any>();
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const python = resolve("scripts/remote/engines");
  const publish = (rows: unknown[], force = false) => {
    execFileSync("python3", ["-c", `import sys,json,os
sys.path.insert(0,sys.argv[1])
import common
r=common.Redis('127.0.0.1',6379,'')
r._base=['redis-cli','-s',sys.argv[2]]
r._env.pop('REDISCLI_AUTH',None)
print(json.dumps(common.write_view(r,'users','system',json.load(sys.stdin),'system-collector')))
`, python, join(dir,"redis.sock")], {input:JSON.stringify(rows), env:{...process.env,LUXIPANEL_CONFIG_DIR:dir,LXP_INVALIDATE:force?"1":"0"}});
  };
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "lxp-live-test-")); mkdirSync(join(dir,"cache-engine"));
    writeFileSync(join(dir,"cache-engine/live-data.json"), JSON.stringify({versionedReads:true, events:true, watcher:true}));
    redisProcess = spawn("redis-server", ["--port","0","--unixsocket",join(dir,"redis.sock"),"--save","","--appendonly","no"], {stdio:"ignore"});
    redis = new Redis({path:join(dir,"redis.sock"),retryStrategy:()=>20}); redis.on("error",()=>{});
    await new Promise<void>((resolve,reject)=>{redis.once("ready",resolve); const timeout=setTimeout(()=>reject(new Error("fixture Redis timeout")),5000);redis.once("ready",()=>clearTimeout(timeout));});
    const {privateKey} = generateKeyPairSync("rsa", {modulusLength:2048,privateKeyEncoding:{type:"pkcs1",format:"pem"},publicKeyEncoding:{type:"pkcs1",format:"pem"}});
    ssh = new SshServer({hostKeys:[privateKey]}, client => {
      clients.add(client); client.on("error",()=>{}); client.on("close",()=>clients.delete(client));
      client.on("authentication", ctx => ctx.username === "fixture" && ctx.method === "password" && ctx.password === "fixture-only" ? ctx.accept() : ctx.reject());
      client.on("ready", () => client.on("tcpip", (accept,reject,info) => {
        if (info.destIP !== "127.0.0.1" || info.destPort !== 6379) {reject(); return;}
        channels++; const channel = accept(), remote = connect(join(dir,"redis.sock")); sockets.add(remote);
        remote.on("close",()=>sockets.delete(remote)); remote.on("error",()=>channel.destroy());
        channel.on("error",()=>remote.destroy()); channel.on("close",()=>remote.destroy());
        channel.pipe(remote);
        // Controlled 100 ms reply latency. This is a local SSH fixture, not WAN QA.
        remote.on("data", chunk => {bytes += chunk.length; setTimeout(()=>{if (!channel.destroyed) channel.write(chunk);},100);});
      }));
    });
    await new Promise<void>(resolve=>ssh.listen(0,"127.0.0.1",resolve));
    const port = (ssh.address() as {port:number}).port;
    executor = new DirectSshExecutor("fixture-A","fixture",{host:"127.0.0.1",port,username:"fixture",password:"fixture-only"} as never);
    vi.spyOn(executor,"readFile").mockImplementation(async path => path.endsWith("conn.json")
      ? JSON.stringify({host:"127.0.0.1",port:6379,password:""})
      : path.endsWith("live-data.json") ? JSON.stringify({versionedReads:true,events:true,watcher:true}) : "{}");
    // Dedicated Redis credentials are mandatory, including in fixtures.
    await redis.config("SET","requirepass","fixture-redis"); await redis.auth("fixture-redis");
    vi.mocked(executor.readFile).mockImplementation(async path => path.endsWith("conn.json")
      ? JSON.stringify({host:"127.0.0.1",port:6379,password:"fixture-redis"})
      : path.endsWith("live-data.json") ? JSON.stringify({versionedReads:true,events:true,watcher:true}) : "{}");
  }, 15_000);
  afterAll(async () => {
    resetPersistentCaches(); if (executor) await executor.dispose();
    for (const client of clients) client.end(); for (const socket of sockets) socket.destroy();
    if (ssh) await new Promise<void>(resolve=>ssh.close(()=>resolve()));
    redis?.disconnect(); redisProcess?.kill(); if (dir) rmSync(dir,{recursive:true,force:true});
  });
  it("uses two SSH channels at most and transfers metadata alone for unchanged lists", async () => {
    // The Python publisher uses the same disposable Redis via its unix socket.
    await redis.config("SET","requirepass","");
    const rows = Array.from({length:1000},(_,id)=>({id,username:`user-${id}`,displayName:`User ${id}`}));
    publish(rows); await redis.config("SET","requirepass","fixture-redis");
    const coldConnections=await Promise.all(Array.from({length:30},()=>persistentCache(executor)));
    expect(new Set(coldConnections).size).toBe(1); expect(channels).toBe(1);
    const start = bytes; const first = await readVersioned(executor,"users","system");
    expect(first?.rows).toHaveLength(1000); const coldFullBytes=bytes-start;
    forgetVersioned(executor); const warmStart=bytes; const warm=await readVersioned(executor,"users","system"); const fullBytes=bytes-warmStart;
    const samples: number[]=[]; const metaStart = bytes;
    for(let n=0;n<30;n++) {const at=performance.now(); const value=await readVersioned(executor,"users","system"); samples.push(performance.now()-at); expect(value?.rows).toBe(warm?.rows);}
    const metaBytes=(bytes-metaStart)/30;
    expect(metaBytes).toBeLessThan(fullBytes / 2);
    const connections=await Promise.all(Array.from({length:30},()=>persistentCache(executor)));
    expect(new Set(connections).size).toBe(1);
    expect(await persistentCache(executor,true)).not.toBeNull(); expect(channels).toBe(2);
    const ordered=samples.sort((a,b)=>a-b);
    writeFileSync(resolve("../.cache/drawables-v2/transport-benchmark.json"),JSON.stringify({environment:"local SSH and unix Redis; reply delay 100ms",rows:1000,repetitions:30,coldFullBytes,fullBytes,unchangedBytes:metaBytes,p50Ms:ordered[14],p95Ms:ordered[28],sshChannels:channels},null,2));
  },15_000);
  it("replays metadata invalidations and requests reconciliation after a cursor gap", async () => {
    const frames: any[]=[];
    const stop = await subscribeData(executor,["users/system"],"0-0",frame=>frames.push(frame));
    expect(frames.some(frame=>frame.type==="data:resync")).toBe(true);
    const id=await redis.xadd("lprc:v2:events","*","module","users","collection","system","version","next");
    for(let n=0;n<50 && !frames.some(frame=>frame.cursor===id);n++) await pause(50);
    expect(frames.some(frame=>frame.type==="data:invalidate" && frame.cursor===id)).toBe(true);
    expect(frames.every(frame=>!("rows" in frame) && !("version" in frame))).toBe(true);
    const replay: any[]=[];
    const stop2=await subscribeData(executor,["users/system"],id,frame=>replay.push(frame));
    expect(replay.some(frame=>frame.reason==="reconcile")).toBe(false);
    stop2(); stop();
  },10_000);
  it("never opens the administrative cache for a hosting context", async () => {
    const count=channels;
    const result=await runWithExecutor(executor,()=>readVersioned(executor,"users","system"),7,{kind:"hosting",userId:7,username:"tenant",modules:[]} as never);
    expect(result).toBeNull();expect(channels).toBe(count);
  });
  it("preserves the last payload on collector failure and recovers with the next publication", async () => {
    const before=await readVersioned(executor,"users","system");expect(before).not.toBeNull();
    await redis.config("SET","requirepass","");
    execFileSync("python3",["-c",`import sys
sys.path.insert(0,sys.argv[1])
import common,live_view
r=common.Redis('127.0.0.1',6379,'')
r._base=['redis-cli','-s',sys.argv[2]]
r._env.pop('REDISCLI_AUTH',None)
common.load_conn=lambda: ('127.0.0.1',6379,'')
common.Redis=lambda *args:r
live_view.mark_stale('users','system')
`,python,join(dir,"redis.sock")],{env:{...process.env,LUXIPANEL_CONFIG_DIR:dir}});
    await redis.config("SET","requirepass","fixture-redis");
    const stale=await readVersioned(executor,"users","system");expect(stale?.meta.state).toBe("stale");expect(stale?.rows).toBe(before?.rows);
    const failedEvent=(await redis.xrevrange("lprc:v2:events","+","-","COUNT",1))[0]![0];
    await redis.config("SET","requirepass","");publish(before!.rows);await redis.config("SET","requirepass","fixture-redis");
    expect((await readVersioned(executor,"users","system"))?.meta.state).toBeUndefined();
    const recovery=await redis.xrange("lprc:v2:events",`(${failedEvent}`,"+");
    expect(recovery).toHaveLength(1);
    expect(recovery[0]![1]).toContain("users");
  });
  it("keeps identity-specific snapshots and returns null on loss of the payload", async () => {
    const value=await readVersioned(executor,"users","system");expect(value).not.toBeNull();
    forgetVersioned(executor);
    const current=JSON.parse((await redis.get("lprc:v2:users:system:current"))!);
    await redis.del(current.payloadKey);
    expect(await readVersioned(executor,"users","system")).toBeNull();
  });
});
