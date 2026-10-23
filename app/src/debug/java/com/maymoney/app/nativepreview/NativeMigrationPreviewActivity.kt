package com.maymoney.app.nativepreview

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maymoney.app.domain.JalaliCalendar
import com.maymoney.app.ui.datepicker.JalaliDatePickerSheet
import com.maymoney.app.ui.datepicker.PersianToday

/**
 * Debug-only Compose host for validating the Native UI foundation.
 * The production launcher remains MainActivity (WebView) until feature parity is proven.
 */
class NativeMigrationPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NativeMigrationPreviewScreen(onClose = ::finish)
        }
    }
}

private val MayMoneyDarkColors = darkColorScheme(
    primary = Color(0xFF9AC8B6),
    onPrimary = Color(0xFF0C1F1D),
    background = Color(0xFF101214),
    onBackground = Color(0xFFF8FAFC),
    surface = Color(0xFF181B20),
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF252A32),
    onSurfaceVariant = Color(0xFFCBD5E1),
    outline = Color(0xFF39414D),
)

@Composable
private fun NativeMigrationPreviewScreen(onClose: () -> Unit) {
    val today = remember { PersianToday.current() }
    var selectedDate by remember { mutableStateOf(today) }
    var datePickerOpen by remember { mutableStateOf(false) }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = MayMoneyDarkColors) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 20.dp, vertical = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        text = "حسابداری شخصی",
                        color = MaterialTheme.colorScheme.onBackground,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "پیش‌نمایش آزمایشی Kotlin و Compose",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline,
                        ),
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Text(
                                text = "پایهٔ رابط Native",
                                color = MaterialTheme.colorScheme.onSurface,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "این پیش‌نمایش فقط در نسخهٔ debug در دسترس است. مسیر اصلی برنامه و داده‌های موجود همچنان در WebView باقی مانده‌اند.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline,
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text = "مرحلهٔ دوم: انتخابگر تاریخ تکی",
                                color = MaterialTheme.colorScheme.onSurface,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = "تاریخ انتخاب‌شده: ${JalaliCalendar.toPersianDigits(selectedDate.toStorageString())}",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Button(
                                onClick = { datePickerOpen = true },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text(text = "باز کردن تقویم شمسی")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    Button(
                        onClick = onClose,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                    ) {
                        Text(text = "بستن پیش‌نمایش")
                    }
                }
                if (datePickerOpen) {
                    JalaliDatePickerSheet(
                        value = selectedDate,
                        today = today,
                        onDateSelected = { selectedDate = it },
                        onDismiss = { datePickerOpen = false },
                    )
                }
            }
        }
    }
}
