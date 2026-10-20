/* Static Android guards are NOT a substitute for an Android build/device test. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
test('native notification routing is gated by page readiness, not a fixed startup delay',()=>{
 const block=java.slice(java.indexOf('private void handleNotificationDashboardIntent('),java.indexOf('private void launchCameraIntent('));
 assert.ok(block.includes('pendingOpenNotificationId = intent.getStringExtra'));
 assert.ok(block.includes('if (!webPageReady || webView == null || pendingOpenTarget == null) return;'));
 assert.ok(block.includes('handleNativeClick('));
 assert.ok(!block.includes('readNative('));
 assert.ok(java.includes('webPageReady = isTrustedAppUrl(Uri.parse(url));'));
});
test('SMS receiver is registered after permission grant, not just after resume',()=>{
 const start=java.indexOf('} else if (requestCode == 1003)');
 assert.ok(java.slice(start,start+500).includes('registerSmsReceiverIfPermitted();'));
});
test('privileged WebView trusts only the packaged HTTPS entry point',()=>{
 assert.ok(java.includes('"/assets/index.html".equals(uri.getPath())'));
 assert.ok(java.includes('"https".equals(uri.getScheme())'));
 assert.ok(java.includes('uri.getUserInfo() == null'));
 assert.ok(!java.includes('|| "data".equals(scheme)'));
 const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
 assert.match(manifest,/<receiver\s+android:name="\.MainActivity\$InactivityReminderReceiver"\s+android:enabled="true"\s+android:exported="false"/);
});
test('CI license pipeline ignores yes SIGPIPE but preserves sdkmanager failures',()=>{
 const workflow=fs.readFileSync('.github/workflows/build-debug-apk.yml','utf8');
 const block=workflow.slice(workflow.indexOf('          set +o pipefail'),workflow.indexOf('          set -o pipefail')+'          set -o pipefail'.length);
 assert.ok(block.includes('yes | "$SDKMANAGER" --licenses'));
 for(const status of [0,3]){
  const result=spawnSync('bash',['-e','-o','pipefail','-c',`sdk(){ head -n 1 >/dev/null; return ${status}; }; SDKMANAGER=sdk;\n${block}`]);
  assert.equal(result.status,status,result.stderr.toString());
 }
});
