/// Money formatting translated from main's src/domain/numbers.js (formatAmount,
/// separatorFor and toPersianDigits). Values are displayed in their existing
/// unit; this module does not perform currency conversion.
const _persianDigits = '۰۱۲۳۴۵۶۷۸۹';

String toPersianDigits(String value) => value.replaceAllMapped(
      RegExp(r'[0-9]'),
      (match) => _persianDigits[int.parse(match.group(0)!)],
    );

String separatorFor(String? format) {
  switch (format) {
    case 'slash':
      return '/';
    case 'space':
      return ' ';
    case 'standard':
      return ',';
    default:
      return '،';
  }
}

/// Matches main's formatAmount: round the absolute value before adding a sign.
String formatAmount(num? value, {String? format}) {
  if (value == null || value.isNaN) return '۰';
  final negative = value < 0;
  final absolute = value.abs();
  final rounded = absolute.isInfinite ? 'Infinity' : absolute.round().toString();
  final grouped = rounded.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => separatorFor(format),
  );
  return '${negative ? '-' : ''}${toPersianDigits(grouped)}';
}
