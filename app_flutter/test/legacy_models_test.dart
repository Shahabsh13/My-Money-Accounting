import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/models/legacy_account.dart';
import 'package:app_flutter/models/legacy_transaction.dart';

void main() {
  test('main-derived account and document examples preserve their full JSON', () {
    final fixture = jsonDecode(
      File('test/fixtures/main_report_split.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    for (final value in fixture['accounts'] as List) {
      final json = value as Map<String, dynamic>;
      expect(LegacyAccount.fromJson(json).toJson(), equals(json));
    }
    for (final value in fixture['cases'] as List) {
      final json = (value as Map<String, dynamic>)['transaction'] as Map<String, dynamic>;
      expect(LegacyTransaction.fromJson(json).toJson(), equals(json));
    }
  });

  test('unknown and nested fields survive without shared mutable references', () {
    final input = <String, dynamic>{
      'id': 'tx-1',
      'amount': 10,
      'check': {'status': 'cleared', 'extra': ['اطلاعات']},
      'compoundSources': [{'account': 'بانک', 'amount': 10}],
      'unknownField': {'nested': true},
      'explicitNull': null,
    };
    final original = jsonDecode(jsonEncode(input));
    final transaction = LegacyTransaction.fromJson(input);
    (input['check'] as Map<String, dynamic>)['status'] = 'changed';
    final output = transaction.toJson();
    expect(output, equals(original));
    (output['check'] as Map<String, dynamic>)['status'] = 'changed again';
    expect(transaction.toJson(), equals(original));
    expect(transaction.toJson().containsKey('feeAmount'), isFalse);
    expect(transaction.toJson().containsKey('explicitNull'), isTrue);
  });

  test('legacy account retains identifier and hierarchy independently of input', () {
    final input = <String, dynamic>{
      'id': 'account-1', 'parentId': 3, 'name': 'بانک', 'group': 'bank',
      'active': false, 'initialBalance': 500, 'other': {'x': 1},
    };
    final account = LegacyAccount.fromJson(input);
    (input['other'] as Map<String, dynamic>)['x'] = 2;
    expect(account.id, 'account-1');
    expect(account.parentId, 3);
    expect((account.toJson()['other'] as Map<String, dynamic>)['x'], 1);
  });
}
