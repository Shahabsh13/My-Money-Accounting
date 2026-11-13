import '../models/legacy_account.dart';
import '../models/legacy_transaction.dart';
import 'account_balance.dart';
import 'report_split.dart';

/// Translation of summarizeReports in main's src/domain/reports.js. This is
/// limited to numeric legacy data and does not read or alter the app database.
Map<String, Object> summarizeLegacyReports(
  List<LegacyTransaction> transactions,
  List<LegacyAccount> accounts,
  List<Map<String, dynamic>> installments,
) {
  final accountRecords = accounts.map((account) => account.toJson()).toList();
  final transactionRecords = transactions.map((tx) => tx.toJson()).toList();
  num totalIncome = 0, totalExpense = 0;
  for (final tx in transactionRecords) {
    final split = splitTransaction(tx, accountRecords, allTransactions: transactionRecords);
    totalIncome += split.income;
    totalExpense += split.expense;
  }

  num liquidAssets = 0, receivables = 0, payables = 0;
  final liquidBalances = <String, num>{};
  final personBalances = <String, Map<String, Object>>{};
  for (final account in accounts) {
    // Stored account.active in the legacy format is a boolean.
    if (account.active != true) continue;
    final group = account.group;
    if (group != 'bank' && group != 'cash' && group != 'person') continue;
    if (account.name is! String) throw const FormatException('Expected an account name');
    final name = account.name as String;
    final balance = calculateLegacyAccountBalance(account, accounts, transactions).balance;
    if (group == 'bank' || group == 'cash') {
      liquidBalances[name] = balance;
      liquidAssets += balance;
    } else if (balance > 0) {
      receivables += balance;
      personBalances[name] = {'balance': balance, 'status': 'debtor'};
    } else if (balance < 0) {
      payables += balance.abs();
      personBalances[name] = {'balance': balance, 'status': 'creditor'};
    } else {
      personBalances[name] = {'balance': 0, 'status': 'settled'};
    }
  }

  const inProgress = {'in_progress', 'received', 'issued', 'in_bank'};
  for (final tx in transactionRecords) {
    final check = tx['check'];
    if (tx['method'] != 'check' || check is! Map || !inProgress.contains(check['status'])) continue;
    final amount = tx['amount'];
    if (amount is! num || !amount.isFinite) {
      throw const FormatException('Expected a finite numeric check amount');
    }
    if (tx['type'] == 'income') {
      receivables += amount;
    } else if (tx['type'] == 'expense') {
      payables += amount;
    }
  }

  num remainingInstallments = 0;
  for (final installment in installments) {
    if (installment['status'] != 'pending' && installment['status'] != 'overdue') continue;
    final amount = installment['amount'];
    if (amount is! num || !amount.isFinite) {
      throw const FormatException('Expected a finite numeric installment amount');
    }
    remainingInstallments += amount;
  }
  return {
    'totalIncome': totalIncome,
    'totalExpense': totalExpense,
    'netSavings': totalIncome - totalExpense,
    'totalLiquidAssets': liquidAssets,
    'liquidBalances': liquidBalances,
    'totalReceivables': receivables,
    'totalPayables': payables,
    'personBalances': personBalances,
    'totalRemainingInstallments': remainingInstallments,
    'totalNetWorth': liquidAssets + receivables - (payables + remainingInstallments),
  };
}
