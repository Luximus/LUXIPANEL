"""Task-local official Android tooling. Never changes the production app or SDK."""
from pathlib import Path
import urllib.request, xml.etree.ElementTree as ET, hashlib, zipfile, json, os

ROOT = Path(__file__).resolve().parents[1] / 'out' / 'seedance25' / 'android'
SDK = ROOT / 'sdk'
ROOT.mkdir(parents=True, exist_ok=True)

def archive_for(index, name):
    tree = ET.fromstring(urllib.request.urlopen(index, timeout=30).read())
    candidates = []
    for package in tree.findall('remotePackage'):
        if package.get('path') != name: continue
        channel = package.find('channelRef')
        if channel is not None and channel.get('ref') != 'channel-0': continue
        for archive in package.findall('./archives/archive'):
            if archive.findtext('host-os') not in [None, 'linux']: continue
            base = index.rsplit('/', 1)[0] + '/'
            candidates.append((base + archive.findtext('complete/url'), archive.findtext('complete/checksum')))
    if not candidates: raise RuntimeError('Official package was not found: ' + name)
    return candidates[0]

def download(url, file, sha1=None):
    if not file.exists():
        temp = file.with_suffix(file.suffix + '.partial')
        request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'})
        with urllib.request.urlopen(request, timeout=60) as response, temp.open('wb') as output:
            while data := response.read(4 * 1024 * 1024): output.write(data)
        temp.replace(file)
    if sha1:
        digest = hashlib.sha1()
        with file.open('rb') as stream:
            while data := stream.read(4 * 1024 * 1024): digest.update(data)
        if digest.hexdigest() != sha1: raise RuntimeError('Official archive checksum failed')

for name, index, destination, marker in [
    ('platform-tools','https://dl.google.com/android/repository/repository2-1.xml',SDK,SDK/'platform-tools'/'adb'),
    ('emulator','https://dl.google.com/android/repository/repository2-1.xml',SDK,SDK/'emulator'/'emulator'),
    ('system-images;android-30;google_apis;x86_64','https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-1.xml',SDK/'system-images'/'android-30'/'google_apis',SDK/'system-images'/'android-30'/'google_apis'/'x86_64'/'system.img'),
]:
    if marker.exists(): continue
    url, checksum = archive_for(index,name)
    print(json.dumps({'stage':'downloading','package':name}),flush=True)
    file = ROOT / url.rsplit('/',1)[1]
    download(url,file,checksum)
    destination.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(file) as archive:
        for member in archive.infolist():
            target = (destination/member.filename).resolve()
            if not target.is_relative_to(destination.resolve()): raise RuntimeError('Unsafe archive member')
            archive.extract(member,destination)
            mode=member.external_attr>>16
            if mode and target.is_file(): target.chmod(mode & 0o777)
    file.unlink()
    print(json.dumps({'stage':'installed','package':name}),flush=True)

apk=ROOT/'luxipanel-preview.apk'
download('https://expo.dev/artifacts/eas/B3J2rY68_SGTFR8fsU-c7xUCu5YEc1y69vu0VOvPqUk.apk',apk)
with zipfile.ZipFile(apk) as archive:
    abis=sorted(set(n.split('/')[1] for n in archive.namelist() if n.startswith('lib/') and n.count('/')>=2))
if 'x86_64' not in abis: raise RuntimeError('Existing preview APK does not contain the emulator ABI')
avds=ROOT/'avd';avds.mkdir(exist_ok=True)
avd=avds/'LuxipanelVideo.avd';avd.mkdir(exist_ok=True)
(avds/'LuxipanelVideo.ini').write_text('avd.ini.encoding=UTF-8\npath='+str(avd)+'\ntarget=android-30\n')
(avd/'config.ini').write_text('\n'.join([
    'AvdId=LuxipanelVideo','avd.ini.displayname=LUXIPANEL Video','avd.ini.encoding=UTF-8','abi.type=x86_64',
    'hw.cpu.arch=x86_64','hw.cpu.ncore=2','hw.ramSize=1024','hw.lcd.width=540','hw.lcd.height=960','hw.lcd.density=240',
    'hw.gpu.enabled=yes','hw.gpu.mode=swiftshader_indirect','hw.keyboard=yes','hw.audioInput=no','hw.camera.back=none','hw.camera.front=none',
    'disk.dataPartition.size=1024M','image.sysdir.1='+str(SDK/'system-images'/'android-30'/'google_apis'/'x86_64')+'/',
    'tag.id=google_apis','tag.display=Google APIs','PlayStore.enabled=false','showDeviceFrame=no',
])+'\n')
print(json.dumps({'stage':'ready','sdk':str(SDK),'avd_home':str(avds),'apk':str(apk),'abis':abis}),flush=True)
