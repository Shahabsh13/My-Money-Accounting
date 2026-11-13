import '../models/legacy_account.dart';
import '../models/legacy_transaction.dart';
import 'account_balance.dart' show isCanceledLegacyCheck;

/// Translation of splitTransaction in main's src/domain/reports.js.
///
/// This uses the legacy document fields, not the current Flutter database model.
/// It is deliberately not connected to live reports until that model can
/// represent checks, fees, compound entries and reversals without data loss.
class ReportSplit {
  const ReportSplit({required this.income, required this.expense, required this.fee});

  final num income;
  final num expense;
  final num fee;
}

String? _accountGroup(Object? name, List<Map<String, dynamic>> accounts) {
  if (name is! String || name.isEmpty) return null;
  final key = name.trim().toLowerCase();
  // The original name map keeps the last account with a given name.
  String? group;
  for (final account in accounts) {
    final accountName = account['name'];
    if (accountName is String && accountName.isNotEmpty &&
        accountName.trim().toLowerCase() == key) {
      group = account['group'] as String?;
    }
  }
  return group;
}

num _numberOrZero(Object? value) {
  if (value is num) return value.isNaN ? 0 : value;
  if (value is String) return num.tryParse(value.trim()) ?? 0;
  if (value == true) return 1;
  return 0;
}

/// Run the translated calculation on lossless legacy models, without importing
/// or modifying the current Flutter database.
ReportSplit splitLegacyTransaction(
  LegacyTransaction transaction,
  List<LegacyAccount> accounts, {
  List<LegacyTransaction>? allTransactions,
}) => splitTransaction(
      transaction.toJson(),
      accounts.map((account) => account.toJson()).toList(),
      allTransactions: allTransactions?.map((item) => item.toJson()).toList(),
    );

ReportSplit splitTransaction(
  Map<String, dynamic> transaction,
  List<Map<String, dynamic>> accounts, {
  List<Map<String, dynamic>>? allTransactions,
}) {
  num income = 0;
  num expense = 0;
  final feeAmount = _numberOrZero(transaction['feeAmount']);
  final reversal = transaction['isReversal'] == true;
  final sign = reversal ? -1 : 1;
  if (feeAmount > 0) expense += feeAmount * sign;

  ReportSplit result() => ReportSplit(income: income, expense: expense, fee: feeAmount * sign);
  if (isCanceledLegacyCheck(transaction)) return result();

  if (transaction['isCompound'] == true) {
    for (final source in (transaction['compoundSources'] as List? ?? const [])) {
      if (source is! Map || source['account'] == null || source['account'] == '') continue;
      if (_accountGroup(source['account'], accounts) == 'income') {
        income += sign * _numberOrZero(source['amount']);
      }
    }
    for (final destination in (transaction['compoundDestinations'] as List? ?? const [])) {
      if (destination is! Map || destination['account'] == null || destination['account'] == '') continue;
      if (_accountGroup(destination['account'], accounts) == 'expense') {
        expense += sign * _numberOrZero(destination['amount']);
      }
    }
    return result();
  }

  if (transaction['isRefundReceipt'] == true && transaction['type'] == 'income') {
    var refundGroup = transaction['refundCategoryGroup'] as String?;
    if ((refundGroup == null || refundGroup.isEmpty) &&
        allTransactions != null && transaction['reversalOfDocNumber'] != null) {
      for (final candidate in allTransactions) {
        if (candidate['isReversal'] != true && candidate['type'] == 'expense' &&
            (candidate['documentNumber'] ?? candidate['id']).toString() ==
                transaction['reversalOfDocNumber'].toString()) {
          if (candidate['category'] != null) refundGroup = _accountGroup(candidate['category'], accounts);
          break;
        }
      }
    }
    if (refundGroup == 'expense' || refundGroup == null || refundGroup.isEmpty) {
      expense -= _numberOrZero(transaction['amount']);
    } else if (refundGroup == 'income') {
      income += _numberOrZero(transaction['amount']);
    }
    return result();
  }

  // Normal legacy documents must have numeric amounts. String amounts trigger
  // JavaScript concatenation in the original and are not safe to reinterpret.
  final rawAmount = transaction['amount'];
  if ((transaction['type'] == 'income' || transaction['type'] == 'expense') && rawAmount is! num) {
    throw ArgumentError('Expected a numeric amount in a normal legacy document');
  }
  final amount = rawAmount is num ? rawAmount : 0;
  final categoryGroup = _accountGroup(transaction['category'], accounts);
  final check = transaction['check'];
  final notBounced = check is! Map || check['status'] != 'bounced';
  if (transaction['type'] == 'income') {
    final asIncome = categoryGroup == 'income' ||
        ((categoryGroup == null || categoryGroup.isEmpty) && !reversal);
    if (asIncome) {
      if (notBounced) income += amount;
    } else if ((categoryGroup == 'expense' || reversal) && notBounced) {
      expense -= amount;
    }
  } else if (transaction['type'] == 'expense') {
    final asExpense = categoryGroup == 'expense' ||
        ((categoryGroup == null || categoryGroup.isEmpty) && !reversal);
    if (asExpense) {
      if (notBounced) expense += amount;
    } else if ((categoryGroup == 'income' || reversal) && notBounced) {
      income -= amount;
    }
  }
  return result();
}
