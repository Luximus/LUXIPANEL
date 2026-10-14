type Job<T = unknown> = {run:()=>Promise<T>;resolve:(value:T)=>void;reject:(reason:unknown)=>void;signal?:AbortSignal|null;abort?:()=>void};
/** Bound concurrent JSON reads. Mutations and streaming requests bypass this queue. */
export function createReadScheduler(limit = 4) {
  let active = 0;
  let generation = 0;
  const queue: Job[] = [];
  const drain = () => {
    while (active < limit && queue.length) {
      const job = queue.shift()!;
      job.signal?.removeEventListener("abort", job.abort!);
      if (job.signal?.aborted) {job.reject(job.signal.reason ?? new DOMException("Aborted", "AbortError"));continue;}
      active++;
      let task: Promise<unknown>;
      try { task = job.run(); } catch (error) { active--; job.reject(error); continue; }
      task.then(job.resolve,job.reject).finally(() => {active--;drain();});
    }
  };
  return {
    version: () => generation,
    run<T>(run:()=>Promise<T>, signal?:AbortSignal|null):Promise<T> {
      return new Promise<T>((resolve,reject) => {
        const job:Job = {run,resolve:resolve as (value:unknown)=>void,reject,signal};
        job.abort = () => {const i=queue.indexOf(job);if(i>=0){queue.splice(i,1);reject(signal?.reason ?? new DOMException("Aborted","AbortError"));}};
        signal?.addEventListener("abort",job.abort,{once:true});queue.push(job);drain();
      });
    },
    clear() {generation++;for(const job of queue.splice(0)){job.signal?.removeEventListener("abort",job.abort!);job.reject(new DOMException("Session changed","AbortError"));}},
  };
}
const slot=Symbol.for("luxipanel.read-scheduler.v1");
export function browserReadScheduler() {
  const host=window as unknown as Record<symbol,ReturnType<typeof createReadScheduler>>;
  if(!host[slot]) {
    host[slot]=createReadScheduler();
    for(const event of ["luxipanel:target-changed","luxipanel:logout","luxipanel:session-ended","luxipanel:session-started","luxipanel:permissions-changed"]) window.addEventListener(event,()=>host[slot].clear());
  }
  return host[slot];
}
