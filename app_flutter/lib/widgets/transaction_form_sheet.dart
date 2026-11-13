import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../data/default_categories.dart';
import '../models/account_model.dart';
import '../models/transaction_model.dart';
import '../services/database_helper.dart';

// تبدیل اعداد به حروف فارسی
String numberToPersianWords(int number) {
  if (number == 0) return 'صفر تومان';
  if (number < 0) return 'منفی ' + numberToPersianWords(-number);

  final yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  final dahgan = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  final dahYek = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  final sadgan = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  final tabaghat = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  String threeDigitsToWords(int n) {
    if (n == 0) return '';
    int s = n ~/ 100;
    int d = (n % 100) ~/ 10;
    int y = n % 10;

    List<String> parts = [];
    if (s > 0) parts.add(sadgan[s]);

    if (d == 1) {
      parts.add(dahYek[y]);
    } else {
      if (d > 1) parts.add(dahgan[d]);
      if (y > 0) parts.add(yekan[y]);
    }

    return parts.join(' و ');
  }

  List<String> resultParts = [];
  int level = 0;
  int temp = number;

  while (temp > 0) {
    int chunk = temp % 1000;
    if (chunk > 0) {
      String chunkStr = threeDigitsToWords(chunk);
      if (level > 0 && chunkStr.isNotEmpty) {
        chunkStr += ' ' + tabaghat[level];
      }
      resultParts.insert(0, chunkStr);
    }
    temp ~/= 1000;
    level++;
  }

  return resultParts.join(' و ') + ' تومان';
}

class TransactionFormSheet extends StatefulWidget {
  final VoidCallback onSaved;
  final TransactionType initialType;

  const TransactionFormSheet({
    super.key,
    required this.onSaved,
    this.initialType = TransactionType.expense,
  });

  @override
  State<TransactionFormSheet> createState() => _TransactionFormSheetState();
}

class _TransactionFormSheetState extends State<TransactionFormSheet> {
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _checkNumberController = TextEditingController();
  final _sayadIdController = TextEditingController();
  final _feeController = TextEditingController();

  late TransactionType _type;
  bool _isCheckMode = false;
  bool _hasFee = false;

  String _shamsiDate = '';
  DateTime _gregorianDate = DateTime.now();

  String _checkDueDate = '';
  DateTime? _checkDueDateTime;

  CategoryItem? _selectedCategory;
  Account? _selectedSourceAccount;
  Account? _selectedDestinationAccount;

