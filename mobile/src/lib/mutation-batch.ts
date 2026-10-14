/** Resume at the failed item; never replay successful destructive actions on retry. */
export function createMutationBatch<T>(items: readonly T[], apply: (item:T) => Promise<{ok:boolean;error?:string}>, label: (item:T)=>string) {
  const pending = [...items];
  let running = false;
  return async () => {
    if (running) throw new Error('La operación ya está en curso.');
    running = true;
    try {
      while (pending.length) {
        const item = pending[0];
        const result = await apply(item);
        if (!result.ok) throw new Error(`${label(item)}: ${result.error ?? 'No se pudo completar la operación.'}`);
        pending.shift();
      }
    } finally { running = false; }
  };
}
