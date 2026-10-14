import express from "express";
import request from "supertest";
import {describe, it, expect} from "vitest";
import {responseFreshness, noteRead} from "./response-freshness.js";

describe("authorized representation versions", () => {
  const setup = () => {
    const app = express(); let name = "Alice", granted = true;
    app.use(responseFreshness);
    app.get("/api/users", (req, res) => {
      if (!granted) {res.status(403).json({ok:false}); return;}
      res.locals.user = {userId:req.get("x-user") ?? "alice", permissions:["view"]};
      res.locals.bridgedSession = {targetId:req.get("x-target") ?? "one"};
      noteRead({resource:"users/system", state:"stale", collectedAt:100, source:"snapshot"});
      res.json({ok:true, data:[{id:1, name}], meta:{total:1}});
    });
    return {app, rename: () => {name="Changed join";}, revoke: () => {granted=false;}};
  };
  it("omits data only for the same authorized final result", async () => {
    const {app, rename, revoke} = setup();
    const first = await request(app).get("/api/users?page=1");
    expect(first.body.meta.freshness.state).toBe("stale");
    const version = first.body.meta.freshness.version;
    const second = await request(app).get(`/api/users?page=1&knownVersion=${version}`);
    expect(second.status).toBe(200); expect(second.body.data).toBeUndefined();
    expect(second.body.meta).toMatchObject({total:1, unchanged:true});
    rename();
    const changed = await request(app).get(`/api/users?page=1&knownVersion=${version}`);
    expect(changed.body.data[0].name).toBe("Changed join");
    expect(changed.body.meta.freshness.version).not.toBe(version);
    revoke(); expect((await request(app).get(`/api/users?knownVersion=${version}`)).status).toBe(403);
  });
  it("separates identity, target, query and legacy clients", async () => {
    const {app} = setup();
    const first = await request(app).get("/api/users");
    const version = first.body.meta.freshness.version;
    for (const [header, value] of [["x-user","bob"],["x-target","two"]]) {
      const response = await request(app).get(`/api/users?knownVersion=${version}`).set(header!,value!);
      expect(response.body.data).toHaveLength(1); expect(response.body.meta.freshness.version).not.toBe(version);
    }
    expect((await request(app).get(`/api/users?page=2&knownVersion=${version}`)).body.data).toHaveLength(1);
    expect((await request(app).get("/api/users")).body.data).toEqual(first.body.data);
  });
});
