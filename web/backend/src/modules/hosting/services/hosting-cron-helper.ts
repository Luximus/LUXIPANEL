export const HOSTING_JOB_HELPER = String.raw`#!/usr/bin/python3 -I
import os, sys, pwd, subprocess, base64
if os.geteuid() != 0 or len(sys.argv) != 1: sys.exit(126)
uid = int(os.environ.get("SUDO_UID", "0"))
if uid < 1000: sys.exit(126)
user = pwd.getpwuid(uid).pw_name
command = sys.stdin.buffer.read(65537)
if len(command) > 65536: sys.exit(126)
base64.b64decode(command, validate=True).decode("utf-8")
sys.exit(subprocess.call(["/usr/lib/luxipanel/hosting-shell", "--managed", user, command.decode("ascii")]))
`;

export const HOSTING_CRON_HELPER = String.raw`#!/usr/bin/python3 -I
import sys, os, pwd, re, subprocess, datetime, pathlib, time, base64
os.umask(0o077)
if len(sys.argv) < 3 or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", sys.argv[1]) or (len(sys.argv) > 3 and sys.argv[3] != "#"): sys.exit(126)
uid = os.getuid()
if uid < 1000: sys.exit(126)
base64.b64decode(sys.argv[2], validate=True).decode("utf-8")
home = pwd.getpwuid(uid).pw_dir
directory = os.open(home, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
home_device = os.fstat(directory).st_dev
for name in [".local", "state", "luxipanel", "cron", "logs", sys.argv[1]]:
    try: os.mkdir(name, 0o700, dir_fd=directory)
    except FileExistsError: pass
    child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
    if os.fstat(child).st_dev != home_device: sys.exit(126)
    os.close(directory)
    directory = child
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
start = time.monotonic()
with os.fdopen(os.open(stamp + ".log", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory), "w") as log:
    print("=== START " + stamp + " jobId=" + sys.argv[1] + " ===", file=log, flush=True)
    status = subprocess.run(["/usr/bin/sudo", "-n", "--", "/usr/lib/luxipanel/hosting-job"], input=sys.argv[2].encode("ascii"), stdout=log, stderr=log).returncode
    print("=== END " + stamp + " exit=" + str(status) + " durationMs=" + str(int((time.monotonic()-start)*1000)) + " ===", file=log)
os.close(directory)
sys.exit(status)
`;
