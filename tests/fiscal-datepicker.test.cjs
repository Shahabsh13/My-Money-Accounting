const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, closeApp, buttonByText, wait, normalize } = require('./helpers/app-boot.cjs');

const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/src/scripts/067-inline.js'), 'utf8');
const rangeButton = (doc, name) => doc.querySelector(`[data-fiscal-date-range="${name}"]`);
const rangePicker = doc => doc.querySelector('[data-hesabno-range-picker="true"]');
const rangeDay = (doc, label) => [...rangePicker(doc).querySelectorAll('button')]
  .find(button => normalize(button.textContent) === label);

async function pickRangeEndpoint(doc, label) {
  const button = rangeDay(doc, label);
  assert.ok(button, `روز ${label} در تقویم بازه پیدا شود`);
  button.click();
  await wait(100);
}

test('new fiscal period and fiscal year use one from-to range calendar', { timeout: 180000 }, async () => {
  const dom = await bootApp({ storage: { 'hesabno:first_run_intro_done': '1', 'hesabno:first_run_profile_done': '1' } });
  try {
    const w = dom.window, d = w.document;
    buttonByText(d, 'بیشتر').click(); await wait(250);
    const entry = [...d.querySelectorAll('button')].find(button => normalize(button.textContent).includes('سال مالی و دوره‌های مالی'));
    assert.ok(entry); entry.click(); await wait(350);
    d.querySelector('button[title="تعریف دوره مالی جدید"]').click(); await wait(200);

    const range = rangeButton(d, 'manual');
    assert.ok(range, 'فرم دوره مالی یک دکمهٔ بازهٔ شروع تا پایان دارد');
    assert.equal(range.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(range.getAttribute('aria-label'), 'بازهٔ دوره مالی از تا');
    assert.equal(d.querySelector('[data-fiscal-date="manual-start"]'), null);
    assert.equal(d.querySelector('[data-fiscal-date="manual-end"]'), null);
    const initial = normalize(range.textContent).match(/(\d{4})\/(\d{2})\/\d{2}/);
    assert.ok(initial, 'تاریخ شروع بازه روی دکمه نمایش داده شود');
    const [, year, month] = initial;

    range.click(); await wait(180);
    assert.ok(rangePicker(d), 'با لمس بازه، تقویم دو مرحله‌ای از-تا باز شود');
    assert.match(normalize(rangePicker(d).textContent), /از تاریخ/);
    await pickRangeEndpoint(d, '۲');
    assert.ok(rangePicker(d), 'پس از انتخاب تاریخ شروع، تقویم برای انتخاب پایان باز بماند');
    assert.match(normalize(rangePicker(d).textContent), /تا تاریخ/);
    await pickRangeEndpoint(d, '۲۰');
    assert.equal(rangePicker(d), null, 'با انتخاب تاریخ پایان، بازه ثبت و تقویم بسته شود');

    const updatedRange = normalize(rangeButton(d, 'manual').textContent);
    assert.ok(updatedRange.includes(`${year}/${month}/02`));
    assert.ok(updatedRange.includes(`${year}/${month}/20`));
    buttonByText(d, 'ثبت دوره مالی').click(); await wait(250);
    const saved = JSON.parse(w.localStorage.getItem('hesabno:fiscal_years')).find(row => row.title === `سال مالی ${year}`);
    assert.ok(saved); assert.equal(saved.startDate, `${year}/${month}/02`); assert.equal(saved.endDate, `${year}/${month}/20`);
  } finally { closeApp(dom); }
});

test('wizard-created fiscal year also maps its start and end to a single range picker', () => {
  assert.ok(source.includes('data-fiscal-date-range":"wizard"'), 'ویزارد سال مالی جدید یک دکمهٔ بازه دارد');
  assert.ok(source.includes('setFiscalPicker("wizard-range")'));
  assert.ok(source.includes('startDate:fiscalPicker==="manual-range"?ke:K'));
  assert.ok(source.includes('endDate:fiscalPicker==="manual-range"?xe:he'));
  assert.ok(source.includes('onConfirm:(fe,qe)=>{fiscalPicker==="manual-range"?(Ee(fe),Ce(qe)):(Q(fe),ae(qe)),setFiscalPicker(null)}'),
    'انتخاب بازه، شروع و پایان همان فرم را با هم ذخیره می‌کند');
  assert.equal(source.includes('data-fiscal-date":"wizard-start"'), false);
  assert.equal(source.includes('data-fiscal-date":"wizard-end"'), false);
  assert.equal(source.includes('data-fiscal-date":"manual-start"'), false);
  assert.equal(source.includes('data-fiscal-date":"manual-end"'), false);
});
