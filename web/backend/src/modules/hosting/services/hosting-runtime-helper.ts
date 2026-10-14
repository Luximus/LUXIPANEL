/** Installed root-owned, never in a customer's writable home. The sudoers
 * grant accepts NO arguments; managed execution is available only to root. */
export const HOSTING_RUNTIME_HELPER = String.raw`#!/usr/bin/python3
import os, sys, json, pwd, grp, stat, base64, subprocess, shlex, fcntl, datetime

CONFIG = "__CONFIG__"
def fail(message):
    print(message, file=sys.stderr)
    sys.exit(126)
if os.geteuid() != 0:
    fail("Hosting supervisor requires its restricted sudo entry")
service = len(sys.argv) == 4 and sys.argv[1] == "--service"
managed = len(sys.argv) == 4 and sys.argv[1] in ("--managed", "--service")
if managed:
    # The no-argument sudoers entry can never authorize this branch.
    user = sys.argv[2]
    command = base64.b64decode(sys.argv[3], validate=True).decode("utf-8")
else:
    if len(sys.argv) != 1: fail("Unexpected arguments")
    uid = int(os.environ.get("SUDO_UID", "0"))
    if uid < 1000: fail("Invalid hosting identity")
    user = pwd.getpwuid(uid).pw_name
    command = ""
if not user or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789_-" for c in user):
    fail("Invalid hosting identity")
filename = CONFIG + "/hosting/runtime/" + user + ".json"
fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW)
st = os.fstat(fd)
if st.st_uid != 0 or st.st_mode & 0o022: fail("Unsafe runtime policy")
with os.fdopen(fd) as f: policy = json.load(f)
identity = pwd.getpwnam(user)
if identity.pw_uid != policy["uid"] or identity.pw_uid < 1000:
    fail("Hosting identity changed")
if policy["state"] != "ready": fail("Hosting runtime is pending")
marker_fd = os.open(CONFIG + "/hosting/runtime/account-" + str(policy["accountId"]) + ".json", os.O_RDONLY | os.O_NOFOLLOW)
marker_stat = os.fstat(marker_fd)
if marker_stat.st_uid != 0 or marker_stat.st_mode & 0o022: fail("Unsafe account policy")
with os.fdopen(marker_fd) as f: marker = json.load(f)
if marker.get("state") != "ready" or marker.get("revision") != policy["revision"]: fail("Hosting runtime is pending")
if marker.get("status") != "active" or user not in marker.get("users", []): fail("Hosting account is inactive")
if marker.get("expiresAt") and datetime.datetime.fromisoformat(marker["expiresAt"].replace("Z", "+00:00")).timestamp() <= datetime.datetime.now(datetime.timezone.utc).timestamp(): fail("Hosting account expired")
with open("/etc/shadow") as shadow_file:
    shadow = next((line.rstrip("\n").split(":") for line in shadow_file if line.startswith(user + ":")), None)
if not shadow or shadow[1].startswith(("!", "*")): fail("Hosting user is disabled")
if len(shadow) > 7 and shadow[7] and int(shadow[7]) <= int(datetime.datetime.now(datetime.timezone.utc).timestamp() / 86400): fail("Hosting user expired")
group = grp.getgrnam(policy["group"])
if identity.pw_gid != group.gr_gid and user not in group.gr_mem: fail("Hosting group membership changed")
if service and command not in policy.get("serviceCommands", []): fail("Hosting service command is not configured")
if not managed and policy["security"]["shell"] != "jailed": fail("Shell access is disabled")
root = policy["jailRoot"]
st = os.stat(root, follow_symlinks=False)
if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022: fail("Unsafe jail root")
home = policy["homeRoot"]
descriptors = []
home_fd = os.open(home, os.O_PATH | os.O_DIRECTORY | os.O_NOFOLLOW)
descriptors.append(home_fd)
def owned_path(p):
    if any(c.isspace() for c in p) or ":" in p: fail("Unsupported mount path")
    normalized = os.path.normpath(p)
    if normalized != home and not normalized.startswith(home + "/"): fail("Path outside hosting account")
    current = os.dup(home_fd)
    descriptors.append(current)
    for name in normalized[len(home):].split("/"):
        if not name: continue
        child = os.open(name, os.O_PATH | os.O_NOFOLLOW, dir_fd=current)
        info = os.fstat(child)
        if stat.S_ISLNK(info.st_mode) or info.st_dev != os.fstat(home_fd).st_dev: fail("Unsafe hosting mount path")
        descriptors.append(child)
        current = child
    # Bind the held inode, never re-resolve a customer-controlled source path.
    return "/proc/" + str(os.getpid()) + "/fd/" + str(current)

unit = "lxp-hosting-" + str(policy["accountId"]) + "-php" if service else "lxp-hosting-" + str(policy["accountId"]) + "-" + str(identity.pw_uid) + "-" + str(os.getpid())
args = ["/usr/bin/systemd-run", "--quiet", "--collect", "--unit=" + unit]
args.extend(["--no-block"] if service else ["--wait", "--pipe" if managed else "--pty"])
properties = ["Slice=" + policy["slice"], "User=" + user, "Group=" + policy["group"],
    "RootDirectory=" + root, "WorkingDirectory=" + policy["workingDirectory"],
    "Environment=HOME=" + identity.pw_dir, "NoNewPrivileges=yes", "PrivateTmp=yes",
    "ProtectSystem=strict", "ProtectControlGroups=yes", "ProtectKernelTunables=yes",
    "ProtectKernelModules=yes", "ProtectProc=invisible", "ProcSubset=pid",
    "RestrictSUIDSGID=yes", "RestrictNamespaces=yes", "CapabilityBoundingSet=",
    "KillMode=control-group", "UMask=0077", "MemorySwapMax=0"]
lifetimes = []
if managed and not service: lifetimes.append(policy["security"]["commandTimeoutSeconds"])
if not managed: lifetimes.append(policy["security"].get("sessionHours", 24) * 3600)
if marker.get("expiresAt"):
    lifetimes.append(datetime.datetime.fromisoformat(marker["expiresAt"].replace("Z", "+00:00")).timestamp() - datetime.datetime.now(datetime.timezone.utc).timestamp())
if lifetimes:
    properties.extend(["RuntimeMaxSec=" + str(max(0.001, min(lifetimes))), "TimeoutStopSec=1"])
if service:
    p = home + "/.luxipanel/run"
    properties.extend(["BindPaths=" + owned_path(p) + ":" + p, "ReadWritePaths=" + p])
for p in policy["paths"]["allowPaths"]:
    real = owned_path(p)
    if ":" in real or " " in real: fail("Unsupported mount path")
    properties.extend(["BindPaths=" + real + ":" + p, "ReadWritePaths=" + p])
for p in policy["paths"]["readOnlyPaths"]:
    real = owned_path(p)
    properties.extend(["BindReadOnlyPaths=" + real + ":" + p, "ReadOnlyPaths=" + p])
for p in policy["paths"]["denyPaths"]:
    owned_path(p)
    properties.append("InaccessiblePaths=" + p)
for p in properties: args.extend(["--property", p])
args.extend(["--", "/usr/bin/python3", "-I", "/usr/lib/luxipanel/hosting-exec", "managed", command] if managed else ["--", "/usr/bin/python3", "-I", "/usr/lib/luxipanel/hosting-exec", "interactive"])
# A root-owned flock slot stays held for the full terminal lifetime. Limits
# are account-wide and shared by both panel PTYs and direct SSH logins.
slot = None
if not managed:
    for index in range(policy["security"]["maxTerminalSessions"]):
        candidate = os.open(CONFIG + "/hosting/runtime/slot-" + str(policy["accountId"]) + "-" + str(index), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        if os.fstat(candidate).st_uid != 0: fail("Unsafe terminal slot")
        try:
            fcntl.flock(candidate, fcntl.LOCK_EX | fcntl.LOCK_NB)
            slot = candidate
            break
        except BlockingIOError: os.close(candidate)
    if slot is None: fail("Account terminal session limit reached")
# systemd places the process in the account slice BEFORE executing any code.
try: sys.exit(subprocess.call(args))
finally:
    if slot is not None: os.close(slot)
    for fd in descriptors: os.close(fd)
`;

