#!/usr/bin/env node
// Installed root-owned. Application scripts run only inside rootless Podman.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import net from "node:net";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const job = JSON.parse(input),
  project = job.projectId.replaceAll("-", "");
if (
  !/^[a-f0-9]{32}$/.test(project) ||
  process.getuid() === 0 ||
  job.home !== process.env.HOME
)
  throw new Error("invalid_runtime_identity");
const root = path.join(job.home, ".luxisoft", "deployments", project),
  quadlet = path.join(job.home, ".config", "containers", "systemd");
let logs = "",
  started = [],
  workers = [];
const clean = (value) => {
  let text = String(value);
  for (const secret of Object.values(job.variables ?? {}).filter(
    (v) => v.length >= 4,
  )) {
    text = text
      .split(secret)
      .join("[redacted]")
      .split(Buffer.from(secret).toString("base64"))
      .join("[redacted]");
  }
  return text
    .replace(
      /(password|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .slice(-24000);
};
async function secureDir(directory) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await fs.realpath(directory)) !== directory)
    throw new Error("runtime_path_symlink");
  return directory;
}
async function command(
  bin,
  args,
  { cwd = root, timeout = 120000, record = true, stdin } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      error = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    }, timeout);
    child.stdout.on("data", (body) => {
      output = (output + body.toString()).slice(-100000);
      if (record) logs = clean(logs + body.toString());
    });
    child.stderr.on("data", (body) => {
      error = (error + body.toString()).slice(-100000);
      if (record) logs = clean(logs + body.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`command_failed:${path.basename(bin)}:${code}`));
    });
    child.stdin.end(stdin);
  });
}
async function json(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
const quote = (value) => JSON.stringify(String(value)).replace(/%/g, "%%");
async function startContainer(
  unit,
  image,
  {
    port,
    environment = {},
    network,
    volumes = [],
    memory = 512,
    commandArgs,
    resource = false,
    deferred = false,
  } = {},
) {
  await secureDir(quadlet);
  const lines = [
    "[Unit]",
    "Description=Luxisoft isolated deployment",
    "StartLimitBurst=3",
    "StartLimitIntervalSec=60",
    "[Container]",
    `Image=${image}`,
    "Pull=never",
    `ContainerName=${unit}`,
    "DropCapability=all",
    "NoNewPrivileges=true",
    `Network=${network ?? "slirp4netns:allow_host_loopback=false"}`,
    "ReadOnly=false",
    "Tmpfs=/tmp:rw,size=128m",
    "Tmpfs=/run:rw,size=32m",
    `PodmanArgs=--memory=${memory}m --cpus=1 --pids-limit=128`,
  ];
  if (await fs.stat(path.join(root, "retired")).catch(() => null))
    throw new Error("deployment_retired");
  if (resource)
    for (const capability of ["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE"])
      lines.push("AddCapability=" + capability);
  const hostPort = port
    ? await new Promise((resolve, reject) => {
        const listener = net.createServer();
        listener.on("error", reject);
        listener.listen(0, "127.0.0.1", () => {
          const bound = listener.address().port;
          listener.close(() => resolve(bound));
        });
      })
    : null;
  if (port) lines.push(`PublishPort=127.0.0.1:${hostPort}:${port}`);
  for (const [key, value] of Object.entries(environment))
    lines.push(`Environment=${quote(key + "=" + value)}`);
  for (const [volume, mount] of volumes)
    lines.push(`Volume=${volume}:${mount}`);
  if (commandArgs) lines.push(`Exec=${commandArgs.map(quote).join(" ")}`);
  lines.push(
    "[Service]",
    "Restart=on-failure",
    "RestartSec=3",
    "TimeoutStartSec=90",
    "TimeoutStopSec=20",
  );
  if (!deferred) lines.push("[Install]", "WantedBy=default.target");
  await fs.writeFile(
    path.join(quadlet, unit + ".container"),
    lines.join("\n") + "\n",
    { mode: 0o600 },
  );
  await command("/usr/bin/systemctl", ["--user", "daemon-reload"], {
    record: false,
  });
  started.push(unit);
  if (deferred) {
    workers.push(unit);
    return null;
  }
  await command("/usr/bin/systemctl", ["--user", "start", unit + ".service"], {
    record: false,
    timeout: 120000,
  });
  if (!port) return null;
  const published = await command(
    "/usr/bin/podman",
    ["port", unit, String(port) + "/tcp"],
    { record: false },
  );
  const match = published.match(/^127\.0\.0\.1:(\d+)$/);
  if (!match || Number(match[1]) !== hostPort)
    throw new Error("runtime_port_not_loopback");
  return Number(match[1]);
}
async function healthy(port, healthPath) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = await new Promise((resolve) => {
      const req = http.get(
        { host: "127.0.0.1", port, path: healthPath, timeout: 3000 },
        (response) => {
          response.resume();
          resolve(response.statusCode >= 200 && response.statusCode < 500);
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("runtime_health_failed");
}
async function stopUnit(unit) {
  if (!/^luxi-[a-f0-9-]+-[a-z0-9-]+$/.test(unit) || !unit.includes(project))
    throw new Error("invalid_owned_unit");
  await command("/usr/bin/systemctl", ["--user", "stop", unit + ".service"], {
    record: false,
  }).catch(() => {});
  await fs.unlink(path.join(quadlet, unit + ".container")).catch(() => {});
}
try {
  await secureDir(root);
  await secureDir(path.join(root, "jobs"));
  if (job.operation) {
    const activeFile = path.join(root, "active.json"),
      pendingFile = path.join(root, "pending.json"),
      active = await json(activeFile, { units: [] });
    if (job.operation === "activate") {
      const current = await json(
        path.join(root, "jobs", job.requestId + ".json"),
        null,
      );
      if (!current || current.environment !== "production")
        throw new Error("publication_missing");
      const pending = await json(pendingFile, null);
      if (
        pending?.requestId === job.requestId ||
        active.requestId === job.requestId
      ) {
        process.stdout.write(JSON.stringify({ ok: true }));
        process.exit(0);
      }
      const stopped = [];
      try {
        for (const unit of active.workers ?? []) {
          await command(
            "/usr/bin/systemctl",
            ["--user", "stop", unit + ".service"],
            { record: false },
          );
          stopped.push(unit);
        }
        for (const unit of current.workers ?? []) {
          const file = path.join(quadlet, unit + ".container"),
            definition = await fs.readFile(file, "utf8");
          if (!definition.includes("[Install]"))
            await fs.appendFile(file, "[Install]\nWantedBy=default.target\n");
          await command("/usr/bin/systemctl", ["--user", "daemon-reload"], {
            record: false,
          });
          await command(
            "/usr/bin/systemctl",
            ["--user", "start", unit + ".service"],
            { record: false },
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const state = await command(
            "/usr/bin/podman",
            ["inspect", "--format", "{{.State.Running}}", unit],
            { record: false },
          );
          if (state !== "true") throw new Error("worker_not_running");
        }
      } catch (error) {
        for (const unit of current.workers ?? [])
          await command(
            "/usr/bin/systemctl",
            ["--user", "stop", unit + ".service"],
            { record: false },
          ).catch(() => {});
        for (const unit of stopped)
          await command(
            "/usr/bin/systemctl",
            ["--user", "start", unit + ".service"],
            { record: false },
          ).catch(() => {});
        throw error;
      }
      // Keep the previous HTTP services until the platform commits its route.
      await fs.writeFile(
        pendingFile,
        JSON.stringify({ ...current, requestId: job.requestId }),
        { mode: 0o600 },
      );
    } else if (job.operation === "cleanup") {
      const pending = await json(pendingFile, null);
      if (active.requestId !== job.requestId) {
        if (pending?.requestId !== job.requestId)
          throw new Error("publication_not_activated");
        for (const unit of active.units ?? [])
          if (!pending.units.includes(unit)) await stopUnit(unit);
        await fs.writeFile(activeFile, JSON.stringify(pending), {
          mode: 0o600,
        });
      }
      await fs.unlink(pendingFile).catch(() => {});
    } else if (job.operation === "resume") {
      await fs.unlink(path.join(root, "retired")).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    } else if (job.operation === "retire") {
      await fs.writeFile(path.join(root, "retired"), "retired", {
        mode: 0o600,
      });
      for (const filename of await fs.readdir(quadlet))
        if (
          filename.startsWith("luxi-" + project + "-") &&
          filename.endsWith(".container")
        )
          await stopUnit(filename.slice(0, -10));
      await fs.writeFile(activeFile, JSON.stringify({ units: [] }), {
        mode: 0o600,
      });
    }
    process.stdout.write(JSON.stringify({ ok: true }));
    process.exit(0);
  }
  const evictedVersionIds = [];
  if (job.environment === "preview") {
    for (const filename of await fs.readdir(path.join(root, "jobs"))) {
      if (!filename.endsWith(".json") || filename === job.requestId + ".json")
        continue;
      const previous = await json(path.join(root, "jobs", filename), null);
      if (previous?.environment === "preview") {
        for (const unit of previous.units ?? []) await stopUnit(unit);
        if (previous.result?.versionId)
          evictedVersionIds.push(previous.result.versionId);
        await fs.unlink(path.join(root, "jobs", filename));
      }
    }
  }
  const environment =
      job.environment === "production" ? "production" : "preview",
    versionRoot = await secureDir(path.join(root, "versions", job.versionId)),
    workspace = path.join(versionRoot, "source");
  const archive = Buffer.from(job.archive, "base64");
  if (
    createHash("sha256").update(archive).digest("hex") !==
    job.snapshot.sourceDigest
  )
    throw new Error("source_digest_mismatch");
  await secureDir(workspace);
  // Python's stdlib extracts only regular files beneath the owned workspace.
  const extract = `import io,os,stat,sys,zipfile\nroot=sys.argv[1]; total=0\nwith zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:\n if len(z.infolist())>20000: raise Exception('too_many_files')\n for f in z.infolist():\n  if f.is_dir(): continue\n  p=f.filename\n  if p.startswith('/') or '\\\\' in p or any(x in ('','..','.') for x in p.split('/')) or stat.S_ISLNK(f.external_attr>>16): raise Exception('unsafe_archive')\n  total+=f.file_size\n  if total>134217728 or f.file_size>16777216: raise Exception('archive_too_large')\n  destination=os.path.join(root,p); os.makedirs(os.path.dirname(destination),exist_ok=True)\n  if os.path.realpath(destination)!=destination: raise Exception('unsafe_archive_path')\n  with open(destination,'wb') as o: o.write(z.read(f))\n  os.chmod(destination,0o755 if f.external_attr>>16&0o111 else 0o644)\n`;
  await command("/usr/bin/python3", ["-I", "-c", extract, workspace], {
    stdin: archive,
    record: false,
  });
  const disk = Number(
    await command("/usr/bin/du", ["-sm", "--exclude=.local/share/containers/storage/volumes", job.home], {
      cwd: job.home,
      record: false,
    }).then((output) => output.split(/\s/)[0]),
  );
  if (disk > job.limits.diskMb) throw new Error("disk_quota_exceeded");
  const space = await fs.statfs(root);
  if (space.bavail * space.bsize < 2 * 1024 ** 3)
    throw new Error("runtime_disk_capacity");
  const manifest = job.snapshot.manifest,
    images = await json(path.join(versionRoot, "images.json"), {}),
    components = [],
    network = `luxi-${project}-${environment}`,
    resourceEnv = {};
  await command("/usr/bin/podman", ["network", "exists", network], {
    record: false,
  }).catch(() =>
    command("/usr/bin/podman", ["network", "create", network], {
      record: false,
    }),
  );
  if (manifest.resources.length > job.limits.maxDatabases)
    throw new Error("database_quota_exceeded");
  // Reserve against configured limits, so a candidate/build cannot exhaust the
  // account slice and kill the current production services.
  const running = (
    await command("/usr/bin/podman", ["ps", "--format", "{{.Names}}"], {
      record: false,
    })
  )
    .split("\n")
    .filter(Boolean);
  const newResources = manifest.resources.filter(
    (resource) =>
      resource.engine !== "sqlite" &&
      !running.includes(`luxi-${project}-${environment}-data-${resource.name}`),
  ).length;
  if (
    (running.length + newResources + manifest.components.length) * 512 > 3584 ||
    (running.length + newResources) * 512 + 1536 > 3584
  )
    throw new Error("runtime_memory_capacity");
  const available = Number(
    (await fs.readFile("/proc/meminfo", "utf8")).match(
      /MemAvailable:\s+(\d+)/,
    )?.[1] ?? 0,
  );
  if (available < 2 * 1024 * 1024) throw new Error("runtime_host_capacity");
  // Resources have stable names and volumes per environment. A new application
  // version never replaces the database or copies production data to previews.
  for (const resource of manifest.resources) {
    if (resource.engine === "sqlite") {
      resourceEnv.SQLITE_URL = "file:/app/data/app.db";
      resourceEnv.DATABASE_URL ??= resourceEnv.SQLITE_URL;
      continue;
    }
    const key = resource.name.toUpperCase().replaceAll("-", "_"),
      unit = `luxi-${project}-${environment}-data-${resource.name}`,
      dataFile = path.join(root, environment + "-" + resource.name + ".json");
    let credentials = await json(dataFile, null);
    if (!credentials) {
      credentials = { password: randomBytes(24).toString("hex") };
      await fs.writeFile(dataFile, JSON.stringify(credentials), {
        mode: 0o600,
      });
    }
    const catalog = {
      postgres: {
        image: "docker.io/library/postgres:17-alpine",
        port: 5432,
        environment: {
          POSTGRES_USER: "app",
          POSTGRES_DB: "app",
          POSTGRES_PASSWORD: credentials.password,
        },
        mount: "/var/lib/postgresql/data",
        url: `postgresql://app:${credentials.password}@${unit}:5432/app`,
      },
      mysql: {
        image: "docker.io/library/mysql:8.4",
        port: 3306,
        environment: {
          MYSQL_USER: "app",
          MYSQL_DATABASE: "app",
          MYSQL_PASSWORD: credentials.password,
          MYSQL_RANDOM_ROOT_PASSWORD: "yes",
        },
        mount: "/var/lib/mysql",
        url: `mysql://app:${credentials.password}@${unit}:3306/app`,
      },
      redis: {
        image: "docker.io/library/redis:7-alpine",
        environment: {},
        mount: "/data",
        url: `redis://${unit}:6379/0`,
      },
      mongo: {
        image: "docker.io/library/mongo:8",
        environment: {
          MONGO_INITDB_ROOT_USERNAME: "app",
          MONGO_INITDB_ROOT_PASSWORD: credentials.password,
        },
        mount: "/data/db",
        url: `mongodb://app:${credentials.password}@${unit}:27017/app?authSource=admin`,
      },
    };
    const recipe = catalog[resource.engine];
    if (!recipe) throw new Error("unknown_resource");
    await command("/usr/bin/podman", ["pull", recipe.image], {
      timeout: 180000,
      record: false,
    });
    const image = await command(
      "/usr/bin/podman",
      ["image", "inspect", "--format", "{{.Id}}", recipe.image],
      { record: false },
    );
    await startContainer(unit, image, {
      environment: recipe.environment,
      network,
      volumes: [[unit, recipe.mount]],
      memory: 512,
      resource: true,
    });
    resourceEnv[key + "_URL"] = recipe.url;
    if (
      ["postgres", "mysql", "mongo"].includes(resource.engine) &&
      !resourceEnv.DATABASE_URL
    )
      resourceEnv.DATABASE_URL = recipe.url;
    if (resource.engine === "redis" && !resourceEnv.REDIS_URL)
      resourceEnv.REDIS_URL = recipe.url;
    started = started.filter((name) => name !== unit);
  }
  for (const part of manifest.components) {
    const context = path.join(
      workspace,
      part.context === "." ? "" : part.context,
    );
    if ((await fs.realpath(context)) !== context)
      throw new Error("unsafe_build_context");
    for (const [name, body] of Object.entries(part.generatedFiles ?? {})) {
      const file = path.join(context, name);
      await secureDir(path.dirname(file));
      await fs.writeFile(file, body, { mode: 0o600 });
    }
    let image = images[part.name];
    if (!image) {
      if (environment === "production")
        throw new Error("immutable_image_missing");
      let dockerfile = part.dockerfile;
      if (part.surface === "mobile" && part.stack === "expo") {
        dockerfile = ".luxisoft-runtime/Containerfile";
        await secureDir(path.join(context, ".luxisoft-runtime"));
        await fs.writeFile(
          path.join(context, ".luxisoft-runtime/Caddyfile"),
          `:${part.port} {\n root * /srv/public\n try_files {path} /index.html\n file_server\n}\n`,
        );
        await fs.writeFile(
          path.join(context, dockerfile),
          "FROM docker.io/library/node:22-bookworm-slim AS build\nWORKDIR /app\nCOPY . .\nRUN " +
            ((await fs
              .stat(path.join(context, "package-lock.json"))
              .catch(() => null))
              ? "npm ci"
              : "npm install") +
            "\nRUN npx expo export --platform web --output-dir dist\nFROM docker.io/library/caddy:2-alpine\nCOPY --from=build /app/dist/ /srv/public/\nCOPY --from=build /app/.luxisoft-runtime/Caddyfile /etc/caddy/Caddyfile\n",
        );
      } else if (part.recipe) {
        dockerfile = ".luxisoft-runtime/Containerfile";
        await secureDir(path.join(context, ".luxisoft-runtime"));
        const publicKeys = Object.keys(job.variables ?? {}).filter((key) =>
          /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|EXPO_PUBLIC_)[A-Z0-9_]+$/.test(key),
        );
        const recipe = part.recipe.replace(
          /^(FROM .+)$/gm,
          (line) =>
            line +
            "\n" +
            publicKeys
              .map((key) => "ARG " + key + "\nENV " + key + "=$" + key)
              .join("\n"),
        );
        await fs.writeFile(path.join(context, dockerfile), recipe, {
          mode: 0o600,
        });
      }
      if (!dockerfile) throw new Error("dockerfile_required");
      const tag = `localhost/luxisoft-${project}-${job.versionId}-${part.name}`;
      const publicArgs = Object.entries(job.variables ?? {})
        .filter(([key]) =>
          /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|EXPO_PUBLIC_)[A-Z0-9_]+$/.test(key),
        )
        .flatMap(([key, value]) => ["--build-arg", key + "=" + value]);
      await command(
        "/usr/bin/podman",
        [
          "build",
          "--network=slirp4netns:allow_host_loopback=false",
          "--memory=1536m",
          "--cpu-quota=100000",
          "--cpu-period=100000",
          ...publicArgs,
          "--file",
          path.join(context, dockerfile),
          "--tag",
          tag,
          context,
        ],
        { timeout: 1500000 },
      );
      image = await command(
        "/usr/bin/podman",
        ["image", "inspect", "--format", "{{.Id}}", tag],
        { record: false },
      );
      if (!/^sha256:[a-f0-9]{64}$/.test(image))
        throw new Error("image_digest_invalid");
      images[part.name] = image;
      await fs.writeFile(
        path.join(versionRoot, "images.json"),
        JSON.stringify(images),
        { mode: 0o600 },
      );
    }
    const unit = `luxi-${project}-${environment}-${job.requestId.slice(0, 8)}-${part.name}`,
      env = {
        ...job.variables,
        ...resourceEnv,
        PORT: String(part.port),
        HOST: "0.0.0.0",
        LUXISOFT_ENVIRONMENT: environment,
      };
    const surface = part.surface === "mobile" ? "http" : part.surface;
    if (surface === "static") {
      // Export the immutable image's public tree. No web process or port runs
      // on BACKEND for a static component.
      const exportDir = await secureDir(path.join(versionRoot, "static-export-" + part.name + "-" + randomBytes(5).toString("hex")));
      const container = `luxi-export-${project}-${part.name}-${randomBytes(5).toString("hex")}`;
      const archiveFile = path.join(versionRoot, `static-${part.name}-${job.requestId}.zip`);
      const pack = `import hashlib,os,stat,sys,zipfile\nroot,out=sys.argv[1:]\nfiles=[];total=0\nfor base,dirs,names in os.walk(root,followlinks=False):\n for name in dirs+names:\n  p=os.path.join(base,name); s=os.lstat(p)\n  if stat.S_ISLNK(s.st_mode): raise Exception('static_symlink')\n  if not (stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode)): raise Exception('static_special_file')\n for name in names:\n  p=os.path.join(base,name); rel=os.path.relpath(p,root).replace(os.sep,'/')\n  if any(part in ('','.','..') for part in rel.split('/')): raise Exception('static_bad_path')\n  size=os.lstat(p).st_size;total+=size\n  if size>16777216 or total>134217728: raise Exception('static_too_large')\n  files.append((p,rel))\n  if len(files)>10000: raise Exception('static_too_many_files')\nif 'index.html' not in [rel for _,rel in files]: raise Exception('static_index_missing')\nwith zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:\n for p,rel in sorted(files,key=lambda x:x[1]): z.write(p,rel)\nif os.path.getsize(out)>33554432: raise Exception('static_archive_too_large')\nprint(hashlib.sha256(open(out,'rb').read()).hexdigest()+' '+str(os.path.getsize(out)))\n`;
      let summary;
      try {
        await command("/usr/bin/podman", ["create", "--name", container, image], { record: false });
        try {
          await command("/usr/bin/podman", ["cp", `${container}:/srv/public/.`, exportDir], { record: false, timeout: 120000 });
        } finally {
          await command("/usr/bin/podman", ["rm", "--force", container], { record: false }).catch(() => {});
        }
        summary = await command("/usr/bin/python3", ["-I", "-c", pack, exportDir, archiveFile], { record: false, timeout: 120000 });
      } catch (error) {
        await fs.unlink(archiveFile).catch(() => {});
        throw error;
      } finally {
        await fs.rm(exportDir, { recursive: true, force: true });
      }
      const [sha256, bytes] = summary.split(" ");
      components.push({ name: part.name, port: null, image, surface, staticArchive: { sha256, bytes: Number(bytes) } });
      continue;
    }
    const port = await startContainer(unit, image, {
      port: surface === "http" ? part.port : undefined,
      environment: env,
      network,
      volumes: part.volumes.map((v) => [
        `luxi-${project}-${environment}-${v.name}`,
        v.path,
      ]),
      deferred: surface === "worker" && environment === "production",
    });
    if (port) await healthy(port, part.healthPath);
    else if (!workers.includes(unit)) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const state = await command(
        "/usr/bin/podman",
        ["inspect", "--format", "{{.State.Running}}", unit],
        { record: false },
      );
      if (state !== "true") throw new Error("worker_not_running");
    }
    components.push({ name: part.name, port, image, surface });
  }
  const result = {
    components,
    environment,
    versionId: job.versionId,
    evictedVersionIds,
  };
  await fs.writeFile(
    path.join(root, "jobs", job.requestId + ".json"),
    JSON.stringify({ environment, units: started, workers, result }),
    { mode: 0o600 },
  );
  process.stdout.write(JSON.stringify({ ok: true, result, logs: clean(logs) }));
} catch (error) {
  for (const unit of started) await stopUnit(unit).catch(() => {});
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: String(error.message).slice(0, 500),
      logs: clean(logs),
    }),
  );
  process.exitCode = 1;
}
