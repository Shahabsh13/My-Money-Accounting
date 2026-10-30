const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const coreBundle = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'), 'utf8');
const perfGuard = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/001-hesabno-perf-guard.js'), 'utf8');
const navigationHistory = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/073-hesabno-navigation-history.js'), 'utf8');
const pageMotionStyles = fs.readFileSync(path.join(root, 'app/src/main/assets/src/styles/043-hesabno-page-open-close-motion.css'), 'utf8');
const pageMotionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/074-hesabno-page-open-close-motion-script.js'), 'utf8');
const sideMotionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/079-hesabno-full-page-side-motion-script.js'), 'utf8');
const homeMotionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/215-hesabno-tab-home-transition.js'), 'utf8');
const exitMotionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/216-hesabno-fullpage-exit.js'), 'utf8');
const onboardingMotionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/217-hesabno-first-run-profile.js'), 'utf8');
const motionStyles = fs.readFileSync(path.join(root, 'app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css'), 'utf8');
const externalScripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
  .map(match => ({ attributes: match[1], index: match.index }))
  .filter(script => /\bsrc\s*=/i.test(script.attributes));

test('global performance guard preserves native DOM and timer scheduling', () => {
  assert.doesNotMatch(perfGuard, /window\.MutationObserver\s*=/,
    'UI observers must run on the browser native schedule');
  assert.doesNotMatch(perfGuard, /window\.setInterval\s*=/,
    'global interval timing must not delay page enhancements');
  assert.doesNotMatch(perfGuard, /setTimeout\(flush,\s*80\)/,
    'DOM mutation batches must not be delayed by the performance guard');
});

