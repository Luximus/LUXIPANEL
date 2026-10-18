// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

interface FakeOptions {
  emptyFinal?: string;
  persistedEmpty?: boolean;
  recoveryAnswer?: string;
  firstStatus?: string;
  plan?: boolean;
  recoveryApproval?: boolean;
  recoveryTool?: boolean;
}
function runAdapter(finalAnswer: string, effort?: string, options: FakeOptions = {}): { status: number; events: Array<Record<string, unknown>>; calls: any[] } {
  const dir = mkdtempSync(join(tmpdir(), "lxp-codex-final-"));
  dirs.push(dir);
  const bin = join(dir, "codex");
  writeFileSync(bin, `#!/usr/bin/env node
const readline=require('node:readline');
const fs=require('node:fs');
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const opts=JSON.parse(process.env.FAKE_OPTIONS);
let turns=0;
const finish=()=>{
  send({method:'thread/tokenUsage/updated',params:{tokenUsage:{last:{inputTokens:turns===1?10:5,outputTokens:turns===1?2:3}}}});
  send({method:'item/completed',params:{item:{type:'agentMessage',text:turns===1?'Voy a revisarlo.':'Recuperando respuesta.',phase:'commentary'}}});
  if(turns===1 && opts.emptyFinal!==undefined && !opts.persistedEmpty || turns===2)
    send({method:'item/completed',params:{item:{type:'agentMessage',text:turns===1?opts.emptyFinal:opts.recoveryAnswer||'',phase:'final_answer'}}});
  send({method:'turn/completed',params:{threadId:'fake-thread',turn:{id:'fake-turn-'+turns,status:turns===1?opts.firstStatus||'completed':'completed',items:[]}}});
};
readline.createInterface({input:process.stdin}).on('line',line=>{
  let x;try{x=JSON.parse(line)}catch{return}if(!x.id)return;
  fs.appendFileSync(process.env.FAKE_CALLS,JSON.stringify(x)+'\\n');
  if(x.id===500 && !x.method){finish();return;}
  if(x.method==='initialize')send({id:x.id,result:{}});
  else if(x.method==='thread/start')send({id:x.id,result:{thread:{id:'fake-thread',model:'fake'}}});
  else if(x.method==='turn/start'){
    turns++;
    if(process.env.FAKE_EFFORT && (x.params.collaborationMode?.settings?.reasoning_effort!==process.env.FAKE_EFFORT || x.params.collaborationMode?.settings?.model!=='gpt-6-astra')){
      send({id:x.id,error:{code:-32602,message:'Incorrect reasoning/model'}});return;
    }
    send({id:x.id,result:{turn:{id:'fake-turn-'+turns}}});
    if(turns===2 && opts.recoveryApproval){send({id:500,method:'item/commandExecution/requestApproval',params:{command:'touch should-not-run'}});return;}
    if(turns===2 && opts.recoveryTool){send({method:'item/started',params:{item:{id:'unexpected',type:'mcpToolCall',server:'test',tool:'write'}}});return;}
    finish();
  }else if(x.method==='thread/items/list'){
    const text=turns===1?opts.persistedEmpty?opts.emptyFinal:process.env.FAKE_FINAL:opts.recoveryAnswer;
    send({id:x.id,result:{data:text || opts.persistedEmpty?[{item:{type:'agentMessage',text:text||'',phase:'final_answer'}}]:[]}});
  }
});
`);
  chmodSync(bin, 0o755);
  const promptFile = join(dir, "prompt.txt");
  const configFile = join(dir, "config.json");
  writeFileSync(promptFile, "Verificar despliegue");
  writeFileSync(configFile, JSON.stringify({ promptFile, approvalDir: dir, approvalMode: options.plan ? "plan" : "auto", resume: false, cwd: dir, model: "gpt-6-astra", effort }));
  const callsFile = join(dir, "calls.jsonl");
  const adapter = new URL("./codex-app-server-adapter.mjs", import.meta.url).pathname;
  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [adapter, configFile], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}`, FAKE_FINAL: finalAnswer, FAKE_EFFORT: effort ?? "", FAKE_OPTIONS: JSON.stringify(options), FAKE_CALLS: callsFile },
      encoding: "utf8",
      timeout: 10_000,
    });
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    status = e.status ?? 1;
    stdout = e.stdout ?? "";
  }
  return { status, events: stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>), calls: readFileSync(callsFile, "utf8").trim().split("\n").map(line => JSON.parse(line)) };
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
    const { status, events, calls } = runAdapter("");
    expect(status).not.toBe(0);
    expect(events.some((e) => e.type === "turn.failed" && JSON.stringify(e.error).includes("without a confirmed final answer"))).toBe(true);
    expect(calls.filter(call => call.method === "turn/start")).toHaveLength(1);
  });

  it.each(["", " \n "])("recovers an explicitly empty final in the same bubble and thread: %j", emptyFinal => {
    const { status, events, calls } = runAdapter("", "max", { emptyFinal, recoveryAnswer: "Pruebas correctas; despliegue pendiente." });
    expect(status).toBe(0);
    expect(events.filter(e => e.type === "thread.started")).toHaveLength(1);
    expect(events.filter(e => e.type === "turn.completed")).toEqual([{
      type: "turn.completed", status: "completed", usage: { input_tokens: 15, cached_input_tokens: 0, output_tokens: 5 },
    }]);
    const starts = calls.filter(call => call.method === "turn/start");
    expect(starts).toHaveLength(2);
    expect(starts[1].params).toMatchObject({ threadId: "fake-thread", approvalPolicy: "never", sandboxPolicy: { type: "readOnly", networkAccess: false } });
    expect(starts[1].params.input[0].text).not.toContain("Verificar despliegue");
    expect(starts[1].params.input[0].text).toContain("No repitas la tarea");
    expect(starts[1].params.collaborationMode.settings).toMatchObject({ model: "gpt-6-astra", reasoning_effort: "max" });
    expect(events.some(e => e.type === "turn.failed")).toBe(false);
  });

  it("recovers an empty final found only in persisted native items", () => {
    const { status, calls } = runAdapter("", undefined, { emptyFinal: "", persistedEmpty: true, recoveryAnswer: "Aviso recibido." });
    expect(status).toBe(0);
    expect(calls.filter(call => call.method === "turn/start")).toHaveLength(2);
  });

  it("stops after one unsuccessful answer recovery", () => {
    const { status, events, calls } = runAdapter("", undefined, { emptyFinal: "" });
    expect(status).toBe(1);
    expect(calls.filter(call => call.method === "turn/start")).toHaveLength(2);
    expect(events.filter(e => e.type === "turn.failed")).toHaveLength(1);
    expect(events.some(e => e.type === "turn.completed")).toBe(false);
  });

  it.each([{ firstStatus: "failed" }, { firstStatus: "interrupted" }, { plan: true }])("does not retry a failed phase or skip plan approval: %j", options => {
    const { status, events, calls } = runAdapter("", undefined, { emptyFinal: "", ...options });
    expect(status).toBe(1);
    expect(calls.filter(call => call.method === "turn/start")).toHaveLength(1);
    expect(events.some(e => e.type === "turn.completed")).toBe(false);
  });

  it("never grants a new approval while recovering an answer", () => {
    const { status, events, calls } = runAdapter("", undefined, { emptyFinal: "", recoveryAnswer: "No se realizaron más cambios.", recoveryApproval: true });
    expect(status).toBe(0);
    expect(calls.find(call => call.id === 500)).toMatchObject({ result: { decision: "decline" } });
    expect(events.some(e => e.type === "lxp.approval.request")).toBe(false);
  });

  it("aborts if the answer recovery tries to run a tool", () => {
    const { status, events } = runAdapter("", undefined, { emptyFinal: "", recoveryTool: true });
    expect(status).toBe(1);
    expect(events.at(-1)).toMatchObject({ type: "turn.failed", error: { code: "CLI_NO_FINAL_RESPONSE" } });
    expect(events.some(e => e.type === "turn.completed")).toBe(false);
  });
});
