// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Runs on the connected target. Bridges Codex app-server JSON-RPC to the
// existing codex-exec JSONL stream and relays native approval requests.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, unlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
const prompt = await readFile(config.promptFile, 'utf8');
const codex = spawn('codex', ['app-server', '-c', 'features.fast_mode=true'], { stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let nextId = 1;
let completed = false;
let finalMessage = '';
let finalPhaseSeen = false;
let emptyFinalSeen = false;
let finishing = false;
let fullPlan = '';
let usage = null;
let previousUsage = null;
let turnTemplate;
let recoveringAnswer = false;
let recoveryGuard;
const settledTurns = new Set();
const activeItems = new Map();
let idleGuard;
let killGuard;
const IDLE_TIMEOUT_MS = 60 * 60_000;

// Only actual work renews the deadline; stderr, RPC replies and health/status
// chatter cannot keep a stuck job alive forever.
function touchActivity() {
  if (completed || finishing) return;
  clearTimeout(idleGuard);
  idleGuard = setTimeout(() => failTurn('Codex no registró actividad durante 60 minutos.', 'CLI_IDLE_TIMEOUT'), IDLE_TIMEOUT_MS);
  idleGuard.unref();
}

function stopCodex() {
  clearTimeout(idleGuard);
  clearTimeout(recoveryGuard);
  codex.kill('SIGTERM');
  killGuard = setTimeout(() => {
    if (codex.exitCode === null && codex.signalCode === null) codex.kill('SIGKILL');
  }, 5_000);
  killGuard.unref();
}

function failTurn(message, code = 'CLI_FAILED') {
  if (completed) return;
  completed = true;
  process.exitCode = 1;
  emit({ type: 'turn.failed', error: { message, code } });
  stopCodex();
}

const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
const startupAt = Date.now();
const startup = (stage) => {
  if (!completed && !finishing) emit({ type: 'lxp.startup', stage, timestamp: new Date().toISOString(), elapsedMs: Date.now() - startupAt });
};
const send = (event) => codex.stdin.write(JSON.stringify(event) + '\n');
const rpc = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  send({ id, method, params });
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let nextApprovalId = 1;

async function approval(message) {
  const params = message.params || {};
  const command = typeof params.command === 'string' ? params.command : '';
  const kind = message.method === 'item/fileChange/requestApproval' ? 'file_change' : 'command_execution';
  const item = activeItems.get(params.itemId);
  const paths = item?.changes?.map((change) => change.path).filter(Boolean).join(', ') || '';
  const decision = await requestDecision({ tool: kind === 'file_change' ? 'Codex Edit' : 'Codex Bash', title: kind === 'file_change' ? 'Editar archivos' : 'Ejecutar comando', detail: [command, paths, params.reason].filter(Boolean).join('\n').slice(0, 4000) });
  if (!completed) send({ id: message.id, result: { decision: decision === 'allow' ? 'accept' : decision === 'always' ? 'acceptForSession' : 'decline' } });
}

async function requestDecision(details) {
  // Recovering the text of an answer never authorizes a new operation.
  if (recoveringAnswer) return 'deny';
  // Local numeric ids keep reply paths independent of untrusted RPC ids.
  const requestId = String(nextApprovalId++);
  emit({ type: 'lxp.approval.request', request_id: requestId, ...details });
  const replyFile = config.approvalDir + '/' + requestId + '.json';
  let decision = 'deny';
  const deadline = Date.now() + 5 * 60_000;
  while (!completed && Date.now() < deadline && codex.exitCode === null) {
    try {
      const reply = JSON.parse(await readFile(replyFile, 'utf8'));
      decision = reply.decision;
      await unlink(replyFile).catch(() => {});
      break;
    } catch { await pause(350); }
  }
  return decision;
}

function mcpApprovalQuestion(message) {
  const params = message.params || {};
  const item = activeItems.get(params.itemId);
  // A general model question is not an approval. Require a matching live MCP
  // call and the protocol's explicit approval choices before using the broker.
  if (item?.type !== 'mcpToolCall' || !item.server || !item.tool || params.questions?.length !== 1) return null;
  const question = params.questions[0];
  if (!question.id || question.isSecret || !Array.isArray(question.options)) return null;
  const labels = question.options.map(option => option.label);
  const legacy = labels.includes('Accept') && labels.includes('Decline')
    && labels.every(label => ['Accept', 'Decline', 'Cancel'].includes(label));
  const current = question.id === 'mcp_tool_call_approval_' + item.id
    && labels.includes('Allow') && labels.includes('Cancel')
    && labels.every(label => ['Allow', 'Allow for this session', "Allow and don't ask me again", 'Cancel'].includes(label));
  if (!legacy && !current) return null;
  return { item, question, allowLabel: legacy ? 'Accept' : 'Allow', denyLabel: legacy ? 'Decline' : 'Cancel' };
}

async function mcpApproval(message, approval) {
  const { item, question } = approval;
  const decision = await requestDecision({
    tool: 'mcp__' + item.server + '__' + item.tool,
    title: 'Permitir herramienta MCP: ' + item.tool,
    detail: String(question.question || item.server).slice(0, 4000),
  });
  const allowed = (decision === 'allow' || decision === 'always') && activeItems.get(item.id) === item;
  if (!completed) send({ id: message.id, result: { answers: {
    [question.id]: { answers: [allowed ? approval.allowLabel : approval.denyLabel] },
  } } });
}

function mcpElicitationApproval(params) {
  const meta = params._meta || {};
  const schema = params.requestedSchema;
  if (params.mode !== 'form' || meta.codex_approval_kind !== 'mcp_tool_call' || schema?.type !== 'object') return null;
  // Approval forms have no data fields; some versions offer only an optional
  // persistence checkbox. Never fabricate responses to arbitrary MCP forms.
  const properties = schema.properties || {};
  if (Object.entries(properties).some(([key, value]) => key !== 'persist' || value?.type !== 'boolean')) return null;
  if ((schema.required || []).some(key => key !== 'persist')) return null;
  // Native Codex 0.160 approvals omit tool_name and callId. Correlate their
  // exact arguments with a single live call on this server; never guess when
  // concurrent calls are indistinguishable. Explicit identifiers still bind.
  const hasCallId = typeof meta.callId === 'string' && meta.callId.length > 0;
  const hasToolName = typeof meta.tool_name === 'string' && meta.tool_name.length > 0;
  const hasArguments = Object.hasOwn(meta, 'tool_params');
  if (!hasCallId && !hasToolName && !hasArguments) return null;
  const calls = [...activeItems.values()].filter(item => item.type === 'mcpToolCall'
    && item.server === params.serverName && item.tool
    && (!hasCallId || item.id === meta.callId)
    && (!hasToolName || item.tool === meta.tool_name)
    && (!hasArguments || isDeepStrictEqual(item.arguments, meta.tool_params)));
  if (calls.length !== 1) return null;
  return { item: calls[0], content: Object.hasOwn(properties, 'persist') ? { persist: false } : {} };
}

async function mcpElicitation(message, approval) {
  const meta = message.params._meta || {};
  const decision = await requestDecision({
    tool: 'mcp__' + approval.item.server + '__' + approval.item.tool,
    title: 'Permitir herramienta MCP: ' + approval.item.tool,
    detail: String(message.params.message || approval.item.server).slice(0, 4000),
    require_user_approval: Boolean(meta.codex_requires_user_input || meta.codex_sensitive_action || meta.codex_strict_auto_review),
  });
  const allowed = (decision === 'allow' || decision === 'always')
    && activeItems.get(approval.item.id) === approval.item;
  if (!completed) send({ id: message.id, result: { action: allowed ? 'accept' : 'decline', content: allowed ? approval.content : null } });
}

function normalizeItem(item) {
  const type = {
    agentMessage: 'agent_message', commandExecution: 'command_execution',
    fileChange: 'file_change', mcpToolCall: 'mcp_tool_call', webSearch: 'web_search',
  }[item.type] || item.type;
  return {
    ...item, type,
    ...(item.aggregatedOutput !== undefined ? { aggregated_output: item.aggregatedOutput } : {}),
    ...(item.exitCode !== undefined ? { exit_code: item.exitCode } : {}),
  };
}

function planAnswer(plan) {
  const clean = plan.trim();
  const first = clean.split('\n').map((line) => line.replace(/^#+\s*/, '').trim()).find(Boolean) || 'Plan preparado';
  const summary = first.slice(0, 220);
  return 'Resumen: ' + summary + '\n\nPlan completo:\n' + clean +
    '\n\n<<<LXP_ASK>>>\n' +
    '{"kind":"plan-approval","questions":[{"id":"plan","type":"single","text":"¿Apruebas este plan?","options":["Aprobar plan","Pedir cambios"]}]}\n' +
    '<<<LXP_ASK_END>>>';
}

function finalItem(items) {
  if (!Array.isArray(items)) return undefined;
  for (const entry of items) {
    const item = entry?.item || entry;
    if (item?.type === 'agentMessage' && item.phase === 'final_answer' && typeof item.text === 'string' && item.text.trim()) return item;
  }
  return undefined;
}

function hasEmptyFinal(items) {
  return Array.isArray(items) && items.some(entry => {
    const item = entry?.item || entry;
    return item?.type === 'agentMessage' && item.phase === 'final_answer'
      && typeof item.text === 'string' && !item.text.trim();
  });
}

async function recoverEmptyAnswer() {
  recoveringAnswer = true;
  emptyFinalSeen = false;
  previousUsage = usage;
  usage = null;
  activeItems.clear();
  finishing = false;
  recoveryGuard = setTimeout(() => failTurn('Codex did not recover the empty final answer in time', 'CLI_NO_FINAL_RESPONSE'), 180_000);
  recoveryGuard.unref();
  const instructions = 'La fase anterior terminó con una respuesta final vacía. Recupera únicamente la respuesta final usando lo ya observado en esta conversación. No repitas la tarea ni ejecutes herramientas, comandos, cambios, delegaciones o envíos de mensajes. Explica brevemente el resultado confirmado y lo que siga pendiente; no inventes verificaciones ni éxito.';
  try {
    // Same native thread, one bounded attempt, no replay of the original task.
    // Restore the normal policy only when the next real user turn starts.
    await rpc('turn/start', {
      ...turnTemplate,
      input: [{ type: 'text', text: instructions }],
      collaborationMode: { ...turnTemplate.collaborationMode, settings: {
        ...turnTemplate.collaborationMode.settings, developer_instructions: instructions,
      } },
      approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly', networkAccess: false },
    });
    touchActivity();
  } catch (error) {
    failTurn('Could not recover Codex final answer: ' + String(error), 'CLI_NO_FINAL_RESPONSE');
  }
}

async function finishTurn(params) {
  if (completed || finishing || (params.turn?.id && settledTurns.has(params.turn.id))) return;
  if (params.turn?.id) settledTurns.add(params.turn.id);
  finishing = true;
  clearTimeout(idleGuard);
  if (params.turn?.status !== 'completed') {
    failTurn(params.turn?.error?.message || 'Codex turn did not complete');
    return;
  }

  // Some Codex versions finish a turn without delivering its final
  // item/completed notification to this subscriber. Read the persisted turn
  // before accepting the last commentary message as the final answer.
  if (!finalPhaseSeen) {
    emptyFinalSeen ||= hasEmptyFinal(params.turn?.items);
    let item = finalItem(params.turn?.items);
    if (!item && params.threadId && params.turn?.id) {
      try {
        const page = await Promise.race([
          rpc('thread/items/list', { threadId: params.threadId, turnId: params.turn.id, sortDirection: 'desc', limit: 20 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('final answer lookup timed out')), 5_000).unref()),
        ]);
        if (completed) return;
        item = finalItem(page?.data);
        emptyFinalSeen ||= hasEmptyFinal(page?.data);
      } catch (error) {
        emit({ type: 'error', message: 'Could not read Codex final answer: ' + String(error) });
      }
    }
    if (completed) return;
    if (item) {
      finalMessage = item.text;
      finalPhaseSeen = true;
      emit({ type: 'item.completed', item: { type: 'agent_message', phase: 'final_answer', text: item.text } });
    }
  }
  if (!finalPhaseSeen && !(config.approvalMode === 'plan' && fullPlan.trim())) {
    if (emptyFinalSeen && !recoveringAnswer && config.approvalMode !== 'plan'
        && params.threadId === turnTemplate?.threadId) {
      await recoverEmptyAnswer();
      return;
    }
    failTurn('Codex finished without a confirmed final answer', 'CLI_NO_FINAL_RESPONSE');
    return;
  }
  if (config.approvalMode === 'plan' && fullPlan) {
    emit({ type: 'item.completed', item: { type: 'agent_message', phase: 'final_answer', text: planAnswer(fullPlan) } });
  }
  if (config.approvalMode === 'plan' && !fullPlan && finalMessage) {
    emit({ type: 'item.completed', item: { type: 'agent_message', phase: 'final_answer', text: finalMessage.includes('<<<LXP_ASK>>>') ? finalMessage : planAnswer(finalMessage) } });
  }
  emit({ type: 'turn.completed', usage: usage || previousUsage ? {
    input_tokens: (usage?.inputTokens || 0) + (previousUsage?.inputTokens || 0),
    cached_input_tokens: (usage?.cachedInputTokens || 0) + (previousUsage?.cachedInputTokens || 0),
    output_tokens: (usage?.outputTokens || 0) + (previousUsage?.outputTokens || 0),
  } : undefined, status: params.turn?.status });
  completed = true;
  stopCodex();
}

function onNotification(message) {
  const method = message.method;
  const params = message.params || {};
  if (completed) return;
  if (/^item\/(?:started|completed|(?:agentMessage|reasoning|plan|commandExecution|fileChange|mcpToolCall|contextCompaction)\/)/.test(method)
      || method === 'thread/compacted' || method === 'turn/plan/updated') touchActivity();
  if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
    void approval(message).catch((error) => {
      emit({ type: 'error', message: String(error) });
      send({ id: message.id, result: { decision: 'decline' } });
    });
    return;
  }
  if (method === 'item/tool/requestUserInput' || method === 'tool/requestUserInput') {
    const question = mcpApprovalQuestion(message);
    if (question) {
      touchActivity();
      void mcpApproval(message, question).catch(() => {
        if (!completed) send({ id: message.id, result: { answers: { [question.question.id]: { answers: [question.denyLabel] } } } });
      });
      return;
    }
  }
  if (method === 'mcpServer/elicitation/request') {
    const approval = mcpElicitationApproval(params);
    if (approval) {
      touchActivity();
      void mcpElicitation(message, approval).catch(() => {
        if (!completed) send({ id: message.id, result: { action: 'decline', content: null } });
      });
      return;
    }
  }
  // Unknown approval or user-input callbacks must fail closed, never hang a turn.
  if (message.id !== undefined) {
    emit({ type: 'error', code: 'CLI_APPROVAL_UNSUPPORTED', message: 'LUXIPANEL no pudo tramitar esta solicitud de permiso de Codex; no se concedió permiso: ' + String(method) });
    send({ id: message.id, error: { code: -32601, message: 'Unsupported interactive request' } });
    return;
  }
  if (method === 'item/started' || method === 'item/completed') {
    const item = params.item || {};
    if (recoveringAnswer && !['agentMessage', 'reasoning', 'userMessage', 'contextCompaction'].includes(item.type)) {
      failTurn('Codex attempted work instead of recovering only its answer', 'CLI_NO_FINAL_RESPONSE');
      return;
    }
    if (item.id && method === 'item/started') activeItems.set(item.id, item);
    if (item.id && method === 'item/completed') activeItems.delete(item.id);
    if (item.type === 'plan' && method === 'item/completed') fullPlan = item.text || '';
    if (item.type === 'agentMessage' && method === 'item/completed' && typeof item.text === 'string') {
      if (item.phase === 'final_answer') {
        if (item.text.trim()) {
          finalMessage = item.text;
          finalPhaseSeen = true;
        } else emptyFinalSeen = true;
      }
    }
    if (item.type !== 'plan') emit({ type: method === 'item/started' ? 'item.started' : 'item.completed', item: normalizeItem(item) });
    return;
  }
  if (method === 'thread/tokenUsage/updated') {
    usage = params.tokenUsage?.last || params.tokenUsage?.total || usage;
    return;
  }
  if (method === 'turn/completed') {
    void finishTurn(params);
  }
  if (method === 'turn/failed') {
    failTurn(params.turn?.error?.message || 'Codex turn failed');
  }
}

createInterface({ input: codex.stdout }).on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id !== undefined && !message.method) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  } else if (message.method) onNotification(message);
});
codex.stderr.on('data', (chunk) => emit({ type: 'error', message: String(chunk).slice(0, 1000) }));
codex.on('exit', (code) => {
  clearTimeout(idleGuard);
  clearTimeout(killGuard);
  for (const waiter of pending.values()) waiter.reject(new Error('Codex app-server exited: ' + code));
  pending.clear();
  if (!completed) {
    process.exitCode = code || 1;
    completed = true;
    emit({ type: 'turn.failed', error: { message: 'Codex app-server exited without completing the turn', code: 'CLI_EXIT' } });
  }
});

