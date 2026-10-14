import { EventEmitter } from "node:events";
import { getRedis } from "../redis/index.js";
import { getContextExecutor } from "../executor/context.js";
import { ServiceUnavailableError } from "../errors/index.js";
export const authorizationChanges = new EventEmitter();
authorizationChanges.setMaxListeners(0);
const CHANNEL = "lxp:authorization:changed";
let subscriber: ReturnType<typeof getRedis> | null = null;
export async function authorizationRevision(targetId: string): Promise<string> {
  try { return String(await getRedis().get(`lxp:authorization:revision:${targetId}`) ?? "0"); }
  catch { throw new ServiceUnavailableError("Authorization service unavailable"); }
}
export async function authorizationChanged(targetId = getContextExecutor()?.target.id): Promise<string> {
  if (!targetId) throw new ServiceUnavailableError("Authorization target missing");
  const redis = getRedis();
  const revision = await redis.incr(`lxp:authorization:revision:${targetId}`);
  authorizationChanges.emit("changed", targetId);
  await redis.publish(CHANNEL, targetId);
  return String(revision);
}
export function subscribeAuthorizationChanges(): void {
  if (subscriber) return;
  subscriber = getRedis().duplicate();
  subscriber.on("message", (_channel: string, target: string) => authorizationChanges.emit("changed", target));
  void subscriber.subscribe(CHANNEL).catch(() => { subscriber?.disconnect(); subscriber = null; });
}
