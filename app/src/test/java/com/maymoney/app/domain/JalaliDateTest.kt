package com.maymoney.app.domain

import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class JalaliDateTest {
    @Test
    fun leapYearRuleMatchesTheCoreAcrossItsFullBoundedCycle() {
        val bits = (-61 until 3178).joinToString(separator = "") { year ->
            if (JalaliCalendar.isLeapYear(year)) "1" else "0"
        }
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(bits.toByteArray(Charsets.UTF_8))
            .joinToString(separator = "") { byte ->
                (byte.toInt() and 0xff).toString(16).padStart(2, '0')
            }

        // Golden vector generated from the existing JS domain implementation for years -61..3177.
        assertEquals(785, bits.count { it == '1' })
        assertEquals("4fa45fddf92d5d3efdb9742eee68f58b5ef3a25c8521ff301f35784ba2e7e1c2", digest)
    }

    @Test
    fun monthLengthsMatchTheExistingPersianCalendar() {
        for (month in 1..6) assertEquals(31, JalaliCalendar.daysInMonth(1404, month))
        for (month in 7..11) assertEquals(30, JalaliCalendar.daysInMonth(1404, month))
        assertEquals(30, JalaliCalendar.daysInMonth(1403, 12))
        assertEquals(29, JalaliCalendar.daysInMonth(1404, 12))
        assertEquals(30, JalaliCalendar.daysInMonth(1407, 12))
        assertThrows(IllegalArgumentException::class.java) {
            JalaliCalendar.daysInMonth(1404, 13)
        }
    }

    @Test
    fun parseAndFormatPreserveTheStoredDateContract() {
        val date = JalaliCalendar.parse("۱۴۰۳/۱۲/۳۰")
        assertEquals(JalaliDate(1403, 12, 30), date)
        assertEquals("1403/12/30", date?.toStorageString())
        assertEquals("۱۴۰۳/۱۲/۳۰", date?.toPersianString())
        assertEquals(JalaliDate(1403, 12, 30), JalaliCalendar.parse("1403-12-30"))
        assertNull(JalaliCalendar.parse("1403/12/31"))
        assertNull(JalaliCalendar.parse("1404/13/01"))
        assertNull(JalaliCalendar.parse("not-a-date"))
    }

    @Test
    fun monthArithmeticClampsAtTheDestinationMonthAndCrossesYearBoundaries() {
        assertEquals("1404/07/30", JalaliCalendar.addMonths(JalaliDate(1404, 6, 31), 1).toStorageString())
        assertEquals("1404/12/29", JalaliCalendar.addMonths(JalaliDate(1404, 6, 31), 6).toStorageString())
        assertEquals("1404/01/30", JalaliCalendar.addMonths(JalaliDate(1403, 12, 30), 1).toStorageString())
        assertEquals("1403/11/30", JalaliCalendar.addMonths(JalaliDate(1403, 12, 30), -1).toStorageString())
    }

    @Test
    fun directConstructionRejectsImpossibleDates() {
        assertThrows(IllegalArgumentException::class.java) { JalaliDate(1403, 12, 31) }
        assertThrows(IllegalArgumentException::class.java) { JalaliDate(1404, 0, 1) }
        assertTrue(JalaliCalendar.isLeapYear(1403))
        assertFalse(JalaliCalendar.isLeapYear(1404))
    }
}
