package com.maymoney.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JalaliDatePickerRulesTest {
    @Test
    fun monthGridStartsSaturdayFirstAndUsesLegacyWeekdayConversion() {
        val nowruz1403 = JalaliDatePickerRules.monthCells(1403, 1)
        assertEquals(4, nowruz1403.takeWhile { it == null }.size) // 2024-03-20, Wednesday
        assertEquals(31, nowruz1403.count { it != null })
        assertEquals(JalaliDate(1403, 1, 1), nowruz1403[4])

        val nowruz1404 = JalaliDatePickerRules.monthCells(1404, 1)
        assertEquals(6, nowruz1404.takeWhile { it == null }.size) // 2025-03-21, Friday
        assertEquals(31, nowruz1404.count { it != null })
    }

    @Test
    fun boundsDisableOnlyMonthsWithNoSelectableDay() {
        val min = JalaliDate(1404, 4, 15)
        val max = JalaliDate(1404, 6, 3)

        assertFalse(JalaliDatePickerRules.canNavigateMonth(1404, 4, -1, min, max))
        assertTrue(JalaliDatePickerRules.canNavigateMonth(1404, 4, 1, min, max))
        assertTrue(JalaliDatePickerRules.canNavigateMonth(1404, 5, -1, min, max))
        assertTrue(JalaliDatePickerRules.canNavigateMonth(1404, 5, 1, min, max))
        assertTrue(JalaliDatePickerRules.canNavigateMonth(1404, 6, -1, min, max))
        assertFalse(JalaliDatePickerRules.canNavigateMonth(1404, 6, 1, min, max))
    }

    @Test
    fun minAndMaxBoundsAreInclusive() {
        val min = JalaliDate(1404, 1, 5)
        val max = JalaliDate(1404, 1, 20)

        assertFalse(JalaliDatePickerRules.isSelectable(JalaliDate(1404, 1, 4), min, max))
        assertTrue(JalaliDatePickerRules.isSelectable(min, min, max))
        assertTrue(JalaliDatePickerRules.isSelectable(JalaliDate(1404, 1, 12), min, max))
        assertTrue(JalaliDatePickerRules.isSelectable(max, min, max))
        assertFalse(JalaliDatePickerRules.isSelectable(JalaliDate(1404, 1, 21), min, max))
    }

    @Test
    fun yearListUsesTheCurrentDefaultWindowOrExplicitBounds() {
        val today = JalaliDate(1403, 6, 5)
        val defaults = JalaliDatePickerRules.availableYears(today, null, null)
        assertEquals(1405, defaults.first())
        assertEquals(1391, defaults.last())
        assertEquals(15, defaults.size)

        val bounded = JalaliDatePickerRules.availableYears(
            today = today,
            minDate = JalaliDate(1399, 10, 1),
            maxDate = JalaliDate(1404, 2, 10),
        )
        assertEquals(listOf(1404, 1403, 1402, 1401, 1400, 1399), bounded)
    }
}
