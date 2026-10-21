# فیلتر پیشرفته: حذف «رویداد» و هم‌اندازه‌کردن انتخابگرها

> گزارش کاربر با اسکرین‌شات فیلتر پیشرفته: «توی فیلتر پیشرفته فونت اون دو تا بخشی که خط
> کشیدن سایزش اصلا به برنامه‌مون نمی‌خوره»، «ما اصلا رویداد نداریم پس حذفش کن»،
> «ببین بازم اگه جایی توی قسمت‌های نمونه یا انتخاب کردن فونتش این‌جوریه درستش کن».

## ۱) «انتخاب رویداد» حذف شد

فیلتر پیشرفته یک ردیف «انتخاب رویداد :» با فیلد `عنوان رویداد یا برچسب...` داشت که **هیچ
استفاده‌ای در منطق فیلتر نداشت** (`event` در وضعیت فیلتر ذخیره می‌شد ولی هیچ‌جا خوانده
نمی‌شد). برنامه مفهوم «رویداد» ندارد؛ پس ردیف از خود بستهٔ ۰۶۷ حذف شد (نه پنهان‌سازی
زماینی):

- کل بلوک ۵۶۳ کاراکتری JSX ردیف از `067-inline.js` برداشته شد.
- `رویداد` دیگر هیچ جای رابط نیست (جست‌وجوی رشته در بسته: صفر مورد).

## ۲) علت درشتی فونت انتخابگرها

قاعدهٔ سراسری در `010-core-base.css`:

```css
input,select,textarea{font-size:16px!important}
```

این قاعده (که برای جلوگیری از زوم خودکار مرورگر روی فیلدها گذاشته شده) اندازهٔ متن
`<select>` را روی ۱۶px قفل می‌کرد. برچسب‌های فیلتر ۱۲px‌اند و فیلدهای متنی فیلتر هم با
قاعدهٔ موجود در لایهٔ ۲۳۵ روی ۱۲px نگه داشته می‌شوند:

```css
html body .hesabno-advanced-filter input { … font-size: 12px !important; }
```

ولی `select` و `textarea` از آن قاعده جا مانده بودند؛ نتیجه: انتخابگر «همه پروژه‌ها» و
«همه اعضا» ۱۶px کنار برچسب ۱۲px — همان چیزی که در اسکرین‌شات دیده می‌شود.

نکتهٔ فنی: چون قاعدهٔ ۱۶px **بیرون از `@layer`** نوشته شده و ابزارهای Tailwind داخل
`@layer utilities` هستند، حتی حذف `!important` هم کلاس `text-xs` را غالب نمی‌کند
(اعلان‌های بدون لایه بر لایه‌ها اولویت دارند). پس اصلاح واقعی باید یک قاعدهٔ
`!important` با دقت کافی باشد، نه تغییر آن قاعدهٔ پایه.

## ۳) اصلاح در لایهٔ ۲۳۵

```css
/* فیلتر پیشرفته: input + select + textarea همه ۱۲px */
html body .hesabno-advanced-filter input,
html body .hesabno-advanced-filter select,
html body .hesabno-advanced-filter textarea {
  min-width: 0 !important; max-width: 100%; box-sizing: border-box;
  font-size: 12px !important; line-height: 1.6 !important;
}
html body .hesabno-advanced-filter select {
  padding: 6px 10px !important; border-radius: 10px !important;
  min-height: 32px; text-align: right; direction: rtl;
}

/* همهٔ فیلدهای فرم اندازهٔ کلاس خودشان را بگیرند، نه ۱۶px سراسری */
html body select { font-size: 13px !important; }
html body input.text-xs, html body textarea.text-xs, html body select.text-xs { font-size: 12px !important; }
html body input.text-sm, html body textarea.text-sm, html body select.text-sm { font-size: 14px !important; }
html body input.text-\[10px\], html body textarea.text-\[10px\], html body select.text-\[10px\] { font-size: 10px !important; }
html body input.text-\[11px\], html body textarea.text-\[11px\], html body select.text-\[11px\] { font-size: 11px !important; }
html body input.text-base, html body textarea.text-base, html body select.text-base { font-size: 16px !important; }
```

قاعدهٔ پایهٔ ۱۶px در `010-core-base.css` دست‌نخورده ماند (برای فیلدهای بدون کلاس اندازه و
جلوگیری از زوم مرورگر): هر فیلدی که کلاس اندازه ندارد همان ۱۶px می‌ماند و `select` بدون
کلاس ۱۳px. حالا هر فیلد/انتخابگری که خودش `text-xs`/`text-sm`/`text-[10px]`/`text-[11px]`
دارد همان اندازه را می‌گیرد؛ نمونه‌ها: کادر «جستجو»ی صفحهٔ سرفصل حساب‌ها، عضو خانواده و
پروژه در فرم تراکنش، دورهٔ تکرار و ماه شمسی در بودجه‌بندی، انتخابگرهای گزارش‌ها، حساب
مقصد سود/زیان و فاصلهٔ اقساط.

پیمایش خودکار صفحات (خانه، فرم پرداخت، تراکنش‌ها، گزارش‌ها، سرفصل حساب‌ها، فرم وام،
پیام‌بانک): هیچ فیلدی دیگر اندازهٔ متفاوت از کلاسش ندارد (۰ مورد).

## ۴) قفل آزمون

`tests/advanced-filter-typography.test.cjs` — ۴ آزمون:

1. اسکن ایستا: رشتهٔ «رویداد» و «عنوان رویداد یا برچسب» در بستهٔ ۰۶۷ نیست.
2. اسکن CSS: قاعدهٔ ۱۲px فیلتر شامل `select` و `textarea` شده و قاعده‌های اندازهٔ
   `select` در لایهٔ ۲۳۵ ثبت‌اند؛ قاعدهٔ پایهٔ ۱۶px هم دست‌نخورده است.
3. jsdom روی اپ واقعی: باز کردن تراکنش‌ها → فیلتر → «پیشرفته»: هیچ ردیف رویدادی نیست،
   هر دو انتخابگر ۱۲px‌اند، گزینه‌هایشان («همه پروژه‌ها»، «همه اعضا») سالم و دکمهٔ
   «اعمال فیلتر» موجود است.
4. jsdom: `input`/`textarea`/`select` با `text-xs` → ۱۲px، `text-sm` → ۱۴px،
   `text-[11px]` → ۱۱px؛ فیلد بدون کلاس ۱۶px (و `select` بدون کلاس ۱۳px).

هر چهار آزمون روی کد قبل از اصلاح شکست می‌خورند (بررسی‌شده با `git stash`).

## نسخه

`versionCode=11`، `versionName=1.1.0`.
