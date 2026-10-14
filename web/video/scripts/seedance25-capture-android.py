"""Record the existing Android APK against the isolated video demo API."""
from pathlib import Path
import subprocess, json, time, xml.etree.ElementTree as ET, sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'out'/'seedance25'
ANDROID=OUT/'android'
ADB=ANDROID/'sdk'/'platform-tools'/'adb'
CAPTURES=OUT/'captures';CAPTURES.mkdir(exist_ok=True)

def adb(*args, binary=False, timeout=60):
    return subprocess.check_output([str(ADB),'-s','emulator-5570',*args],timeout=timeout,stderr=subprocess.STDOUT, text=not binary)

def screenshot(name):
    path=CAPTURES/(name+'.png');path.write_bytes(adb('exec-out','screencap','-p',binary=True));return path

deadline=time.monotonic()+600
while time.monotonic()<deadline:
    try:
        if adb('shell','getprop','sys.boot_completed',timeout=15).strip()=='1':break
    except subprocess.SubprocessError:pass
    print(json.dumps({'stage':'waiting_for_android_boot'}),flush=True);time.sleep(10)
else: raise RuntimeError('Android software emulator did not finish booting within ten minutes')

adb('shell','settings','put','global','device_provisioned','1')
adb('shell','settings','put','secure','user_setup_complete','1')
adb('shell','settings','put','system','screen_off_timeout','2147483647')
print(json.dumps({'stage':'installing_existing_preview_apk'}),flush=True)
adb('install','-r',str(ANDROID/'luxipanel-preview.apk'),timeout=180)
adb('shell','am','start','-n','com.luxisoft.lxpanel/.MainActivity')
time.sleep(12)
initial=screenshot('android-native-initial')
adb('shell','uiautomator','dump','/sdcard/video-ui.xml')
xml=adb('shell','cat','/sdcard/video-ui.xml')
(OUT/'android-ui.xml').write_text(xml)
print(json.dumps({'stage':'native_app_open','screenshot':str(initial),'uiText':[n.get('text') for n in ET.fromstring(xml).iter('node') if n.get('text')]}),flush=True)
(CAPTURES/'android-capture-status.json').write_text(json.dumps({'source':'Actual existing Android preview APK in software emulator; not a website or WebView','physicalDevice':False,'apk':str(ANDROID/'luxipanel-preview.apk'),'fixtureApi':'http://10.0.2.2:48691','initialScreenshot':str(initial),'workflowCapturePending':True},indent=2))
