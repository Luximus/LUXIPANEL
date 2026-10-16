// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function runAdapter(finalAnswer: string, effort?: string): { status: number; events: Array<Record<string, unknown>> } {
  const dir = mkdtempSync(join(tmpdir(), "lxp-codex-final-"));
  dirs.push(dir);
  const bin = join(dir, "codex");
  writeFileSync(bin, `#!/usr/bin/env node
const readline=require('node:readline');
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
  let x;try{x=JSON.parse(line)}catch{return}if(!x.id)return;
  if(x.method==='initialize')send({id:x.id,result:{}});
  else if(x.method==='thread/start')send({id:x.id,result:{thread:{id:'fake-thread',model:'fake'}}});
  else if(x.method==='turn/start'){
    if(process.env.FAKE_EFFORT && (x.params.collaborationMode?.settings?.reasoning_effort!==process.env.FAKE_EFFORT || x.params.collaborationMode?.settings?.model!=='gpt-6-astra')){
      send({id:x.id,error:{code:-32602,message:'Incorrect reasoning/model'}});return;
    }
    send({id:x.id,result:{turn:{id:'fake-turn'}}});
    send({method:'item/completed',params:{item:{type:'agentMessage',text:'Voy a desplegarlo.',phase:'commentary'}}});
    send({method:'turn/completed',params:{threadId:'fake-thread',turn:{id:'fake-turn',status:'completed',items:[]}}});
  }else if(x.method==='thread/items/list')send({id:x.id,result:{data:process.env.FAKE_FINAL?[{item:{type:'agentMessage',text:process.env.FAKE_FINAL,phase:'final_answer'}}]:[]}});
});
`);
  chmodSync(bin, 0o755);
  const promptFile = join(dir, "prompt.txt");
  const configFile = join(dir, "config.json");
  writeFileSync(promptFile, "Verificar despliegue");
  writeFileSync(configFile, JSON.stringify({ promptFile, approvalDir: dir, approvalMode: "auto", resume: false, cwd: dir, model: "gpt-6-astra", effort }));
  const adapter = new URL("./codex-app-server-adapter.mjs", import.meta.url).pathname;
  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [adapter, configFile], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}`, FAKE_FINAL: finalAnswer, FAKE_EFFORT: effort ?? "" },
      encoding: "utf8",
      timeout: 10_000,
    });
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    status = e.status ?? 1;
    stdout = e.stdout ?? "";
  }
  return { status, events: stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe("Codex app-server final answer", () => {
  it("sends Astra with exact max reasoning to the native Codex turn", () => {
    const { status, events } = runAdapter("Verificado.", "max");
    expect(status).toBe(0);
    expect(events.some(e => e.type === "turn.failed")).toBe(false);
  });

  it("recovers a persisted final answer after a commentary-only stream", () => {
    const { status, events } = runAdapter("Desplegado y verificado.");
    expect(status).toBe(0);
    expect(events.filter((e) => e.type === "item.completed").at(-1)).toEqual({
      type: "item.completed", item: { type: "agent_message", phase: "final_answer", text: "Desplegado y verificado." },
    });
  });

  it("does not report success when Codex has no confirmed final answer", () => {
    const { status, events } = runAdapter("");
    expect(status).not.toBe(0);
    expect(events.some((e) => e.type === "turn.failed" && JSON.stringify(e.error).includes("without a confirmed final answer"))).toBe(true);
  });
});