try {
  startup('initializing');
  await rpc('initialize', { clientInfo: { name: 'luxipanel', title: 'LUXIPANEL', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  send({ method: 'initialized', params: {} });
  const mode = config.approvalMode;
  const policy = mode === 'manual' ? 'on-request' : 'never';
  const sandbox = mode === 'auto' ? 'danger-full-access' : 'read-only';
  startup(config.resume ? 'resuming' : 'creating');
  const session = config.resume
    ? await rpc('thread/resume', { threadId: config.sessionId, cwd: config.cwd, config: config.projectConfig ?? {}, approvalPolicy: policy, sandbox })
    : await rpc('thread/start', { cwd: config.cwd, config: config.projectConfig ?? {}, approvalPolicy: policy, sandbox, ...(config.model ? { model: config.model } : {}) });
  const threadId = session.thread?.id;
  if (!threadId) throw new Error('Codex did not return a thread id');
  emit({ type: 'thread.started', thread_id: threadId });
  const model = config.model || session.thread?.model || 'gpt-6-sol';
  const collaborationMode = { mode: mode === 'plan' ? 'plan' : 'default', settings: {
    model, reasoning_effort: config.effort || (mode === 'plan' ? 'medium' : null), developer_instructions: null,
  } };
  const sandboxPolicy = mode === 'auto'
    ? { type: 'dangerFullAccess' }
    : { type: 'readOnly', networkAccess: false };
  startup('submitting');
  turnTemplate = {
    threadId, input: [{ type: 'text', text: prompt }], collaborationMode,
    approvalPolicy: policy, sandboxPolicy, serviceTier: config.speed === 'fast' ? 'fast' : 'default',
  };
  await rpc('turn/start', turnTemplate);
  startup('ready');
  touchActivity();
} catch (error) {
  failTurn(String(error));
}
