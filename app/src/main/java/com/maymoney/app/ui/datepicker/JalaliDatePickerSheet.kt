package com.maymoney.app.ui.datepicker

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.maymoney.app.domain.JalaliCalendar
import com.maymoney.app.domain.JalaliDate
import com.maymoney.app.domain.JalaliDatePickerRules

private val PersianMonths = listOf(
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
)
private val PersianWeekdays = listOf("ش", "ی", "د", "س", "چ", "پ", "ج")

/**
 * Compose implementation of the existing single-date sheet. It is not connected to the
 * production WebView or range pickers; callers own the open/close lifecycle and receive
 * an immediate callback when a day or Today is chosen.
 */
@Composable
fun JalaliDatePickerSheet(
    value: JalaliDate,
    today: JalaliDate,
    onDateSelected: (JalaliDate) -> Unit,
    onDismiss: () -> Unit,
    minDate: JalaliDate? = null,
    maxDate: JalaliDate? = null,
    allowFuture: Boolean = false,
) {
    val effectiveMaxDate = if (allowFuture) null else maxDate ?: today
    var visibleYear by remember(value, today, minDate, effectiveMaxDate) {
        mutableIntStateOf(value.year)
    }
    var visibleMonth by remember(value, today, minDate, effectiveMaxDate) {
        mutableIntStateOf(value.month)
    }
    var choosingYear by remember(value, today, minDate, effectiveMaxDate) {
        mutableStateOf(false)
    }
    val years = remember(today, minDate, effectiveMaxDate) {
        JalaliDatePickerRules.availableYears(today, minDate, effectiveMaxDate)
    }
    val monthCells = remember(visibleYear, visibleMonth) {
        JalaliDatePickerRules.monthCells(visibleYear, visibleMonth)
    }
    val canGoPrevious = JalaliDatePickerRules.canNavigateMonth(
        visibleYear, visibleMonth, -1, minDate, effectiveMaxDate,
    )
    val canGoNext = JalaliDatePickerRules.canNavigateMonth(
        visibleYear, visibleMonth, 1, minDate, effectiveMaxDate,
    )
    val colors = MaterialTheme.colorScheme
    val panelColor = colors.surface
    val borderColor = colors.outline
    val mutedColor = colors.onSurfaceVariant
    val activeColor = colors.primary

    BackHandler(onBack = onDismiss)
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnClickOutside = true,
            dismissOnBackPress = true,
        ),
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss,
                ),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 384.dp)
                    .heightIn(max = maxHeight * 0.86f)
                    .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .background(panelColor)
                    .border(
                        BorderStroke(1.dp, borderColor),
                        RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {},
                    )
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .size(width = 40.dp, height = 4.dp)
                        .clip(RoundedCornerShape(50))
                        .background(mutedColor.copy(alpha = 0.45f)),
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PickerHeaderButton(
                        text = JalaliCalendar.toPersianDigits(visibleYear.toString()),
                        selected = choosingYear,
                        modifier = Modifier.weight(1f),
                        onClick = { choosingYear = !choosingYear },
                    )
                    Row(
                        modifier = Modifier
                            .weight(1.55f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(colors.surfaceVariant)
                            .border(1.dp, borderColor, RoundedCornerShape(12.dp)),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        PickerHeaderButton(
                            text = "‹",
                            enabled = canGoPrevious,
                            onClick = {
                                if (canGoPrevious) {
                                    val first = JalaliCalendar.addMonths(
                                        JalaliDate(visibleYear, visibleMonth, 1), -1,
                                    )
                                    visibleYear = first.year
                                    visibleMonth = first.month
                                }
                            },
                        )
                        Text(
                            text = PersianMonths[visibleMonth - 1],
                            color = colors.onSurface,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f),
                        )
                        PickerHeaderButton(
                            text = "›",
                            enabled = canGoNext,
                            onClick = {
                                if (canGoNext) {
                                    val first = JalaliCalendar.addMonths(
                                        JalaliDate(visibleYear, visibleMonth, 1), 1,
                                    )
                                    visibleYear = first.year
                                    visibleMonth = first.month
                                }
                            },
                        )
                    }
                    PickerHeaderButton(
                        text = "×",
                        contentDescription = "بستن تقویم",
                        modifier = Modifier.size(40.dp),
                        onClick = onDismiss,
                    )
                }

                if (choosingYear) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(colors.surfaceVariant.copy(alpha = 0.65f))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "انتخاب سال شمسی",
                            color = mutedColor,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        years.chunked(3).forEach { rowYears ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                rowYears.forEach { year ->
                                    PickerHeaderButton(
                                        text = JalaliCalendar.toPersianDigits(year.toString()),
                                        selected = year == visibleYear,
                                        modifier = Modifier.weight(1f),
                                        onClick = {
                                            visibleYear = year
                                            choosingYear = false
                                        },
                                    )
                                }
                                repeat(3 - rowYears.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(colors.surfaceVariant.copy(alpha = 0.48f))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            PersianWeekdays.forEachIndexed { index, weekday ->
                                Text(
                                    text = weekday,
                                    color = if (index == 6) Color(0xFFE28A91) else mutedColor,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.weight(1f).padding(vertical = 4.dp),
                                )
                            }
                        }
                        monthCells.chunked(7).forEach { week ->
                            Row(modifier = Modifier.fillMaxWidth()) {
                                week.forEach { date ->
                                    if (date == null) {
                                        Spacer(modifier = Modifier.weight(1f).height(38.dp))
                                    } else {
                                        val isToday = date == today
                                        val isSelected = date == value
                                        val enabled = JalaliDatePickerRules.isSelectable(
                                            date, minDate, effectiveMaxDate,
                                        )
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(38.dp)
                                                .padding(1.dp)
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(
                                                    if (isSelected) activeColor
                                                    else if (isToday) activeColor.copy(alpha = 0.14f)
                                                    else Color.Transparent,
                                                )
                                                .then(
                                                    if (isToday && !isSelected) Modifier.border(
                                                        1.dp, activeColor.copy(alpha = 0.65f),
                                                        RoundedCornerShape(10.dp),
                                                    ) else Modifier,
                                                )
                                                .clickable(
                                                    enabled = enabled,
                                                    role = Role.Button,
                                                    onClick = {
                                                        onDateSelected(date)
                                                        onDismiss()
                                                    },
                                                ),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Text(
                                                text = JalaliCalendar.toPersianDigits(date.day.toString()),
                                                color = when {
                                                    !enabled -> mutedColor.copy(alpha = 0.28f)
                                                    isSelected -> colors.onPrimary
                                                    isToday -> activeColor
                                                    else -> colors.onSurface
                                                },
                                                fontSize = 13.sp,
                                                fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Medium,
                                            )
                                        }
                                    }
                                }
                                repeat(7 - week.size) { Spacer(modifier = Modifier.weight(1f)) }
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PickerHeaderButton(
                        text = "امروز",
                        selected = true,
                        onClick = {
                            visibleYear = today.year
                            visibleMonth = today.month
                            onDateSelected(today)
                            onDismiss()
                        },
                    )
                    PickerHeaderButton(text = "بستن", onClick = onDismiss)
                }
            }
        }
    }
}

@Composable
private fun PickerHeaderButton(
    text: String,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    enabled: Boolean = true,
    contentDescription: String? = null,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier
            .heightIn(min = 38.dp)
            .clip(shape)
            .clickable(
                enabled = enabled,
                role = Role.Button,
                interactionSource = interaction,
                indication = null,
                onClickLabel = contentDescription,
                onClick = onClick,
            ),
        shape = shape,
        color = when {
            !enabled -> Color.Transparent
            selected -> colors.primary
            else -> colors.surfaceVariant
        },
        border = BorderStroke(
            width = 1.dp,
            color = when {
                selected -> colors.primary
                enabled -> colors.outline
                else -> colors.outline.copy(alpha = 0.25f)
            },
        ),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
            Text(
                text = text,
                color = when {
                    !enabled -> colors.onSurfaceVariant.copy(alpha = 0.35f)
                    selected -> colors.onPrimary
                    else -> colors.onSurface
                },
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}
