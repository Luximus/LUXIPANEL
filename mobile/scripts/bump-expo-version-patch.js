const fs = require("fs");
const path = require("path");

const appJsonPath = path.resolve(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const currentVersion = appJson?.expo?.version;

if (typeof currentVersion !== "string") {
  throw new Error("expo.version is missing from app.json");
}

const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) {
  throw new Error(
    `expo.version must use major.minor.patch format. Current value: ${currentVersion}`,
  );
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]) + 1;
const nextVersion = `${major}.${minor}.${patch}`;

appJson.expo.version = nextVersion;
fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);

console.log(`expo.version bumped: ${currentVersion} -> ${nextVersion}`);