  List<Account> _accounts = [];
  bool _isLoadingAccounts = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _type = widget.initialType;
    final nowJalali = Jalali.now();
    _shamsiDate = '${nowJalali.year}/${nowJalali.month.toString().padLeft(2, '0')}/${nowJalali.day.toString().padLeft(2, '0')}';
    _loadAccounts();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    _checkNumberController.dispose();
    _sayadIdController.dispose();
    _feeController.dispose();
    super.dispose();
  }

  Future<void> _loadAccounts() async {
    try {
      final accs = await DatabaseHelper.instance.getAllAccounts();
      if (!mounted) return;
      setState(() {
        _accounts = accs;
        _isLoadingAccounts = false;
        if (accs.isNotEmpty) {
          _selectedSourceAccount = accs.first;
          if (accs.length > 1) {
            _selectedDestinationAccount = accs[1];
          }
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingAccounts = false);
      }
    }
  }

  String _formatNumber(String s) {
    String clean = s.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.isEmpty) return '';
    return clean.replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  int get _amountValue {
    String clean = _amountController.text.replaceAll(',', '').trim();
    return int.tryParse(clean) ?? 0;
  }

  Color get _themeColor {
    switch (_type) {
      case TransactionType.expense:
        return const Color(0xFFF43F5E); // رز/قرمز
      case TransactionType.income:
        return const Color(0xFF10B981); // زمردی/سبز
      case TransactionType.transfer:
        return const Color(0xFF38BDF8); // آبی روشن
    }
  }

  String get _titleText {
    switch (_type) {
      case TransactionType.expense:
        return _isCheckMode ? 'ثبت چک پرداختی' : 'ثبت پرداخت (هزینه)';
      case TransactionType.income:
        return _isCheckMode ? 'ثبت چک دریافتی' : 'ثبت دریافت (درآمد)';
      case TransactionType.transfer:
        return 'ثبت انتقال وجه بین حساب‌ها';
    }
  }

  String get _subtitleText {
    switch (_type) {
      case TransactionType.expense:
        return 'کسر وجه از بانک یا صندوق و ثبت در سرفصل هزینه‌ها';
      case TransactionType.income:
        return 'واریز وجه به بانک یا صندوق از محل سرفصل درآمدهای تعریف‌شده';
      case TransactionType.transfer:
        return 'جابجایی و انتقال مبالغ بدون تغییر در تراز کل دارایی';
    }
  }

  Future<void> _pickDate() async {
    final nowJalali = Jalali.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _gregorianDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      helpText: 'انتخاب تاریخ تراکنش',
      cancelText: 'انصراف',
      confirmText: 'تأیید',
    );
    if (picked != null) {
      final j = Jalali.fromDateTime(picked);
      setState(() {
        _gregorianDate = picked;
        _shamsiDate = '${j.year}/${j.month.toString().padLeft(2, '0')}/${j.day.toString().padLeft(2, '0')}';
      });
    }
  }

  void _addMonthsToCheckDue(int months) {
    final now = Jalali.now();
    int newMonth = now.month + months;
    int newYear = now.year;
    while (newMonth > 12) {
      newMonth -= 12;
      newYear += 1;
    }
    setState(() {
      _checkDueDate = '$newYear/${newMonth.toString().padLeft(2, '0')}/${now.day.toString().padLeft(2, '0')}';
    });
  }

  void _openCategoryPicker() {
    final isExpense = _type == TransactionType.expense;
    final targetGroup = isExpense ? 'expense' : 'income';
    final categories = DefaultCategories.all.where((c) => c.group == targetGroup && !c.isHeader).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1C1917),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final filtered = categories.where((c) {
              return c.name.contains(query) || (c.parentName?.contains(query) ?? false);
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFF57534E),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.category_outlined, color: _themeColor, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        isExpense ? 'انتخاب سرفصل هزینه (بابت)' : 'انتخاب سرفصل درآمد (بابت)',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (val) => setSheetState(() => query = val.trim()),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'جستجوی سرفصل (مثلاً: سوپرمارکت، اجاره، حقوق)...',
                      hintStyle: TextStyle(color: const Color(0xFF78716C), fontSize: 12),
                      prefixIcon: Icon(Icons.search, color: const Color(0xFFA8A29E), size: 20),
                      filled: true,
                      fillColor: const Color(0xFF292524),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: const Color(0xFF44403C)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Text(
                              'سرفصلی با این نام یافت نشد',
                              style: TextStyle(color: const Color(0xFF78716C), fontSize: 12),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => Divider(color: const Color(0xFF292524), height: 1),
                            itemBuilder: (_, i) {
                              final cat = filtered[i];
                              final isSelected = _selectedCategory?.id == cat.id;
                              return ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                leading: Container(
                                  width: 36,
                                  height: 36,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF292524),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(cat.icon, style: const TextStyle(fontSize: 18)),
                                ),
                                title: Text(
                                  cat.name,
                                  style: TextStyle(
                                    color: isSelected ? _themeColor : Colors.white,
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                                subtitle: cat.parentName != null
                                    ? Text(
                                        'دسته: ${cat.parentName}',
                                        style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 10),
                                      )
                                    : null,
                                trailing: Text(
                                  cat.code,
                                  style: TextStyle(color: const Color(0xFF78716C), fontSize: 10, fontFamily: 'monospace'),
                                ),
                                onTap: () {
                                  setState(() => _selectedCategory = cat);
                                  Navigator.pop(ctx);
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _openAccountPicker({required bool isSource}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1C1917),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF57534E),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                isSource ? 'انتخاب حساب پرداخت (بانک / صندوق)' : 'انتخاب حساب واریز (بانک / صندوق)',
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              ..._accounts.map((acc) {
                final isSelected = isSource
                    ? _selectedSourceAccount?.id == acc.id
                    : _selectedDestinationAccount?.id == acc.id;
                return ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFF292524),
                    child: const Icon(Icons.account_balance_wallet, color: Colors.amber, size: 18),
                  ),
                  title: Text(
                    acc.title,
                    style: TextStyle(
                      color: isSelected ? _themeColor : Colors.white,
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  subtitle: Text(
                    'موجودی: ${acc.balance.toInt().toString().replaceAllMapped(RegExp(r"(\\d{1,3})(?=(\\d{3})+(?!\\d))"), (m) => "${m[1]},")} تومان',
                    style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                  ),
                  trailing: isSelected ? Icon(Icons.check, color: _themeColor, size: 20) : null,
                  onTap: () {
                    setState(() {
                      if (isSource) {
                        _selectedSourceAccount = acc;
                      } else {
                        _selectedDestinationAccount = acc;
                      }
                    });
                    Navigator.pop(ctx);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submit() async {
    final amount = _amountValue;
    if (amount <= 0) {
      setState(() => _errorMessage = 'لطفاً مبلغ تراکنش را وارد فرمایید.');
      return;
    }

    if (_type != TransactionType.transfer && _selectedCategory == null) {
      setState(() => _errorMessage = 'لطفاً سرفصل حسابداری (بابت) را انتخاب نمایید.');
      return;
    }

    if (_selectedSourceAccount == null) {
      setState(() => _errorMessage = 'لطفاً حساب بانک یا صندوق را مشخص کنید.');
      return;
    }

    if (_type == TransactionType.transfer) {
      if (_selectedDestinationAccount == null) {
        setState(() => _errorMessage = 'لطفاً حساب مقصد انتقال را انتخاب نمایید.');
        return;
      }
      if (_selectedSourceAccount?.id == _selectedDestinationAccount?.id) {
        setState(() => _errorMessage = 'حساب مبدأ و مقصد انتقال نمی‌توانند یکسان باشند.');
        return;
      }
    }

    setState(() => _errorMessage = null);

    String finalDesc = _descriptionController.text.trim();
    if (_isCheckMode) {
      final num = _checkNumberController.text.trim();
      final due = _checkDueDate.trim();
      final sayad = _sayadIdController.text.trim();
      String checkInfo = 'چک صیادی';
      if (num.isNotEmpty) checkInfo += ' شماره $num';
      if (due.isNotEmpty) checkInfo += ' سررسید $due';
      if (sayad.isNotEmpty) checkInfo += ' صیاد $sayad';
      finalDesc = finalDesc.isEmpty ? checkInfo : '$finalDesc ($checkInfo)';
    }

    final tx = TransactionModel(
      amount: amount.toDouble(),
      type: _type,
      accountId: _selectedSourceAccount!.id!,
      destinationAccountId: _type == TransactionType.transfer ? _selectedDestinationAccount?.id : null,
      category: _type == TransactionType.transfer ? 'انتقال وجه' : (_selectedCategory?.name ?? 'عمومی'),
      dateTime: _gregorianDate,
      shamsiDate: _shamsiDate,
      description: finalDesc,
    );

    await DatabaseHelper.instance.insertTransaction(tx);
    widget.onSaved();
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = _amountValue;
    final words = numberToPersianWords(amount);

    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: Color(0xFF141210),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // دستگیره بالا
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFF44403C),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // هدر اصلی با شماره سند و دکمه بستن
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70, size: 22),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'بستن',
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            _titleText,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.withOpacity(0.15),
                              border: Border.all(color: Colors.amber.withOpacity(0.3)),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'سند جدید',
                              style: TextStyle(
                                color: Colors.amber,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _subtitleText,
                        style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Divider(color: const Color(0xFF292524), height: 1),

          // محتوای اسکرول‌پذیر
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // انتخاب نوع تراکنش (۳ تب طبق سورس)
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1917),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF292524)),
                  ),
                  child: Row(
                    children: [
                      _buildTypeTab(
                        type: TransactionType.expense,
                        label: 'پرداخت',
                        icon: Icons.arrow_upward_rounded,
                        color: const Color(0xFFF43F5E),
                      ),
                      _buildTypeTab(
                        type: TransactionType.income,
                        label: 'دریافت',
                        icon: Icons.arrow_downward_rounded,
                        color: const Color(0xFF10B981),
                      ),
                      _buildTypeTab(
                        type: TransactionType.transfer,
                        label: 'انتقال',
                        icon: Icons.swap_horiz_rounded,
                        color: const Color(0xFF38BDF8),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // انتخاب حالت عادی / چک صیادی
                if (_type != TransactionType.transfer)
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1C1917),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF292524)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _isCheckMode = false),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: !_isCheckMode ? const Color(0xFF292524) : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                'عادی (نقد / واریز بانکی)',
                                style: TextStyle(
                                  color: !_isCheckMode ? Colors.white : const Color(0xFFA8A29E),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _isCheckMode = true),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _isCheckMode ? Colors.amber.shade600 : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.receipt_long,
                                    size: 14,
                                    color: _isCheckMode ? Colors.black : Colors.amber,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'چک صیادی',
                                    style: TextStyle(
                                      color: _isCheckMode ? Colors.black : Colors.amber,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                const SizedBox(height: 16),

                // کارت بزرگ مبلغ (مطابق سورس)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1917),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _errorMessage != null && amount <= 0 ? Colors.red.shade400 : const Color(0xFF292524),
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.monetization_on_outlined, size: 16, color: _themeColor),
                          const SizedBox(width: 6),
                          Text(
                            _isCheckMode ? 'مبلغ چک' : 'مبلغ تراکنش',
                            style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: TextField(
                              controller: _amountController,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                              ),
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                              decoration: InputDecoration(
                                hintText: '۰',
                                hintStyle: TextStyle(color: const Color(0xFF44403C), fontSize: 32),
                                border: InputBorder.none,
                                isDense: true,
                              ),
                              onChanged: (val) {
                                String formatted = _formatNumber(val);
                                if (formatted != val) {
                                  _amountController.value = TextEditingValue(
                                    text: formatted,
                                    selection: TextSelection.collapsed(offset: formatted.length),
                                  );
                                }
                                setState(() {});
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'تومان',
                            style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      if (amount > 0) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF292524),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            words,
                            style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // بخش مسیر حساب‌ها (طبق سورس 067-inline.js)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1917),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF292524)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.alt_route_rounded, color: Color(0xFF10B981), size: 18),
                          const SizedBox(width: 6),
                          const Text(
                            'مسیر حساب‌ها',
                            style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // حساب ۱ (بابت سرفصل یا حساب مبدأ)
                      Text(
                        _type == TransactionType.expense
                            ? 'سرفصل هزینه (بابت):'
                            : _type == TransactionType.income
                                ? 'سرفصل درآمد (بابت):'
                                : 'از حساب (مبدأ انتقال):',
                        style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                      ),
                      const SizedBox(height: 6),
                      if (_type == TransactionType.transfer)
                        _buildAccountSelectorBox(
                          account: _selectedSourceAccount,
                          onTap: () => _openAccountPicker(isSource: true),
                          placeholder: 'انتخاب حساب مبدأ...',
                        )
                      else
                        _buildCategorySelectorBox(),

                      const SizedBox(height: 12),

                      // حساب ۲ (بانک/صندوق یا حساب مقصد)
                      Text(
                        _type == TransactionType.expense
                            ? 'پرداخت از (بانک / صندوق):'
                            : _type == TransactionType.income
                                ? 'واریز به (بانک / صندوق):'
                                : 'به حساب (مقصد انتقال):',
                        style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                      ),
                      const SizedBox(height: 6),
                      _buildAccountSelectorBox(
                        account: _type == TransactionType.transfer ? _selectedDestinationAccount : _selectedSourceAccount,
                        onTap: () => _openAccountPicker(isSource: _type != TransactionType.transfer),
                        placeholder: _type == TransactionType.transfer ? 'انتخاب حساب مقصد...' : 'انتخاب بانک یا صندوق...',
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // بخش مشخصات چک صیادی (در صورت فعال بودن)
                if (_isCheckMode && _type != TransactionType.transfer) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1C1917),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.amber.withOpacity(0.35)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.receipt_long, color: Colors.amber, size: 18),
                            const SizedBox(width: 6),
                            const Text(
                              'مشخصات برگه چک صیادی',
                              style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // تاریخ سررسید چک
                        Text('تاریخ سررسید (موعد پاس‌شدن / وصول):', style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11)),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF292524),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF44403C)),
                                ),
                                child: Text(
                                  _checkDueDate.isEmpty ? 'تاریخ سررسید انتخاب نشده' : 'سررسید: $_checkDueDate',
                                  style: TextStyle(
                                    color: _checkDueDate.isEmpty ? const Color(0xFF78716C) : Colors.white,
                                    fontSize: 12,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            _buildQuickMonthButton('+۱ ماه', () => _addMonthsToCheckDue(1)),
                            const SizedBox(width: 6),
                            _buildQuickMonthButton('+۲ ماه', () => _addMonthsToCheckDue(2)),
                            const SizedBox(width: 6),
                            _buildQuickMonthButton('+۳ ماه', () => _addMonthsToCheckDue(3)),
                            const SizedBox(width: 6),
                            _buildQuickMonthButton('+۶ ماه', () => _addMonthsToCheckDue(6)),
                          ],
                        ),

                        const SizedBox(height: 12),

                        // شماره سریال چک
                        TextField(
                          controller: _checkNumberController,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
                          decoration: InputDecoration(
                            labelText: 'شماره برگ چک',
                            labelStyle: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                            filled: true,
                            fillColor: const Color(0xFF292524),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: const Color(0xFF44403C)),
                            ),
                          ),
                        ),

                        const SizedBox(height: 10),

                        // شناسه ۱۶ رقمی صیاد
                        TextField(
                          controller: _sayadIdController,
                          maxLength: 16,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace', letterSpacing: 2),
                          decoration: InputDecoration(
                            labelText: 'شناسه ۱۶ رقمی صیادی (اختیاری)',
                            labelStyle: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                            counterText: '',
                            filled: true,
                            fillColor: const Color(0xFF292524),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: const Color(0xFF44403C)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // تاریخ سند و توضیحات
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1917),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF292524)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // تاریخ شمسی
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.calendar_today, color: Colors.amber, size: 16),
                              const SizedBox(width: 6),
                              const Text('تاریخ سند:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          InkWell(
                            onTap: _pickDate,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF292524),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF44403C)),
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    _shamsiDate,
                                    style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(Icons.edit_calendar, size: 14, color: const Color(0xFFA8A29E)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // شرح / توضیحات
                      TextField(
                        controller: _descriptionController,
                        maxLines: 2,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: InputDecoration(
                          hintText: 'شرح / توضیحات اختیاری سند...',
                          hintStyle: TextStyle(color: const Color(0xFF78716C), fontSize: 11),
                          filled: true,
                          fillColor: const Color(0xFF292524),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: const Color(0xFF44403C)),
                          ),
                        ),
                      ),

                      const SizedBox(height: 12),

                      // کارمزد عملیات
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.receipt, color: const Color(0xFFA8A29E), size: 16),
                              const SizedBox(width: 6),
                              const Text(
                                'این عملیات کارمزد دارد',
                                style: TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                          Switch(
                            value: _hasFee,
                            activeColor: const Color(0xFF10B981),
                            onChanged: (v) => setState(() => _hasFee = v),
                          ),
                        ],
                      ),
                      if (_hasFee) ...[
                        const SizedBox(height: 8),
                        TextField(
                          controller: _feeController,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
                          decoration: InputDecoration(
                            hintText: 'مبلغ کارمزد بانکی (تومان)...',
                            hintStyle: TextStyle(color: const Color(0xFF78716C), fontSize: 11),
                            filled: true,
                            fillColor: const Color(0xFF292524),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: const Color(0xFF44403C)),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.15),
                      border: Border.all(color: Colors.red.withOpacity(0.4)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.redAccent, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // دکمه بزرگ ثبت نهایی
                ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _themeColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 4,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.check_circle_outline, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        _titleText,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeTab({
    required TransactionType type,
    required String label,
    required IconData icon,
    required Color color,
  }) {
    final isSelected = _type == type;
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _type = type;
            _selectedCategory = null;
          });
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? color : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isSelected ? color : const Color(0xFFA8A29E)),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? color : const Color(0xFFA8A29E),
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategorySelectorBox() {
    return InkWell(
      onTap: _openCategoryPicker,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF292524),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _errorMessage != null && _selectedCategory == null
                ? Colors.red.shade400
                : const Color(0xFF44403C),
          ),
        ),
        child: Row(
          children: [
            if (_selectedCategory != null) ...[
              Text(_selectedCategory!.icon, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedCategory!.name,
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    if (_selectedCategory!.parentName != null)
                      Text(
                        _selectedCategory!.parentName!,
                        style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 10),
                      ),
                  ],
                ),
              ),
              Text(
                _selectedCategory!.code,
                style: TextStyle(color: const Color(0xFF78716C), fontSize: 10, fontFamily: 'monospace'),
              ),
            ] else ...[
              Expanded(
                child: Text(
                  _type == TransactionType.expense ? 'انتخاب سرفصل هزینه (مثلاً خرید، اجاره...)' : 'انتخاب سرفصل درآمد (مثلاً حقوق، فروش...)',
                  style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11),
                ),
              ),
              Icon(Icons.keyboard_arrow_down, color: const Color(0xFFA8A29E), size: 20),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAccountSelectorBox({
    required Account? account,
    required VoidCallback onTap,
    required String placeholder,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF292524),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF44403C)),
        ),
        child: Row(
          children: [
            if (account != null) ...[
              const Icon(Icons.account_balance_wallet, color: Colors.amber, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  account.title,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
              Text(
                '${account.balance.toInt().toString().replaceAllMapped(RegExp(r"(\\d{1,3})(?=(\\d{3})+(?!\\d))"), (m) => "${m[1]},")} ت',
                style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11, fontFamily: 'monospace'),
              ),
            ] else ...[
              Expanded(
                child: Text(placeholder, style: TextStyle(color: const Color(0xFFA8A29E), fontSize: 11)),
              ),
              Icon(Icons.keyboard_arrow_down, color: const Color(0xFFA8A29E), size: 20),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildQuickMonthButton(String label, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF292524),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF44403C)),
          ),
          child: Text(
            label,
            style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}
