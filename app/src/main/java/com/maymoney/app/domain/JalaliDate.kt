package com.maymoney.app.domain

/** A validated Persian-calendar date. The stored representation is yyyy/MM/dd. */
data class GregorianDate(
    val year: Int,
    val month: Int,
    val day: Int,
) {
    init {
        require(month in 1..12) { "Gregorian month must be between 1 and 12" }
        val leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        val monthLength = when (month) {
            2 -> if (leap) 29 else 28
            4, 6, 9, 11 -> 30
            else -> 31
        }
        require(day in 1..monthLength) { "Invalid Gregorian day $day/$month/$year" }
    }

    fun toIsoString(): String =
        "${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"

    /** Saturday-first index, matching the Persian picker grid (Saturday=0, Friday=6). */
    fun weekdayIndexSaturdayFirst(): Int {
        var adjustedYear = year.toLong()
        adjustedYear -= if (month <= 2) 1L else 0L
        val era = Math.floorDiv(adjustedYear, 400L)
        val yearOfEra = adjustedYear - era * 400L
        val adjustedMonth = month + if (month > 2) -3 else 9
        val dayOfYear = (153L * adjustedMonth + 2L) / 5L + day - 1L
        val dayOfEra = yearOfEra * 365L + yearOfEra / 4L - yearOfEra / 100L + dayOfYear
        val epochDay = era * 146097L + dayOfEra - 719468L
        return Math.floorMod(epochDay + 5L, 7L).toInt()
    }
}

data class JalaliDate(
    val year: Int,
    val month: Int,
    val day: Int,
) : Comparable<JalaliDate> {
    init {
        require(month in 1..12) { "Jalali month must be between 1 and 12" }
        require(day in 1..JalaliCalendar.daysInMonth(year, month)) {
            "Day $day does not exist in Jalali $year/$month"
        }
    }

    override fun compareTo(other: JalaliDate): Int =
        compareValuesBy(this, other, JalaliDate::year, JalaliDate::month, JalaliDate::day)

    fun toStorageString(): String =
        "$year/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}"

    fun toPersianString(): String = JalaliCalendar.toPersianDigits(toStorageString())

    override fun toString(): String = toStorageString()
}

/**
 * Pure Persian-calendar helpers ported from `src/domain/numbers.js` and differentially tested
 * against the existing WebView calendar rules. No Android, locale, timezone, or UI dependencies.
 */
object JalaliCalendar {
    private val leapBounds = intArrayOf(
        -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
        1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
    )
    private val leapRemainders = intArrayOf(1, 5, 9, 13, 17, 22, 26, 30)

    /** Matches the core bundle's `f9` leap-year function, including its bounded cycle table. */
    fun isLeapYear(year: Int): Boolean {
        val first = leapBounds.first()
        if (year < first || year >= leapBounds.last()) {
            val remainder = ((year % 33) + 33) % 33
            return leapRemainders.contains(remainder)
        }

        var current = first
        var cycle = 0
        for (index in 1 until leapBounds.size) {
            val candidate = leapBounds[index]
            cycle = candidate - current
            if (year < candidate) break
            current = candidate
        }

        var offset = year - current
        if (cycle - offset < 6) offset = offset - cycle + (cycle + 4) / 33 * 33
        var remainder = (offset + 1) % 33 - 1
        if (remainder == -1) remainder = 4
        return remainder % 4 == 0 && remainder != 0
    }

    /** Matches the core's `rn`: six 31-day months, five 30-day months, and Esfand. */
    fun daysInMonth(year: Int, month: Int): Int {
        require(month in 1..12) { "Jalali month must be between 1 and 12" }
        return when {
            month <= 6 -> 31
            month <= 11 -> 30
            isLeapYear(year) -> 30
            else -> 29
        }
    }

    /** Converts a Jalali date using the same day-number algorithm as the existing web calendar. */
    fun toGregorian(date: JalaliDate): GregorianDate {
        require(date.year in -61..3177) { "Jalali year is outside the conversion range" }
        val jalaliYear = date.year + 1595
        var days = -355_668 + 365 * jalaliYear + (jalaliYear / 33) * 8 + ((jalaliYear % 33 + 3) / 4)
        days += date.day + if (date.month < 7) {
            (date.month - 1) * 31
        } else {
            (date.month - 7) * 30 + 186
        }

        var gregorianYear = 400 * (days / 146_097)
        days %= 146_097
        if (days > 36_524) {
            days -= 1
            gregorianYear += 100 * (days / 36_524)
            days %= 36_524
            if (days >= 365) days += 1
        }
        gregorianYear += 4 * (days / 1_461)
        days %= 1_461
        if (days > 365) {
            gregorianYear += (days - 1) / 365
            days = (days - 1) % 365
        }

        var gregorianDay = days + 1
        val monthLengths = intArrayOf(0, 31, if (isGregorianLeapYear(gregorianYear)) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        var gregorianMonth = 0
        while (gregorianDay > monthLengths[gregorianMonth]) {
            gregorianDay -= monthLengths[gregorianMonth]
            gregorianMonth += 1
        }
        return GregorianDate(gregorianYear, gregorianMonth, gregorianDay)
    }

    private fun isGregorianLeapYear(year: Int): Boolean =
        year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)

    /** Strictly parses ASCII/Persian digits and either slash or hyphen separators. */
    fun parse(value: String?): JalaliDate? {
        if (value.isNullOrBlank()) return null
        val normalized = normalizeDigits(value.trim()).replace('-', '/')
        val parts = normalized.split('/')
        if (parts.size != 3) return null
        val year = parts[0].toIntOrNull() ?: return null
        val month = parts[1].toIntOrNull() ?: return null
        val day = parts[2].toIntOrNull() ?: return null
        return runCatching { JalaliDate(year, month, day) }.getOrNull()
    }

    /**
     * Adds calendar months and clamps the day to the destination month's actual length,
     * matching the current JS `addMonths`/`lr` contract.
     */
    fun addMonths(date: JalaliDate, months: Int): JalaliDate {
        val totalMonths = date.year.toLong() * 12L + (date.month - 1) + months.toLong()
        var targetYear = totalMonths / 12L
        var monthIndex = totalMonths % 12L
        if (monthIndex < 0) {
            targetYear -= 1L
            monthIndex += 12L
        }
        require(targetYear in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) {
            "Resulting Jalali year is outside the supported integer range"
        }
        val targetMonth = monthIndex.toInt() + 1
        val year = targetYear.toInt()
        val day = minOf(date.day, daysInMonth(year, targetMonth))
        return JalaliDate(year, targetMonth, day)
    }

    fun normalizeDigits(value: String): String = buildString(value.length) {
        value.forEach { char ->
            append(
                if (char in '\u06F0'..'\u06F9') {
                    ('0'.code + (char.code - '\u06F0'.code)).toChar()
                } else {
                    char
                },
            )
        }
    }

    fun toPersianDigits(value: String): String = buildString(value.length) {
        value.forEach { char ->
            append(
                if (char in '0'..'9') {
                    ('\u06F0'.code + (char.code - '0'.code)).toChar()
                } else {
                    char
                },
            )
        }
    }
}
