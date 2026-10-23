package com.maymoney.app.domain

/** Pure grid and bound rules shared by the Native single-date picker. */
object JalaliDatePickerRules {
    /** Returns the month as Saturday-first cells; leading blanks are null. */
    fun monthCells(year: Int, month: Int): List<JalaliDate?> {
        require(month in 1..12) { "Jalali month must be between 1 and 12" }
        val firstWeekday = JalaliCalendar.toGregorian(JalaliDate(year, month, 1))
            .weekdayIndexSaturdayFirst()
        return buildList(firstWeekday + JalaliCalendar.daysInMonth(year, month)) {
            repeat(firstWeekday) { add(null) }
            for (day in 1..JalaliCalendar.daysInMonth(year, month)) {
                add(JalaliDate(year, month, day))
            }
        }
    }

    fun isSelectable(date: JalaliDate, minDate: JalaliDate?, maxDate: JalaliDate?): Boolean =
        (minDate == null || date >= minDate) && (maxDate == null || date <= maxDate)

    /** Whether moving one month in [direction] leaves at least one selectable day. */
    fun canNavigateMonth(
        year: Int,
        month: Int,
        direction: Int,
        minDate: JalaliDate?,
        maxDate: JalaliDate?,
    ): Boolean {
        require(direction == -1 || direction == 1) { "Month navigation direction must be -1 or 1" }
        val first = JalaliCalendar.addMonths(JalaliDate(year, month, 1), direction)
            .let { JalaliDate(it.year, it.month, 1) }
        val last = JalaliDate(first.year, first.month, JalaliCalendar.daysInMonth(first.year, first.month))
        return (minDate == null || last >= minDate) && (maxDate == null || first <= maxDate)
    }

    /** Year list matches the current picker: latest bound/default +2 down to earliest/-12. */
    fun availableYears(
        today: JalaliDate,
        minDate: JalaliDate?,
        maxDate: JalaliDate?,
    ): List<Int> {
        val latest = maxDate?.year ?: today.year + 2
        val earliest = minDate?.year ?: today.year - 12
        if (latest < earliest) return emptyList()
        return (latest downTo earliest).toList()
    }
}
