import '../models/legacy_account.dart';
import '../models/legacy_transaction.dart';

/// Translation of accountBalance in main's src/domain/accounts.js. This works
/// with the legacy JSON model only and is not connected to the live database.
class AccountBalance {
  const AccountBalance({required this.balance, required this.initialBalance,
    required this.totalDebits, required this.totalCredits, required this.transactionCount});
  final num balance;
  final num initialBalance;
  final num totalDebits;
  final num totalCredits;
  final int transactionCount;
  int get entriesCount => transactionCount;
}

String _key(Object? value) => (value ?? '').toString().trim().toLowerCase();

bool isCanceledLegacyCheck(Map<String, dynamic> transaction) {
  final check = transaction['check'];
  if (check is! Map) return false;
  if (check['debtCanceled'] == true) return true;
  final status = _key(check['status']);
  return const {'bounced', 'refunded', 'returned', 'returned_check', 'dishonored'}.contains(status) ||
      RegExp(r'برگشت|مسترد|returned|refund|bounc|dishonor', caseSensitive: false).hasMatch(status);
}

// Legacy kernel arithmetic also accepts malformed values via JS coercion. Do
// not silently invent numeric balances for such records in a financial app.
num _numeric(Object? value, String field, {bool optional = false}) {
  if (value == null && optional) return 0;
  if (value is num && value.isFinite) return value;
  throw FormatException('Expected a finite numeric $field');
}

