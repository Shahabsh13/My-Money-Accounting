package com.maymoney.app.ui.datepicker

import android.icu.util.Calendar
import android.icu.util.TimeZone
import android.icu.util.ULocale
import com.maymoney.app.domain.JalaliDate

/** Uses Android ICU in the same Tehran zone as the existing WebView `Rt()` helper. */
object PersianToday {
    fun current(): JalaliDate {
        val calendar = Calendar.getInstance(
            TimeZone.getTimeZone("Asia/Tehran"),
            ULocale.forLanguageTag("fa-IR-u-ca-persian"),
        )
        return JalaliDate(
            year = calendar.get(Calendar.YEAR),
            month = calendar.get(Calendar.MONTH) + 1,
            day = calendar.get(Calendar.DAY_OF_MONTH),
        )
    }
}