/** Mandatory seccomp layer prevents a customer from clearing project quota
 * inheritance through chattr/ioctl, including code they compile themselves. */
export const HOSTING_EXEC_HELPER = String.raw`#!/usr/bin/python3
import os, sys, ctypes, errno
class Compare(ctypes.Structure):
    _fields_ = [("arg", ctypes.c_uint), ("op", ctypes.c_int), ("a", ctypes.c_uint64), ("b", ctypes.c_uint64)]
lib = ctypes.CDLL("libseccomp.so.2", use_errno=True)
lib.seccomp_init.argtypes = [ctypes.c_uint32]
lib.seccomp_init.restype = ctypes.c_void_p
lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
lib.seccomp_rule_add_array.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint, ctypes.POINTER(Compare)]
lib.seccomp_load.argtypes = [ctypes.c_void_p]
lib.seccomp_release.argtypes = [ctypes.c_void_p]
context = lib.seccomp_init(0x7fff0000)
if not context: sys.exit(126)
try:
    number = lib.seccomp_syscall_resolve_name(b"ioctl")
    if number < 0: sys.exit(126)
    for request in [0x40086602, 0x40046602, 0x401c5820]:
        compare = Compare(1, 4, request, 0)
        if lib.seccomp_rule_add_array(context, 0x00050000 | errno.EPERM, number, 1, ctypes.byref(compare)) < 0: sys.exit(126)
    if lib.seccomp_load(context) < 0: sys.exit(126)
finally: lib.seccomp_release(context)
if len(sys.argv) == 3 and sys.argv[1] == "managed": os.execv("/bin/bash", ["bash", "-c", sys.argv[2]])
if len(sys.argv) == 2 and sys.argv[1] == "interactive": os.execv("/bin/bash", ["bash", "--noprofile", "--norc"])
sys.exit(126)
`;
