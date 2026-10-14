import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import request from "supertest";

const auth = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../modules/auth/middlewares/session.middleware.js", async importOriginal => ({
  ...await importOriginal<typeof import("../../modules/auth/middlewares/session.middleware.js")>(),
  requireAuth: (req: any, res: any, next: any) => {
    auth.calls++;
    if (req.headers.authorization === "Bearer scope-test") {
      res.locals.user = { kind: "admin", username: "scope-test", userId: 1 };
      next();
      return;
    }
    res.status(401).json({ code: "AUTH_ERROR" });
  },
}));
vi.mock("../../modules/chat/controllers/chat.controller.js", async importOriginal => {
  const original = await importOriginal<typeof import("../../modules/chat/controllers/chat.controller.js")>();
  return { ...original, chatController: {
    ...original.chatController,
    stream: (_req: unknown, res: any) => res.json({ reached: "chat" }),
  } };
});

import { mailRouter } from "../../modules/mail/routes/mail.routes.js";
import { usersRouter } from "../../modules/users/routes/users.routes.js";
import { dashboardRouter } from "../../modules/dashboard/routes/dashboard.routes.js";
import { sudoRouter } from "../../modules/sudo/routes/sudo.routes.js";
import { notificationsRouter } from "../../modules/notifications/routes/notifications.routes.js";
import { chatRouter } from "../../modules/chat/routes/chat.routes.js";
import { jobsRouter } from "../../modules/jobs/routes/jobs.routes.js";

// Match the root-mounted routers' production order. The session boundary is
// stubbed; route matching, fallthrough and every registered route are real.
const routers: Array<[string, Router]> = [
  ["mail", mailRouter], ["users", usersRouter], ["dashboard", dashboardRouter],
  ["sudo", sudoRouter], ["notifications", notificationsRouter],
  ["chat", chatRouter], ["jobs", jobsRouter],
];
beforeEach(() => { auth.calls = 0; });

describe("root-mounted router authentication", () => {
  for (const [name, router] of routers) {
    it(`${name}: every declared endpoint still requires a session`, async () => {
      const app = express().use(router);
      const routes = router.stack.filter((layer: any) => layer.route);
      expect(routes.length).toBeGreaterThan(0);
      for (const layer of routes) {
        const route = layer.route!;
        const path = route.path.replace(/:[A-Za-z0-9_]+/g, "example");
        for (const method of Object.keys(route.methods)) {
          const previous = auth.calls;
          const response = await (request(app) as any)[method](path);
          expect(response.status, `${method} ${path}`).toBe(401);
          expect(response.body.code).toBe("AUTH_ERROR");
          expect(auth.calls - previous).toBe(1);
        }
      }
    });
  }

  it.each([
    "/api/mail/server-settings", "/api/accounts", "/api/preferences/ui",
    "/api/users", "/api/roles", "/api/dashboard/overview",
    "/api/sudo/status", "/api/notifications/stream", "/api/chat/stream", "/api/jobs/example",
  ])("%s reaches its own session gate once", async path => {
    const app = express();
    for (const [, router] of routers) app.use(router);
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
    expect(auth.calls).toBe(1);
  });

  it.each(["/api/unrelated", "/api/mailbox", "/api/users-extra", "/api/chatty"])(
    "%s falls through without any session or target lookup", async path => {
      const app = express();
      for (const [, router] of routers) app.use(router);
      app.get(path, (_req, res) => res.json({ reached: true }));
      expect((await request(app).get(path)).body).toEqual({ reached: true });
      expect(auth.calls).toBe(0);
    },
  );

  it("authenticated chat reaches its controller with just one session resolution", async () => {
    const app = express();
    for (const [, router] of routers) app.use(router);
    const response = await request(app).get("/api/chat/stream").set("Authorization", "Bearer scope-test");
    expect(response.body).toEqual({ reached: "chat" });
    expect(auth.calls).toBe(1);
  });
});
