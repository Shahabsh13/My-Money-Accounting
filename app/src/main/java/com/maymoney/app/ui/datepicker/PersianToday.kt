package com.maymoney.app.ui.datepicker

import android.icu.util.PersianCalendar
import android.icu.util.TimeZone
import com.maymoney.app.domain.JalaliDate

/** Uses Android ICU in the same Tehran zone as the existing WebView `Rt()` helper. */
object PersianToday {
    fun current(): JalaliDate {
        val calendar = PersianCalendar(TimeZone.getTimeZone("Asia/Tehran"))
        return JalaliDate(
            year = calendar.get(PersianCalendar.YEAR),
            month = calendar.get(PersianCalendar.MONTH) + 1,
            day = calendar.get(PersianCalendar.DAY_OF_MONTH),
        )
    }
}
