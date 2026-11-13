import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../domain/numbers.dart' as numbers;
import '../models/account_model.dart';
import '../models/transaction_model.dart';
import '../services/database_helper.dart';

class TransactionsScreen extends StatefulWidget {
  final VoidCallback? onDataChanged;

  const TransactionsScreen({super.key, this.onDataChanged});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  List<TransactionModel> _allTransactions = [];
  List<Account> _accounts = [];
  bool _isLoading = true;

  String _searchQuery = '';
  String _selectedFilter = 'all'; // all, expense, income, transfer

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final txs = await DatabaseHelper.instance.getAllTransactions();
    final accs = await DatabaseHelper.instance.getAllAccounts();
    setState(() {
      _allTransactions = txs;
      _accounts = accs;
      _isLoading = false;
    });
  }

  String _toPersianDigit(String input) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    String res = input;
    for (int i = 0; i < 10; i++) {
      res = res.replaceAll('$i', farsiDigits[i]);
    }
    return res;
  }

  String _formatMoney(double amount) {
    // Signs in this screen are rendered separately from the amount.
    return numbers.formatAmount(amount.abs());
  }

  String _getCategoryEmoji(String category) {
    final cat = category.toLowerCase();
    if (cat.contains('سوپر') || cat.contains('خرید') || cat.contains('مواد')) return '🛒';
    if (cat.contains('رستوران') || cat.contains('غذا') || cat.contains('کافه')) return '🍕';
    if (cat.contains('بنزین') || cat.contains('خودرو') || cat.contains('ماشین') || cat.contains('تاکسی')) return '🚗';
    if (cat.contains('حقوق') || cat.contains('دستمزد') || cat.contains('پاداش')) return '💵';
    if (cat.contains('درمان') || cat.contains('پزشک') || cat.contains('دارو')) return '🏥';
    if (cat.contains('اجاره') || cat.contains('خانه') || cat.contains('قبض')) return '🏠';
    if (cat.contains('پوشاک') || cat.contains('لباس')) return '👔';
    if (cat.contains('شارژ') || cat.contains('اینترنت') || cat.contains('موبایل')) return '📱';
    if (cat.contains('هدیه') || cat.contains('کادو')) return '🎁';
    if (cat.contains('انتقال') || cat.contains('کارت')) return '🔄';
    return '📝';
  }

  List<TransactionModel> get _filteredTransactions {
    return _allTransactions.where((tx) {
      if (_selectedFilter == 'expense' && tx.type != TransactionType.expense) return false;
      if (_selectedFilter == 'income' && tx.type != TransactionType.income) return false;
      if (_selectedFilter == 'transfer' && tx.type != TransactionType.transfer) return false;

      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.trim().toLowerCase();
        final acc = _accounts.firstWhere(
          (a) => a.id == tx.accountId,
          orElse: () => Account(title: '', balance: 0),
        );
        final matchCategory = tx.category.toLowerCase().contains(q);
        final matchDesc = (tx.description ?? '').toLowerCase().contains(q);
        final matchAcc = acc.title.toLowerCase().contains(q);
        final matchAmount = tx.amount.toInt().toString().contains(q);

        if (!matchCategory && !matchDesc && !matchAcc && !matchAmount) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  Map<String, List<TransactionModel>> get _groupedTransactions {
    final map = <String, List<TransactionModel>>{};
    for (var tx in _filteredTransactions) {
      final dateKey = tx.shamsiDate.isNotEmpty ? tx.shamsiDate : 'نامشخص';
      map.putIfAbsent(dateKey, () => []).add(tx);
    }
    return map;
  }

  double _calculateDayNet(List<TransactionModel> list) {
    double total = 0.0;
    for (var tx in list) {
      if (tx.type == TransactionType.income) {
        total += tx.amount;
      } else if (tx.type == TransactionType.expense) {
        total -= tx.amount;
      }
    }
    return total;
  }

  String _formatDayTitle(String shamsiDate) {
    if (shamsiDate == 'نامشخص') return 'تاریخ نامشخص';
    try {
      final now = Jalali.now();
      final todayStr = '${now.year}/${now.month.toString().padLeft(2, '0')}/${now.day.toString().padLeft(2, '0')}';
      final yesterday = now.addDays(-1);
      final yesterdayStr = '${yesterday.year}/${yesterday.month.toString().padLeft(2, '0')}/${yesterday.day.toString().padLeft(2, '0')}';

      if (shamsiDate == todayStr) {
        return 'امروز • ${_toPersianDigit(shamsiDate)}';
      } else if (shamsiDate == yesterdayStr) {
        return 'دیروز • ${_toPersianDigit(shamsiDate)}';
      }
    } catch (_) {}
    return _toPersianDigit(shamsiDate);
  }

  void _confirmDelete(TransactionModel tx) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1917),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF292524)),
        ),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFFB7185), size: 24),
            SizedBox(width: 8),
            Text('حذف سند مالی', style: TextStyle(fontSize: 16, color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'آیا از حذف تراکنش «${tx.category}» به مبلغ ${_formatMoney(tx.amount)} تومان اطمینان دارید؟\n\nاثر مالی این تراکنش از مانده حساب به طور خودکار برگشت داده خواهد شد.',
          style: const TextStyle(fontSize: 13, color: Color(0xFFA8A29E), height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('انصراف', style: TextStyle(color: Color(0xFFA8A29E))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF43F5E),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await _deleteTransaction(tx);
            },
            child: const Text('حذف سند'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteTransaction(TransactionModel tx) async {
    if (tx.id != null) {
      await DatabaseHelper.instance.deleteTransaction(tx.id!);
      await _loadData();
      widget.onDataChanged?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF1C1917),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: Color(0xFF10B981)),
            ),
            content: const Text(
              'سند مالی حذف و موجودی حساب به‌روزرسانی شد.',
              style: TextStyle(color: Colors.white, fontSize: 13),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupedTransactions;
    final keys = groups.keys.toList();

    return Scaffold(
      backgroundColor: const Color(0xFF141416),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'دفتر تراکنش‌ها و اسناد',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 2),
            Text(
              '${_toPersianDigit(_filteredTransactions.length.toString())} سند مالی ثبت‌شده',
              style: const TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF141416),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
          : Column(
              children: [
                // کادر جستجو
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: TextField(
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'جستجو در دسته‌بندی، حساب، شرح یا مبلغ...',
                      hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 13),
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFFA8A29E)),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: Color(0xFFA8A29E)),
                              onPressed: () => setState(() => _searchQuery = ''),
                            )
                          : null,
                      filled: true,
                      fillColor: const Color(0xFF1C1917),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF292524)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF10B981)),
                      ),
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val),
                  ),
                ),

                // نوار فیلتر سریع
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Row(
                    children: [
                      _buildFilterChip('all', 'همه اسناد', Icons.list_alt_rounded),
                      const SizedBox(width: 8),
                      _buildFilterChip('expense', 'پرداخت‌ها (هزینه)', Icons.arrow_upward_rounded),
                      const SizedBox(width: 8),
                      _buildFilterChip('income', 'دریافت‌ها (درآمد)', Icons.arrow_downward_rounded),
                      const SizedBox(width: 8),
                      _buildFilterChip('transfer', 'انتقال‌ها', Icons.swap_horiz_rounded),
                    ],
                  ),
                ),

                const SizedBox(height: 6),
                const Divider(height: 1, color: Color(0xFF292524)),

                // لیست تراکنش‌های گروه‌بندی شده
                Expanded(
                  child: _filteredTransactions.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.receipt_long_outlined, size: 48, color: const Color(0xFF44403C)),
                              const SizedBox(height: 12),
                              const Text(
                                'تراکنشی یافت نشد',
                                style: TextStyle(color: Color(0xFFA8A29E), fontSize: 14),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                          itemCount: keys.length,
                          itemBuilder: (context, gIndex) {
                            final dateKey = keys[gIndex];
                            final list = groups[dateKey]!;
                            final dayNet = _calculateDayNet(list);
                            final isPositive = dayNet >= 0;

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // سربرگ روز
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  margin: EdgeInsets.only(top: gIndex == 0 ? 0 : 16, bottom: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1C1917),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFF292524)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _formatDayTitle(dateKey),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          color: Color(0xFFF5F5F4),
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          const Text(
                                            'تراز روز: ',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF78716C)),
                                          ),
                                          Text(
                                            '${isPositive ? '+' : '-'}${_formatMoney(dayNet)} تومان',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                              color: isPositive ? const Color(0xFF34D399) : const Color(0xFFFB7185),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),

                                // کارت‌های تراکنش
                                ...list.map((tx) => _buildTransactionCard(tx)),
                              ],
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildFilterChip(String key, String label, IconData icon) {
    final isSelected = _selectedFilter == key;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = key),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFF1C1917),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF10B981) : const Color(0xFF292524),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? const Color(0xFF34D399) : const Color(0xFFA8A29E),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? const Color(0xFF34D399) : const Color(0xFFA8A29E),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionCard(TransactionModel tx) {
    final isExpense = tx.type == TransactionType.expense;
    final isIncome = tx.type == TransactionType.income;

    final color = isExpense
        ? const Color(0xFFFB7185)
        : (isIncome ? const Color(0xFF34D399) : const Color(0xFF38BDF8));

    final prefix = isExpense ? '-' : (isIncome ? '+' : '');

    final acc = _accounts.firstWhere(
      (a) => a.id == tx.accountId,
      orElse: () => Account(title: 'حساب نامشخص', balance: 0),
    );

    String subInfo = acc.title;
    if (tx.type == TransactionType.transfer && tx.destinationAccountId != null) {
      final dst = _accounts.firstWhere(
        (a) => a.id == tx.destinationAccountId,
        orElse: () => Account(title: 'مقصد نامشخص', balance: 0),
      );
      subInfo = '${acc.title} ➔ ${dst.title}';
    }

    final emoji = _getCategoryEmoji(tx.category);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1917),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF292524)),
      ),
      child: Row(
        children: [
          // آیکون / اموجی
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            alignment: Alignment.center,
            child: Text(
              emoji,
              style: const TextStyle(fontSize: 18),
            ),
          ),
          const SizedBox(width: 12),

          // اطلاعات میانی
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.category,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFFF5F5F4),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subInfo,
                  style: const TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
                ),
                if (tx.description != null && tx.description!.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    tx.description!,
                    style: const TextStyle(fontSize: 10, color: Color(0xFF78716C)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),

          // مبلغ و دکمه حذف
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$prefix${_formatMoney(tx.amount)} تومان',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
              InkWell(
                onTap: () => _confirmDelete(tx),
                borderRadius: BorderRadius.circular(6),
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFF78716C)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
