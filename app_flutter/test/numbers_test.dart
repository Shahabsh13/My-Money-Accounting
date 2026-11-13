import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/domain/numbers.dart' as numbers;

void main() {
  test('amount formatting matches examples captured from main', () {
    final cases = jsonDecode(
      File('test/fixtures/main_amount_format.json').readAsStringSync(),
    ) as List<dynamic>;
    for (final item in cases) {
      final example = item as Map<String, dynamic>;
      expect(
        numbers.formatAmount(example['value'] as num, format: example['format'] as String?),
        example['expected'],
        reason: 'value=${example['value']}, format=${example['format']}',
      );
    }
  });

  test('null and NaN match main', () {
    expect(numbers.formatAmount(null), '۰');
    expect(numbers.formatAmount(double.nan), '۰');
  });
}