AccountBalance calculateLegacyAccountBalance(
  LegacyAccount? account,
  List<LegacyAccount> accounts,
  List<LegacyTransaction> transactions,
) {
  if (account == null) {
    return const AccountBalance(balance: 0, initialBalance: 0, totalDebits: 0, totalCredits: 0, transactionCount: 0);
  }
  final records = accounts.map((item) => item.toJson()).toList();
  final selected = account.toJson();
  final children = <Object?, List<Map<String, dynamic>>>{};
  for (final item in records) {
    if (item['name'] == null || item['name'] == '') continue;
    if (item['parentId'] != null) {
      children.putIfAbsent(item['parentId'], () => []).add(item);
    }
  }
  final descendants = <Object?, Set<String>>{};
  final visiting = <Object?>{};
  Set<String> collect(Map<String, dynamic> item) {
    final id = item['id'];
    if (descendants.containsKey(id)) return descendants[id]!;
    if (!visiting.add(id)) throw const FormatException('Cyclic account hierarchy');
    final names = <String>{};
    final ownName = _key(item['name']);
    if (ownName.isNotEmpty) names.add(ownName);
    for (final child in children[id] ?? const <Map<String, dynamic>>[]) {
      names.addAll(collect(child));
    }
    visiting.remove(id);
    descendants[id] = names;
    return names;
  }
  // The main implementation builds the whole tree first, even for unnamed accounts.
  for (final item in records) {
    collect(item);
  }
  final names = descendants[selected['id']] ?? {_key(selected['name'])};
  num initial = 0;
  for (final item in records) {
    if (item['id'] == selected['id'] || names.contains(_key(item['name']))) {
      initial += _numeric(item['initialBalance'], 'initialBalance', optional: true);
    }
  }
  num balance = initial, debits = 0, credits = 0;
  var count = 0;
  final group = selected['group'];
  final nameText = (selected['name'] ?? '').toString();
  final liquid = group == 'bank' || group == 'cash' || group == 'asset';
  const feeNames = {'هزینه کارمزد و بهره', 'کارمزد و بهره', 'کارمزد انتقال و خدمات بانکی',
    'کارمزد پوز و درگاه پرداخت', 'کارمزد بانکی'};

  for (final model in transactions) {
    final tx = model.toJson();
    var touched = false;
    final reversal = tx['isReversal'] == true;
    if (tx['isCompound'] == true) {
      for (final source in (tx['compoundSources'] as List? ?? const [])) {
        if (source is! Map || source['account'] == null || source['account'] == '' || !names.contains(_key(source['account']))) continue;
        final amount = _numeric(source['amount'], 'compoundSources.amount');
        touched = true;
        if (reversal) { debits += amount; } else { credits += amount; }
        if (liquid || group == 'person') {
          balance += (reversal ? 1 : -1) * amount;
        } else if (group == 'income') {
          balance += (reversal ? -1 : 1) * amount;
        }
        if (group == 'expense' && reversal) balance += amount;
      }
      for (final destination in (tx['compoundDestinations'] as List? ?? const [])) {
        if (destination is! Map || destination['account'] == null || destination['account'] == '' || !names.contains(_key(destination['account']))) continue;
        final amount = _numeric(destination['amount'], 'compoundDestinations.amount');
        touched = true;
        if (reversal) { credits += amount; } else { debits += amount; }
        if (liquid || group == 'person' || group == 'expense' || (group == 'income' && reversal)) {
          balance += (reversal ? -1 : 1) * amount;
        }
      }
      final fee = _numeric(tx['feeAmount'], 'feeAmount', optional: true);
      final feeAccount = _key(tx['feeAccount'] == null || tx['feeAccount'] == '' ? tx['account'] : tx['feeAccount']);
      if (liquid && fee > 0 && names.contains(feeAccount)) {
        balance -= (reversal ? -1 : 1) * fee;
        if (reversal) { debits += fee; } else { credits += fee; }
        touched = true;
      }
      if (touched) count++;
      continue;
    }

    final accountName = _key(tx['account']);
    final category = _key(tx['category']);
    final destination = _key(tx['destinationAccount']);
    final feeAccount = _key(tx['feeAccount']);
    final check = tx['check'] is Map ? tx['check'] as Map : null;
    final linkedBank = _key(check?['linkedBank']);
    final canceled = isCanceledLegacyCheck(tx);
    final amount = _numeric(tx['amount'], 'amount');
    final type = tx['type'];
    final fee = _numeric(tx['feeAmount'], 'feeAmount', optional: true);
    if (liquid) {
      final receivable = names.contains('اسناد دریافتنی') || nameText.contains('اسناد دریافتنی');
      if (receivable) {
        if (tx['method'] == 'check' && type == 'income' && check != null) {
          if (!canceled) { balance += amount; debits += amount; touched = true; }
          if (!canceled && check['status'] == 'cleared') { balance -= amount; credits += amount; touched = true; }
        }
      } else {
        if (type == 'income') {
          if (names.contains(accountName) && (check == null || check['status'] == 'cleared')) {
            balance += amount; debits += amount; touched = true;
          }
        } else if (type == 'expense') {
          if (names.contains(accountName) && (check == null || check['status'] == 'cleared')) {
            balance -= amount; credits += amount; touched = true;
          }
        } else if (type == 'transfer') {
          if (names.contains(accountName)) {
            balance += (reversal ? 1 : -1) * amount;
            if (reversal) { debits += amount; } else { credits += amount; }
            touched = true;
          }
          if (names.contains(destination)) {
            balance += (reversal ? -1 : 1) * amount;
            if (reversal) { credits += amount; } else { debits += amount; }
            touched = true;
          }
        }
        if (check != null && check['status'] == 'cleared' && linkedBank.isNotEmpty && names.contains(linkedBank)) {
          if (type == 'expense' && !names.contains(accountName)) {
            balance -= amount; credits += amount; touched = true;
          } else if (type == 'income' && !names.contains(accountName)) {
            balance += amount; debits += amount; touched = true;
          }
        }
      }
      if (fee > 0 && (reversal ? names.contains(feeAccount) :
          (names.contains(accountName) || (linkedBank.isNotEmpty && names.contains(linkedBank))))) {
        balance -= (reversal ? -1 : 1) * fee;
        if (reversal) { debits += fee; } else { credits += fee; }
        touched = true;
      }
    } else if (group == 'person') {
      if (type == 'expense' && !canceled && names.contains(category)) {
        balance += amount; debits += amount; touched = true;
      } else if (type == 'income' && !canceled && names.contains(category)) {
        balance -= amount; credits += amount; touched = true;
      } else if (type == 'transfer') {
        if (names.contains(accountName)) { balance -= amount; credits += amount; touched = true; }
        if (names.contains(destination)) { balance += amount; debits += amount; touched = true; }
      }
    } else if (group == 'expense') {
      if (type == 'expense' && !canceled && (names.contains(category) || names.contains(accountName))) {
        balance += amount; debits += amount; touched = true;
      } else if (type == 'income' && !canceled && (names.contains(category) || names.contains(accountName))) {
        balance -= amount; credits += amount; touched = true;
      }
      if (fee > 0 && ((feeAccount.isNotEmpty && names.contains(feeAccount)) || feeNames.any(names.contains))) {
        balance += (reversal ? -1 : 1) * fee;
        if (reversal) { credits += fee; } else { debits += fee; }
        touched = true;
      }
    } else if (group == 'income') {
      if (type == 'income' && !canceled && (names.contains(category) || names.contains(accountName))) {
        balance += amount; credits += amount; touched = true;
      } else if (type == 'expense' && !canceled && (names.contains(category) || names.contains(accountName))) {
        balance -= amount; debits += amount; touched = true;
      }
    } else if (group == 'liability') {
      final payable = names.contains('اسناد پرداختنی') || names.contains('چک ها و اسناد پرداختنی') || nameText.contains('اسناد پرداختنی');
      if (payable && tx['method'] == 'check' && type == 'expense' && check != null) {
        if (!canceled) { balance += amount; credits += amount; touched = true; }
        if (!canceled && check['status'] == 'cleared') { balance -= amount; debits += amount; touched = true; }
      } else if (names.contains(category) || names.contains(accountName) || names.contains(destination)) {
        if (type == 'expense') { balance -= amount; debits += amount; touched = true; }
        else if (type == 'income') { balance += amount; credits += amount; touched = true; }
      }
    } else if (group == 'equity') {
      if (names.contains(category) || names.contains(accountName)) {
        if (type == 'income') { balance += amount; credits += amount; touched = true; }
        else if (type == 'expense') { balance -= amount; debits += amount; touched = true; }
      }
    }
    if (touched) count++;
  }
  return AccountBalance(balance: balance, initialBalance: initial, totalDebits: debits,
      totalCredits: credits, transactionCount: count);
}
