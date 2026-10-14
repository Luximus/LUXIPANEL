export type RepairTarget = "auto" | "web" | "desktop" | "mobile" | "developer";
export type RepairCheck = "backend-types" | "backend-tests" | "frontend-tests" | "frontend-build" | "desktop-types" | "desktop-tests" | "desktop-build" | "mobile-types" | "mobile-tests";
export function repairTarget(files: string[], requested: string = "auto"): Exclude<RepairTarget, "auto"> {
  if (files.some((file) => file.startsWith("web/modules/"))) throw new Error("Los módulos requieren un aporte separado a modules.");
  const areas = new Set(files.map((file) => file.split("/")[0]));
  const area = areas.size === 1 ? [...areas][0] : undefined;
  const detected = area && ["web", "desktop", "mobile"].includes(area) && !files.some((file) => file.startsWith("web/scripts/")) ? area : "developer";
  const selected = requested === "" || requested === "main" ? "auto" : requested;
  if (!["auto", "web", "desktop", "mobile", "developer"].includes(selected)) throw new Error("Destino de reparación inválido.");
  if (selected !== "auto" && selected !== "developer" && selected !== detected) throw new Error(`El arreglo pertenece a ${detected}; cambia su destino o divide el aporte.`);
  return (selected === "auto" ? detected : selected) as Exclude<RepairTarget, "auto">;
}
export function requiredChecks(target: string): RepairCheck[] {
  const web: RepairCheck[] = ["backend-types", "backend-tests", "frontend-tests", "frontend-build"];
  const desktop: RepairCheck[] = ["desktop-types", "desktop-tests", "desktop-build"];
  const mobile: RepairCheck[] = ["mobile-types", "mobile-tests"];
  return target === "web" ? web : target === "desktop" ? desktop : target === "mobile" ? mobile : [...web, ...desktop, ...mobile];
}
