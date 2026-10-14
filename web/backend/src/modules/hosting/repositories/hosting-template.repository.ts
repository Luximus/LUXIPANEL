import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { HostingTemplate } from "../models/hosting-template.model.js";
export const hostingTemplateStore = makeKvStore<HostingTemplate>({ module: "hosting", collection: "templates", idStrategy: "uuid" });
