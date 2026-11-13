import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/bank_data.dart';
import '../models/account_model.dart';
import '../models/transaction_model.dart';
import '../services/database_helper.dart';
import '../widgets/account_form_sheet.dart';

class AccountsScreen extends StatefulWidget {
  final VoidCallback? onAccountsChanged;

  const AccountsScreen({super.key, this.onAccountsChanged});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  List<Account> _accounts = [];
  List<TransactionModel> _transactions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final accs = await DatabaseHelper.instance.getAllAccounts();
    final txs = await DatabaseHelper.instance.getAllTransactions();
    if (mounted) {
      setState(() {
        _accounts = accs;
        _transactions = txs;
        _isLoading = false;
      });
      widget.onAccountsChanged?.call();
    }
  }

  double get _totalBalance => _accounts.fold(0.0, (sum, a) => sum + a.balance);

  String _formatMoney(double amount) {
    return NumberFormat('#,###', 'en_US').format(amount.toInt());
  }

  String _toPersianDigit(String input) {
    const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (int i = 0; i < english.length; i++) {
      input = input.replaceAll(english[i], farsi[i]);
    }
    return input;
  }

  void _openAddAccount() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AccountFormSheet(onSaved: _loadData),
    );
  }

  void _openEditAccount(Account account) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AccountFormSheet(
        accountToEdit: account,
        onSaved: _loadData,
      ),
    );
  }

  Future<void> _deleteAccount(Account account) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1917),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
            SizedBox(width: 8),
            Text('حذف حساب بانکی', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
          ],
        ),
        content: Text(
          'آیا از حذف حساب «${account.title}» مطمئن هستید؟ تمام تراکنش‌های وابسته به این حساب نیز حذف خواهند شد.',
          style: const TextStyle(fontSize: 13, color: Color(0xFFD6D3D1), height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('انصراف', style: TextStyle(color: Color(0xFFA8A29E))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('حذف شود'),
          ),
        ],
      ),
    );

    if (confirm == true && account.id != null) {
      await DatabaseHelper.instance.deleteAccount(account.id!);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('حساب «${account.title}» حذف شد', style: const TextStyle(fontFamily: 'Vazirmatn')),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showAccountStatement(Account account) {
    // تراکنش‌های این حساب
    final relatedTxs = _transactions.where(
      (t) => t.accountId == account.id || t.destinationAccountId == account.id,
    ).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Color(0xFF1C1917),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFF44403C),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: const Color(0xFF292524),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF38BDF8), size: 20),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'صورتحساب «${account.title}»',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                          ),
                          Text(
                            '${_toPersianDigit('${relatedTxs.length}')} گردش مالی ثبت‌شده',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF78716C)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFFA8A29E)),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF292524),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF44403C)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('مانده موجودی فعلی:', style: TextStyle(color: Color(0xFFA8A29E), fontSize: 12)),
                  Row(
                    children: [
                      Text(
                        _toPersianDigit(_formatMoney(account.balance)),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF10B981)),
                      ),
                      const SizedBox(width: 4),
                      const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFFA8A29E))),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFF292524)),
            Expanded(
              child: relatedTxs.isEmpty
                  ? const Center(
                      child: Text(
                        'هنوز هیچ گردشی برای این حساب ثبت نشده است.',
                        style: TextStyle(color: Color(0xFF78716C), fontSize: 12),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: relatedTxs.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFF292524)),
                      itemBuilder: (ctx, i) {
                        final tx = relatedTxs[i];
                        final isIncome = tx.type == TransactionType.income ||
                            (tx.type == TransactionType.transfer && tx.destinationAccountId == account.id);
                        final isExpense = tx.type == TransactionType.expense ||
                            (tx.type == TransactionType.transfer && tx.accountId == account.id && tx.destinationAccountId != account.id);

                        final color = isIncome ? const Color(0xFF10B981) : const Color(0xFFF43F5E);
                        final sign = isIncome ? '+' : '-';

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          leading: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              isIncome ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                              color: color,
                              size: 18,
                            ),
                          ),
                          title: Text(
                            tx.category,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          subtitle: Text(
                            _toPersianDigit(tx.shamsiDate) + (tx.description != null && tx.description!.isNotEmpty ? ' • ${tx.description}' : ''),
                            style: const TextStyle(fontSize: 11, color: Color(0xFF78716C)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '$sign${_toPersianDigit(_formatMoney(tx.amount))}',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color),
                              ),
                              const SizedBox(width: 4),
                              const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFF78716C))),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF141416),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C1917),
        elevation: 0,
        title: const Text(
          'مدیریت حساب‌ها و کارت‌ها',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            onPressed: _openAddAccount,
            icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF10B981)),
            tooltip: 'افزودن حساب جدید',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
          : RefreshIndicator(
              onRefresh: _loadData,
              color: const Color(0xFF10B981),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                children: [
                  // کارت دارایی کل
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F766E), Color(0xFF064E3B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withOpacity(0.15),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'مجموع موجودی حساب‌ها',
                              style: TextStyle(color: Color(0xFFCCFBF1), fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${_toPersianDigit('${_accounts.length}')} حساب فعال',
                                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              _toPersianDigit(_formatMoney(_totalBalance)),
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'تومان',
                              style: TextStyle(fontSize: 12, color: Color(0xFFCCFBF1), fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'معادل ${_toPersianDigit(_formatMoney(_totalBalance * 10))} ریال',
                          style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.75)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'فهرست کارت‌ها و حساب‌های بانکی',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFD6D3D1)),
                      ),
                      TextButton.icon(
                        onPressed: _openAddAccount,
                        icon: const Icon(Icons.add_rounded, size: 16, color: Color(0xFF10B981)),
                        label: const Text('کارت جدید', style: TextStyle(fontSize: 11, color: Color(0xFF10B981))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (_accounts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1C1917),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFF292524)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.credit_card_off_rounded, size: 44, color: Color(0xFF78716C)),
                          const SizedBox(height: 12),
                          const Text(
                            'هنوز هیچ حساب یا کارت بانکی تعریف نکرده‌اید',
                            style: TextStyle(color: Color(0xFFA8A29E), fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton.icon(
                            onPressed: _openAddAccount,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('تعریف اولین حساب'),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._accounts.map((acc) {
                      BankItem? bank;
                      try {
                        bank = BankData.findByKey(acc.bankName ?? '') ??
                            BankData.allBanks.firstWhere(
                              (b) => b.name == acc.bankName || b.key == acc.bankName || b.name == acc.title,
                            );
                      } catch (_) {
                        bank = null;
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1C1917),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF292524)),
                        ),
                        child: Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF292524),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: bank != null
                                        ? bank.buildLogo(size: 36)
                                        : const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF38BDF8), size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          acc.title,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                                        ),
                                        const SizedBox(height: 4),
                                        if (acc.cardNumber != null && acc.cardNumber!.isNotEmpty)
                                          Text(
                                            _toPersianDigit(acc.cardNumber!),
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFFA8A29E),
                                              fontFamily: 'monospace',
                                              letterSpacing: 1,
                                            ),
                                          )
                                        else if (acc.accountNumber != null && acc.accountNumber!.isNotEmpty)
                                          Text(
                                            'حساب: ${_toPersianDigit(acc.accountNumber!)}',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
                                          )
                                        else
                                          Text(
                                            bank?.name ?? 'حساب نقدی / صندوق',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF78716C)),
                                          ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        _toPersianDigit(_formatMoney(acc.balance)),
                                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                                      ),
                                      const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFF78716C))),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const Divider(height: 1, color: Color(0xFF292524)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  TextButton.icon(
                                    onPressed: () => _showAccountStatement(acc),
                                    icon: const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFF38BDF8)),
                                    label: const Text('صورتحساب', style: TextStyle(fontSize: 11, color: Color(0xFF38BDF8))),
                                  ),
                                  TextButton.icon(
                                    onPressed: () => _openEditAccount(acc),
                                    icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFFFBBF24)),
                                    label: const Text('ویرایش', style: TextStyle(fontSize: 11, color: Color(0xFFFBBF24))),
                                  ),
                                  TextButton.icon(
                                    onPressed: () => _deleteAccount(acc),
                                    icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFEF4444)),
                                    label: const Text('حذف', style: TextStyle(fontSize: 11, color: Color(0xFFEF4444))),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
