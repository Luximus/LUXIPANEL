/** Set native project IDs via directory descriptors, never following customer
 * symlinks. Both ext4 and XFS expose the same FS_IOC_FS*XATTR ABI. */
export const PROJECT_QUOTA_SETUP = String.raw`import os,sys,stat,fcntl,struct
root, project = sys.argv[1], int(sys.argv[2])
rootfd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
device=os.fstat(rootfd).st_dev
def apply(fd):
    info=os.fstat(fd)
    if stat.S_ISREG(info.st_mode) and info.st_nlink>1: raise RuntimeError("Hard links require administrator quota review")
    if info.st_dev!=device: raise RuntimeError("Nested filesystem outside account quota")
    attr=bytearray(28)
    fcntl.ioctl(fd,0x801c581f,attr,True)
    values=list(struct.unpack("=IIIII8s",attr))
    values[3]=project
    if stat.S_ISDIR(info.st_mode): values[0]|=0x200
    fcntl.ioctl(fd,0x401c5820,struct.pack("=IIIII8s",*values))
    if stat.S_ISDIR(info.st_mode):
        for name in os.listdir(fd):
            try: child=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
            except OSError:
                if stat.S_ISLNK(os.stat(name,dir_fd=fd,follow_symlinks=False).st_mode): continue
                raise
            try:
                kind=os.fstat(child).st_mode
                if stat.S_ISDIR(kind) or stat.S_ISREG(kind): apply(child)
            finally: os.close(child)
apply(rootfd)
os.close(rootfd)
`;
