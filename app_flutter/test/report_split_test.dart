import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/domain/report_split.dart';
import 'package:app_flutter/models/legacy_account.dart';
import 'package:app_flutter/models/legacy_transaction.dart';

void main() {
  test('report split matches numeric legacy examples from main', () {
    final fixture = jsonDecode(
      File('test/fixtures/main_report_split.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    final accounts = (fixture['accounts'] as List).cast<Map<String, dynamic>>();
    for (final entry in fixture['cases'] as List) {
      final example = entry as Map<String, dynamic>;
      final result = splitTransaction(
        example['transaction'] as Map<String, dynamic>,
        accounts,
        allTransactions: (example['allTransactions'] as List).cast<Map<String, dynamic>>(),
      );
      final expected = example['expected'] as Map<String, dynamic>;
      expect(result.income, expected['income'], reason: example['name'] as String);
      expect(result.expense, expected['expense'], reason: example['name'] as String);
      expect(result.fee, expected['fee'], reason: example['name'] as String);

      final legacyResult = splitLegacyTransaction(
        LegacyTransaction.fromJson(example['transaction'] as Map<String, dynamic>),
        accounts.map((account) => LegacyAccount.fromJson(account)).toList(),
        allTransactions: (example['allTransactions'] as List)
            .map((item) => LegacyTransaction.fromJson(item as Map<String, dynamic>)).toList(),
      );
      expect(legacyResult.income, expected['income'], reason: example['name'] as String);
      expect(legacyResult.expense, expected['expense'], reason: example['name'] as String);
      expect(legacyResult.fee, expected['fee'], reason: example['name'] as String);
    }
  });

  test('does not silently reinterpret string amounts in ordinary documents', () {
    expect(
      () => splitTransaction({'type': 'income', 'amount': '100'}, []),
      throwsArgumentError,
    );
  });
}
