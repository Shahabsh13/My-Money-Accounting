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
 assert.ok(java.slice(start,start+800).includes('registerSmsReceiverIfPermitted();'));
});
test('SMS access handles READ_SMS and RECEIVE_SMS as independent grants',()=>{
 const readStart=java.indexOf('private boolean hasSmsReadPermission()');
 const receiveStart=java.indexOf('private boolean hasSmsReceivePermission()',readStart);
 const completeStart=java.indexOf('private boolean hasCompleteSmsPermission()',receiveStart);
 const registerStart=java.indexOf('private void registerSmsReceiverIfPermitted()',completeStart);
 assert.ok(java.slice(readStart,receiveStart).includes('Manifest.permission.READ_SMS'));
 assert.ok(java.slice(receiveStart,completeStart).includes('Manifest.permission.RECEIVE_SMS'));
 assert.ok(java.slice(completeStart,registerStart).includes('hasSmsReadPermission() && hasSmsReceivePermission()'));
 const requestStart=java.indexOf('public boolean requestSmsPermission()');
 const requestEnd=java.indexOf('public String readBankSmsInboxJson(',requestStart);
 const request=java.slice(requestStart,requestEnd);
 assert.ok(request.includes('if (!hasSmsReadPermission()) missingPermissions.add(Manifest.permission.READ_SMS);'));
 assert.ok(request.includes('if (!hasSmsReceivePermission()) missingPermissions.add(Manifest.permission.RECEIVE_SMS);'));
 assert.ok(request.includes('missingPermissions.toArray(new String[0])'));
 const resultStart=java.indexOf('} else if (requestCode == 1003)');
 const resultEnd=java.indexOf('} else if (requestCode == 1004)',resultStart);
 const result=java.slice(resultStart,resultEnd);
 assert.ok(result.includes('boolean granted = readGranted && receiveGranted;'));
 assert.ok(!result.includes('grantResults[0]'), 'a partial grant must not be treated as full SMS access');
 assert.ok(result.includes('if (readGranted)'));
 assert.ok(result.includes('else if (readGranted || receiveGranted)'));
 const inbox=java.slice(requestEnd,java.indexOf('public String getAppVersionName()',requestEnd));
 assert.ok(inbox.includes('requestPermissions(new String[]{Manifest.permission.READ_SMS}, 1003)'));
});
test('privileged WebView trusts only the packaged HTTPS entry point',()=>{
 assert.ok(java.includes('"/assets/index.html".equals(uri.getPath())'));
 assert.ok(java.includes('"https".equals(uri.getScheme())'));
 assert.ok(java.includes('uri.getUserInfo() == null'));
 assert.ok(!java.includes('|| "data".equals(scheme)'));
 const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
 assert.match(manifest,/<receiver\s+android:name="\.MainActivity\$InactivityReminderReceiver"\s+android:enabled="true"\s+android:exported="false"/);
});
test('auto-backup never reports a stale primary as a successfully written replacement',()=>{
 const start=java.indexOf('private boolean writeAutoBackupFile(');
 const end=java.indexOf('private String readAutoBackupFile(',start);
 const writer=java.slice(start,end);
 const copyStart=java.indexOf('private boolean copyFileSilently(');
 const copyEnd=java.indexOf('private boolean writeRollingBackup(',copyStart);
 const copy=java.slice(copyStart,copyEnd);
 const attachmentStart=java.indexOf('private boolean writeAttachmentFile(');
 const attachmentEnd=java.indexOf('private String readAttachmentFile(',attachmentStart);
 const attachmentWriter=java.slice(attachmentStart,attachmentEnd);
 assert.ok(writer.includes('if (!temp.renameTo(primary) && !copyFileSilently(temp, primary)) return false;'));
 assert.ok(writer.includes('primary.length() == bytes.length'));
 assert.ok(writer.includes('readUtf8FileIfValid(primary).equals(jsonPayload.trim())'));
 assert.ok(writer.includes('!previousPayload.equals(readUtf8FileIfValid(backup))'));
 assert.ok(writer.indexOf('!previousPayload.equals(readUtf8FileIfValid(backup))')<writer.indexOf('primary.delete()'));
 assert.ok(attachmentWriter.includes('if (!temp.renameTo(target) && !copyFileSilently(temp, target)) return false;'));
 assert.ok(attachmentWriter.includes('target.length() == bytes.length'));
 assert.ok(attachmentWriter.includes('readAttachmentFile(id).equals(dataUrl)'));
 assert.ok(copy.includes('private boolean copyFileSilently('));
 assert.ok(copy.includes('return dst.exists() && dst.length() == expectedLength;'));
});
test('CI sdkmanager discovery avoids SIGPIPE and license pipeline preserves sdkmanager failures',()=>{
 const workflow=fs.readFileSync('.github/workflows/build-debug-apk.yml','utf8');
 const discovery=workflow.slice(workflow.indexOf('SDKMANAGER='),workflow.indexOf('          test -n "$SDKMANAGER"'));
 assert.ok(discovery.includes('-type f -name sdkmanager -print -quit'));
 assert.ok(!discovery.includes('| head'));
 const block=workflow.slice(workflow.indexOf('          set +o pipefail'),workflow.indexOf('          set -o pipefail')+'          set -o pipefail'.length);
 assert.ok(block.includes('yes | "$SDKMANAGER" --licenses'));
 for(const status of [0,3]){
  const result=spawnSync('bash',['-e','-o','pipefail','-c',`sdk(){ head -n 1 >/dev/null; return ${status}; }; SDKMANAGER=sdk;\n${block}`]);
  assert.equal(result.status,status,result.stderr.toString());
 }
});


test('APK update uses fresh asset cache keys and increments the Android app version', () => {
 const index=fs.readFileSync('app/src/main/assets/index.html','utf8');
 const version=fs.readFileSync('version.properties','utf8');
 for(const asset of [
  'src/scripts/067-inline.js?v=2026102706',
  'src/scripts/142-hesabno-check-settlement-date.js?v=19',
  'src/scripts/144-hesabno-check-return-confirm.js?v=18',
  'src/scripts/214-hesabno-numeric-keyboard.js?v=2026102801'
 ]) assert.ok(index.includes(asset),`HTML must load the fresh asset URL: ${asset}`);
 assert.match(version,/^versionCode=14$/m);
 assert.match(version,/^versionName=1\.2\.2$/m);
});
