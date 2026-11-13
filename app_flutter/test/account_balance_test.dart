import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/domain/account_balance.dart';
import 'package:app_flutter/models/legacy_account.dart';
import 'package:app_flutter/models/legacy_transaction.dart';

void main() {
  test('legacy account balances match main examples', () {
    final cases = jsonDecode(
      File('test/fixtures/main_account_balance.json').readAsStringSync(),
    ) as List;
    for (final scenario in cases.cast<Map<String, dynamic>>()) {
      final accounts = (scenario['accounts'] as List)
          .map((value) => LegacyAccount.fromJson(value as Map<String, dynamic>)).toList();
      final transactions = (scenario['transactions'] as List)
          .map((value) => LegacyTransaction.fromJson(value as Map<String, dynamic>)).toList();
      final expected = scenario['expected'] as List;
      for (var i = 0; i < accounts.length; i++) {
        final result = calculateLegacyAccountBalance(accounts[i], accounts, transactions);
        final value = expected[i] as Map<String, dynamic>;
        final reason = 'account=${accounts[i].name}';
        expect(result.balance, value['balance'], reason: reason);
        expect(result.initialBalance, value['initialBalance'], reason: reason);
        expect(result.totalDebits, value['totalDebits'], reason: reason);
        expect(result.totalCredits, value['totalCredits'], reason: reason);
        expect(result.transactionCount, value['transactionCount'], reason: reason);
        expect(result.entriesCount, value['entriesCount'], reason: reason);
      }
    }
  });

  test('null account returns zero totals', () {
    final result = calculateLegacyAccountBalance(null, [], []);
    expect(result.balance, 0);
    expect(result.initialBalance, 0);
    expect(result.totalDebits, 0);
    expect(result.totalCredits, 0);
    expect(result.transactionCount, 0);
  });

  test('refuses malformed numeric values instead of guessing a balance', () {
    final account = LegacyAccount.fromJson({'id': 1, 'name': 'بانک', 'group': 'bank'});
    final transaction = LegacyTransaction.fromJson({
      'type': 'income', 'account': 'بانک', 'amount': '100',
    });
    expect(() => calculateLegacyAccountBalance(account, [account], [transaction]), throwsFormatException);
  });
}
