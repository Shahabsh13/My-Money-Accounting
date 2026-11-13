import 'package:flutter_test/flutter_test.dart';
import 'package:app_flutter/models/transaction_model.dart';

void main() {
  test('transaction map preserves transfer fields', () {
    final original = TransactionModel(
      id: 1,
      amount: 250,
      type: TransactionType.transfer,
      accountId: 2,
      destinationAccountId: 3,
      category: 'انتقال وجه',
      dateTime: DateTime(2026, 1, 1),
      shamsiDate: '1404/10/11',
    );
    final restored = TransactionModel.fromMap(original.toMap());
    expect(restored.id, original.id);
    expect(restored.amount, original.amount);
    expect(restored.type, original.type);
    expect(restored.accountId, original.accountId);
    expect(restored.destinationAccountId, original.destinationAccountId);
    expect(restored.shamsiDate, original.shamsiDate);
  });
}