test('hardware back returns primary tabs home but respects inner-page back first', () => {
  assert.ok(navigationHistory.includes('var detailBackButton = function ()'),
    'inner-page back button should be detected independently of the active tab');
  assert.ok(navigationHistory.indexOf('var back = detailBackButton();') < navigationHistory.indexOf('var nav = root.querySelector("nav.fixed");'),
    'inner-page state must be detected before reading the active primary tab');
  assert.ok(navigationHistory.includes('var detailBack = detailBackButton();'));
  assert.ok(navigationHistory.includes('button[aria-label^="بازگشت"]'),
    'descriptive page-header Back labels must be recognized when primary tabs are hidden');
  assert.ok(navigationHistory.includes('holdBackNavigation("");\n      detailBack.click();\n      return true;'),
    'Back inside a subpage should click that page’s own back button first');
  assert.match(navigationHistory, /activeLabel && activeLabel !== labels\.home && homeButton/,
    'Back on a primary non-dashboard tab should return to dashboard');
  assert.ok(navigationHistory.includes('homeButton.click()'));
  assert.match(navigationHistory, /if \(activeLabel === labels\.home\) \{[\s\S]*?stack\.length = 0[\s\S]*?return false;/,
    'Back on the dashboard should fall through to native exit confirmation');
});

test('page entry classes cannot animate content into position after render', () => {
  assert.match(pageMotionStyles, /main\.hesabno-page-open-up,[\s\S]*?animation: none !important/);
  assert.match(pageMotionStyles, /transform: none !important/);
  assert.match(pageMotionStyles, /opacity: 1 !important/);
});

test('page and onboarding motion avoid forced reflow and large exit clones', () => {
  for (const [name, script] of [['tab motion', pageMotionScript], ['detail page motion', sideMotionScript],
    ['home transition', homeMotionScript], ['onboarding motion', onboardingMotionScript]]) {
    assert.doesNotMatch(script, /offsetWidth|offsetHeight/, `${name} must not force synchronous layout to restart motion`);
  }
  assert.doesNotMatch(pageMotionScript, /addEventListener\(\"click\"|setTimeout\(/,
    'page motion must not intercept Back or delay route changes');
  assert.doesNotMatch(sideMotionScript, /setTimeout\(|hesabno-full-page-side-exit/,
    'detail-page Back preserves navigation behavior without an exit timer');
  assert.match(exitMotionScript, /cloneNode\(false\)/,
    'exit visuals copy only the overlay shell instead of cloning large report contents');
  assert.doesNotMatch(exitMotionScript, /querySelectorAll\('div\.fixed\.inset-0'\)/,
    'closing a page must not scan its entire removed subtree to find nested overlays');
  assert.doesNotMatch(pageMotionScript, /document\.addEventListener/,
    'route and form transitions do not intercept application click or submit behavior');
  assert.match(sideMotionScript, /main\.querySelector\("#field-amount-input"\)/,
    'transaction Back is left to the native app handler');
  assert.match(motionStyles, /prefers-reduced-motion: reduce/);
  assert.match(motionStyles, /--hesabno-motion-normal:\s*140ms/);
  assert.match(motionStyles, /article\.hesabno-focused-check-card \{ animation: none !important; \}/);
});

test('all page and form routes open and close without full-screen animation delays', () => {
  assert.match(motionStyles, /#root main\.hesabno-form-transition-exit-back[\s\S]*?animation: none !important/);
  assert.match(motionStyles, /#root \.hesabno-full-page-side-exit[\s\S]*?animation: none !important/);
  assert.doesNotMatch(pageMotionScript, /document\.addEventListener|setTimeout\(/,
    'the motion helper does not intercept form submit or Back behavior');
  assert.ok(pageMotionStyles.includes('prefers-reduced-motion: reduce'));
});

function srcOf(script) {
  const match = script.attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
  return match ? match[2] : '';
}

test('external application scripts do not block HTML parsing', () => {
  assert.ok(externalScripts.length >= 100, 'the application script inventory should be present');
  const blocking = externalScripts.filter(script =>
    !/\bdefer\b/i.test(script.attributes) && !/\basync\b/i.test(script.attributes)
  );
  assert.deepEqual(blocking.map(srcOf), [], 'external scripts in index.html must not block document parsing');
  assert.equal(externalScripts.filter(script => /\basync\b/i.test(script.attributes)).length, 0,
    'do not use async because scripts patch shared app behavior and require source order');
});

test('deferred scripts preserve the core and UI-fix execution order', () => {
  const sources = externalScripts.map(srcOf);
  const critical = [
    'src/scripts/000-default-accounts.js',
    'src/scripts/001-hesabno-perf-guard.js',
    'src/scripts/066-inline.js',
    'src/scripts/067-inline.js',
    'src/scripts/194-hesabno-loan-linked-transaction-actions.js',
    'src/scripts/214-hesabno-numeric-keyboard.js',
    'src/scripts/220-hesabno-stable-tab-geometry.js',
  ];
  const positions = critical.map(name => sources.findIndex(src => src.startsWith(name)));
  assert.ok(positions.every(index => index >= 0), 'all critical scripts should remain included');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b),
    'defer must retain the existing script order relied on by patches and UI fixes');
});

test('React app mounting waits for DOMContentLoaded after deferred patch scripts execute', () => {
  assert.match(coreBundle, /document\\.readyState==="loading"\\|\\|document\\.readyState==="interactive"\\?document\\.addEventListener\\("DOMContentLoaded",q4\\):q4\\(\\);/);
});

test('trial-balance report filters loan-linked transactions once per report, not once per account', () => {
  const start = coreBundle.indexOf('const balanceTransactions=re.end?t.filter');
  assert.notEqual(start, -1, 'trial-balance calculation exists');
  const end = coreBundle.indexOf('const J=s.filter', start);
  assert.notEqual(end, -1, 'trial-balance account loop has a bounded section');
  const calculation = coreBundle.slice(start, end);
  const loopStart = calculation.indexOf('s.forEach($e=>{');
  assert.notEqual(loopStart, -1, 'account balance loop exists');
  const setup = calculation.slice(0, loopStart);
  const loop = calculation.slice(loopStart);
  assert.ok(setup.includes('nonLoanTransactions=hasIncomeExpenseAccounts?K.filter(Te=>Te.loanId==null&&Te.installmentId==null):K'));
  assert.ok(setup.includes('nonLoanBalanceTransactions=hasIncomeExpenseAccounts?balanceTransactions.filter(Te=>Te.loanId==null&&Te.installmentId==null):balanceTransactions'));
  assert.equal(loop.includes('K.filter(Te=>Te.loanId==null'), false);
  assert.equal(loop.includes('balanceTransactions.filter(Te=>Te.loanId==null'), false);
});
