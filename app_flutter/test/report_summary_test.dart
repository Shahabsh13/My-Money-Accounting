import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/domain/report_summary.dart';
import 'package:app_flutter/models/legacy_account.dart';
import 'package:app_flutter/models/legacy_transaction.dart';

void main() {
  test('legacy report summaries match main examples', () {
    final balanceScenarios = jsonDecode(
      File('test/fixtures/main_account_balance.json').readAsStringSync(),
    ) as List;
    final fixture = jsonDecode(
      File('test/fixtures/main_report_summary.json').readAsStringSync(),
    ) as Map<String, dynamic>;

    void compare(Map<String, dynamic> input, Map<String, dynamic> example) {
      final accounts = (input['accounts'] as List)
          .map((item) => LegacyAccount.fromJson(item as Map<String, dynamic>)).toList();
      final transactions = (input['transactions'] as List)
          .map((item) => LegacyTransaction.fromJson(item as Map<String, dynamic>)).toList();
      final installments = (example['installments'] as List).cast<Map<String, dynamic>>();
      expect(summarizeLegacyReports(transactions, accounts, installments), equals(example['expected']));
    }

    for (final item in fixture['results'] as List) {
      final example = item as Map<String, dynamic>;
      compare(balanceScenarios[example['scenarioIndex'] as int] as Map<String, dynamic>, example);
    }
    for (final item in fixture['standalone'] as List) {
      final example = item as Map<String, dynamic>;
      compare(example, example);
    }
  });

  test('refuses nonnumeric pending installment amounts', () {
    expect(
      () => summarizeLegacyReports([], [], [{'status': 'pending', 'amount': '10'}]),
      throwsFormatException,
    );
  });
}
