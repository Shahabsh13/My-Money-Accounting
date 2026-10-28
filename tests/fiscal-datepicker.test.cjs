const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, closeApp, buttonByText, wait, normalize } = require('./helpers/app-boot.cjs');

const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/src/scripts/067-inline.js'), 'utf8');
const field = (doc, name) => doc.querySelector(`[data-fiscal-date="${name}"]`);
const sheet = doc => doc.querySelector('#persian-datepicker-sheet');
const day = (doc, label) => [...sheet(doc).querySelectorAll('button')].find(button => normalize(button.textContent) === label);

async function chooseAndConfirm(doc, label) {
  const button = day(doc, label);
  assert.ok(button, `روز ${label} در تقویم پیدا شود`);
  button.click();
  await wait(80);
  assert.ok(sheet(doc), 'با انتخاب روز، تقویم تا تأیید باز می‌ماند');
  doc.querySelector('#datepicker-confirm-button').click();
  await wait(100);
  assert.equal(sheet(doc), null);
}

test('new fiscal-year start and end dates open separate single-date calendars and save independently', async () => {
  const dom = await bootApp({ storage: { 'hesabno:first_run_intro_done': '1', 'hesabno:first_run_profile_done': '1' } });
  try {
    const w = dom.window, d = w.document;
    buttonByText(d, 'بیشتر').click(); await wait(250);
    const entry = [...d.querySelectorAll('button')].find(button => normalize(button.textContent).includes('سال مالی و دوره‌های مالی'));
    assert.ok(entry); entry.click(); await wait(350);
    d.querySelector('button[title="تعریف دوره مالی جدید"]').click(); await wait(200);
    const start = field(d, 'manual-start'), end = field(d, 'manual-end');
    assert.ok(start && end); assert.equal(start.tagName, 'BUTTON'); assert.equal(end.tagName, 'BUTTON');
    assert.equal(start.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(end.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(start.getAttribute('aria-label'), 'تاریخ شروع دوره مالی');
    assert.equal(end.getAttribute('aria-label'), 'تاریخ پایان دوره مالی');
    const year = Number(normalize(start.textContent).split('/')[0]);
    const originalEnd = normalize(end.textContent);

    start.click(); await wait(150);
    assert.ok(sheet(d)); assert.equal(d.querySelectorAll('#persian-datepicker-sheet').length, 1);
    await chooseAndConfirm(d, '۲');
    assert.equal(normalize(field(d, 'manual-start').textContent), `${year}/01/02`);
    assert.equal(normalize(field(d, 'manual-end').textContent), originalEnd, 'انتخاب شروع نباید پایان را تغییر دهد');

    field(d, 'manual-end').click(); await wait(150);
    assert.ok(sheet(d));
    await chooseAndConfirm(d, '۲۰');
    assert.equal(normalize(field(d, 'manual-end').textContent), `${year}/12/20`);
    assert.equal(normalize(field(d, 'manual-start').textContent), `${year}/01/02`, 'انتخاب پایان نباید شروع را تغییر دهد');
    buttonByText(d, 'ثبت دوره مالی').click(); await wait(250);
    const saved = JSON.parse(w.localStorage.getItem('hesabno:fiscal_years')).find(row => row.title === `سال مالی ${year}`);
    assert.ok(saved); assert.equal(saved.startDate, `${year}/01/02`); assert.equal(saved.endDate, `${year}/12/20`);
  } finally { closeApp(dom); }
});

test('manual closing wizard maps both date fields to their independent picker state', () => {
  for (const name of ['wizard-start', 'wizard-end', 'manual-start', 'manual-end']) {
    assert.ok(source.includes(`data-fiscal-date":"${name}"`), `${name} field uses a calendar button`);
    assert.ok(source.includes(`setFiscalPicker("${name}")`), `${name} field opens its own calendar`);
  }
  assert.ok(source.includes('fiscalPicker==="wizard-start"?Q(fe):ae(fe)'), 'wizard calendar updates only its selected start or end value');
  assert.ok(source.includes('fiscalPicker==="manual-start"?Ee(fe):fiscalPicker==="manual-end"?Ce(fe)'), 'new-year calendar updates only its selected start or end value');
  assert.ok(source.includes('expandYearRange:!0'), 'calendar exposes a broad year range for future fiscal periods');
});
