import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { withKvReadCache } from "../../../shared/kv-store/read-cache.js";
import { hasActionPermission, canUseModule } from "../../../shared/auth/role-permissions.js";
import { moduleRegistryService } from "./module-registry.service.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { usersService } from "../../users/services/users.service.js";
import { toUiPreferences } from "../../users/models/preferences.model.js";
import { assistantConfigRepository } from "../../ai-assistant/repositories/assistant-config.repository.js";
import { redactAssistantConfig } from "../../ai-assistant/models/assistant-config.types.js";
import { layoutAssetPath } from "../controllers/layout.controller.js";

/** Request-local memo: no cross-user cached permission decisions or secrets. */
export function loadUiBootstrap(user: SessionUser, executor: Executor) {
  return withKvReadCache(async () => {
    const [rows, preferences, enabled, order, display] = await Promise.all([
      settingsRepository.getByCategory("layout", executor),
      usersService.getPreferences(user.userId).then(toUiPreferences).catch(() => ({theme:"system",language:null})),
      moduleRegistryService.getEnabledMap(), moduleRegistryService.getOrder(), moduleRegistryService.getDisplayMap(),
    ]);
    const layout = Object.fromEntries(rows.map(row => [row.key, row.value]));
    if (executor.target.id !== "local") {
      for (const key of ["layout_logo", "layout_favicon", "layout_logo_primary", "layout_logo_sidebar", "layout_logo_login", "layout_logo_footer"]) {
        if (layout[key] && layoutAssetPath(layout[key])) layout[key] = `/api/ui/layout/asset?${new URLSearchParams({key,target:executor.target.id})}`;
      }
    }
    const defs = new Map(moduleRegistryService.getAll().map(m => [m.id,m]));
    const modules = order.flatMap(id => {
      const m = defs.get(id);
      return m && enabled[id] ? [{id,name:m.name,enabled:true,development:false,
        showInSidebar:display[id]?.showInSidebar ?? false,showFloatingButton:display[id]?.showFloatingButton ?? false,
        supportsFloatingButton:!!m.supportsFloatingButton}] : [];
    });
    const canChat = enabled.assistant && canUseModule(user,"assistant") && hasActionPermission(user,"assistant.read");
    const assistant = canChat ? await assistantConfigRepository.load(executor).then(redactAssistantConfig).catch(() => null) : null;
    return {version:1,user,targetId:executor.target.id,layout,preferences,modules,assistant};
  });
}
