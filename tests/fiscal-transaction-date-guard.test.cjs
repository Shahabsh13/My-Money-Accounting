const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { bootApp, closeApp, buttonByText, wait, normalize } = require('./helpers/app-boot.cjs');

const source = fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js', 'utf8');
const helperStart = source.indexOf('__hesabnoFiscalDateKey=');
const helperEnd = source.indexOf('Vq=({open:', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'fiscal date helpers must remain before the transaction form');
const helperDeclaration = source.slice(helperStart, helperEnd).trim().replace(/,$/, '');

function createGuard({ today = '1406/01/10', fiscalYear = { id: 'fy-1406', status: 'active', endDate: '1406/12/29' } } = {}) {
  const context = {
    St: value => String(value ?? '').replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/-/g, '/'),
    Rt: () => today,
    Iq: () => fiscalYear,
    te: value => String(value),
  };
  vm.runInNewContext(`const ${helperDeclaration}; globalThis.guard = {
    dateKey: __hesabnoFiscalDateKey,
    activeEnd: __hesabnoActiveFiscalEndDate,
    dateLimit: __hesabnoTransactionDateLimit,
    afterEnd: __hesabnoTransactionDateAfterFiscalEnd,
    allowed: __hesabnoTransactionDateAllowed,
    message: __hesabnoFiscalDateLimitMessage
  };`, context);
  return context.guard;
}

test('active fiscal end blocks only dates after it and treats Persian digits consistently', () => {
  const guard = createGuard();
  assert.equal(guard.dateKey('۱۴۰۶/۱۲/۲۹'), '1406/12/29');
  assert.equal(guard.activeEnd(), '1406/12/29');
  assert.equal(guard.afterEnd('1406/12/29'), false, 'the last day itself is valid');
  assert.equal(guard.afterEnd('۱۴۰۷/۰۱/۰۱'), true);
  assert.equal(guard.allowed('1406/12/28'), true);
  assert.equal(guard.allowed('1407/01/01'), false);
  assert.match(guard.message(), /1406\/12\/29/);
});

test('when today is beyond the active period, new transactions default to its final allowed date', () => {
  const guard = createGuard({ today: '1407/02/05', fiscalYear: { id: 'fy-1406', status: 'active', endDate: '1406/12/29' } });
  assert.equal(guard.dateLimit(), '1406/12/29');
  assert.equal(guard.afterEnd('1407/01/01'), true);
  assert.equal(guard.afterEnd('1406/12/29'), false);
});

test('future dates inside a still-open fiscal year remain capped at today, and an existing out-of-period date can be preserved', () => {
  const guard = createGuard({ today: '1406/05/10', fiscalYear: { id: 'fy-1406', status: 'active', endDate: '1406/12/29' } });
  assert.equal(guard.dateLimit(), '1406/05/10');
  assert.equal(guard.afterEnd('1406/12/29'), false);
  assert.equal(guard.allowed('1407/01/01', '1407/01/01'), true, 'editing other fields preserves an already stored legacy date');
  assert.equal(guard.allowed('1407/01/02', '1407/01/01'), false, 'changing that record to a different out-of-period date is rejected');
});

test('missing or closed fiscal periods do not invent an end-date restriction', () => {
  assert.equal(createGuard({ fiscalYear: null }).activeEnd(), '');
  assert.equal(createGuard({ fiscalYear: { isClosed: true, endDate: '1406/12/29' } }).afterEnd('1407/01/01'), false);
  assert.equal(createGuard({ fiscalYear: { status: 'closed', endDate: '1406/12/29' } }).afterEnd('1407/01/01'), false);
});

test('transaction form and central add/edit paths both enforce the fiscal end date', () => {
  assert.match(source, /maxDate:transactionDateLimit/);
  assert.match(source, /transactionDateOutOfRange&&Ve\.push\(\{field:"date",message:__hesabnoFiscalDateLimitMessage\(\),refId:"tx-date-input"\}\)/);
  assert.match(source, /gt&&transactionDateOutOfRange&&e\.jsx\("p",\{[^}]*role:"alert",children:__hesabnoFiscalDateLimitMessage\(\)\}\)/);
  assert.match(source, /Fe=L=>\{if\(!__hesabnoTransactionDateAllowed\(L&&L\.date\)\)/);
  assert.match(source, /Y=L=>\{const original=ce\.find\(Ue=>Ue\.id===L\.id\);if\(!__hesabnoTransactionDateAllowed\(L&&L\.date,original&&original\.date\)\)/);
  assert.match(source, /isExistingTransaction:Boolean\(V&&ce\.some\(L=>L\.id===V\.id\)\)/);
  assert.match(source, /else if\(l\(ea\)===!1\)return/);
  assert.match(source, /else if\(l\(Xs\)===!1\)return/);
  assert.match(source, /if\(m\(ea\)===!1\)return/);
  assert.match(source, /if\(m\(Xs\)===!1\)return/);
});

test('an expired active year defaults new entry to its end and disables later days in the calendar', { timeout: 180000 }, async t => {
  const dom = await bootApp({ storage: {
    'hesabno:first_run_intro_done': '1',
    'hesabno:first_run_profile_done': '1',
    'hesabno:fiscal_years': JSON.stringify([{ id: 'fy-expired', title: 'سال مالی ۱۴۰۵', startDate: '1405/01/01', endDate: '1405/01/02', isClosed: false, status: 'active' }]),
    'hesabno:active_fiscal_year_id': 'fy-expired',
  } });
  t.after(() => closeApp(dom));
  const document = dom.window.document;
  buttonByText(document, 'پرداخت').click();
  await wait(700);
  const dateField = document.querySelector('#tx-date-input-container');
  assert.ok(dateField);
  assert.match(normalize(dateField.textContent), /۲ فروردین ۱۴۰۵/, 'تاریخ پیش‌فرض سند به آخرین روز دورهٔ منقضی‌شده محدود است');
  const keypad = document.getElementById('hesabno-amount-keyboard');
  if (keypad && !keypad.hidden) keypad.querySelector('[data-hkap-action="close"]')?.click();
  await wait(100);
  dateField.click();
  await wait(300);
  const calendar = document.querySelector('#persian-datepicker-sheet');
  assert.ok(calendar, 'تقویم انتخاب تاریخ باز شود');
  const days = [...calendar.querySelectorAll('.grid-cols-7.gap-y-2 button')];
  const lastAllowedDay = days.find(button => normalize(button.textContent) === '۲');
  const firstForbiddenDay = days.find(button => normalize(button.textContent) === '۳');
  assert.ok(lastAllowedDay); assert.equal(lastAllowedDay.disabled, false);
  assert.ok(firstForbiddenDay); assert.equal(firstForbiddenDay.disabled, true, 'روز بعد از پایان سال مالی قابل انتخاب نباشد');
});
