import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../data/bank_data.dart';
import '../models/account_model.dart';
import '../services/database_helper.dart';

class AccountFormSheet extends StatefulWidget {
  final Account? accountToEdit;
  final VoidCallback onSaved;

  const AccountFormSheet({
    super.key,
    this.accountToEdit,
    required this.onSaved,
  });

  @override
  State<AccountFormSheet> createState() => _AccountFormSheetState();
}

class _AccountFormSheetState extends State<AccountFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _balanceController;
  late final TextEditingController _cardNumberController;
  late final TextEditingController _accountNumberController;

  BankItem? _selectedBank;
  bool _isSaving = false;

  bool get _isEditMode => widget.accountToEdit != null;

  @override
  void initState() {
    super.initState();
    final acc = widget.accountToEdit;

    _titleController = TextEditingController(text: acc?.title ?? '');
    _balanceController = TextEditingController(
      text: acc != null ? _formatNumber(acc.balance.toInt()) : '',
    );
    _cardNumberController = TextEditingController(text: acc?.cardNumber ?? '');
    _accountNumberController = TextEditingController(text: acc?.accountNumber ?? '');

    if (acc?.bankName != null && acc!.bankName!.isNotEmpty) {
      _selectedBank = BankData.findByKey(acc.bankName) ?? BankData.allBanks.firstWhere(
        (b) => b.name == acc.bankName || b.key == acc.bankName,
        orElse: () => BankData.allBanks.first,
      );
    } else {
      _selectedBank = BankData.allBanks.first;
      if (!_isEditMode && _titleController.text.isEmpty) {
        _titleController.text = _selectedBank!.name;
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _balanceController.dispose();
    _cardNumberController.dispose();
    _accountNumberController.dispose();
    super.dispose();
  }

  String _formatNumber(int number) {
    return NumberFormat('#,###', 'en_US').format(number);
  }

  String _toPersianDigit(String input) {
    const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (int i = 0; i < english.length; i++) {
      input = input.replaceAll(english[i], farsi[i]);
    }
    return input;
  }

  String _cleanDigits(String text) {
    const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (int i = 0; i < farsi.length; i++) {
      text = text.replaceAll(farsi[i], english[i]);
    }
    return text.replaceAll(RegExp(r'[^0-9]'), '');
  }

  void _onCardNumberChanged(String value) {
    final clean = _cleanDigits(value);

    // قالب‌بندی ۴ رقم ۴ رقم
    String formatted = '';
    for (int i = 0; i < clean.length && i < 16; i++) {
      if (i > 0 && i % 4 == 0) formatted += '-';
      formatted += clean[i];
    }

    if (formatted != value) {
      _cardNumberController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }

    // تشخیص خودکار بانک بر اساس ۶ رقم اول
    if (clean.length >= 6) {
      final detected = BankData.findByCardNumber(clean);
      if (detected != null && detected.key != _selectedBank?.key) {
        setState(() {
          _selectedBank = detected;
          if (!_isEditMode && (_titleController.text.isEmpty ||
              BankData.allBanks.any((b) => b.name == _titleController.text || b.key == _titleController.text))) {
            _titleController.text = detected.name;
          }
        });
      }
    }
  }

  void _onBalanceChanged(String value) {
    final clean = _cleanDigits(value);
    if (clean.isEmpty) {
      _balanceController.text = '';
      return;
    }
    final intValue = int.tryParse(clean) ?? 0;
    final formatted = _formatNumber(intValue);
    if (formatted != value) {
      _balanceController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }
    setState(() {});
  }

  void _openBankPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        String searchQuery = '';
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = BankData.allBanks.where((b) {
              if (searchQuery.isEmpty) return true;
              return b.name.contains(searchQuery) || b.key.contains(searchQuery);
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.8,
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
                        const Text(
                          'انتخاب بانک یا مؤسسه (۴۶ بانک)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Color(0xFFA8A29E)),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextField(
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'جستجوی نام بانک (ملت، سامان، بلوبانک...)',
                        hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 13),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF78716C), size: 20),
                        filled: true,
                        fillColor: const Color(0xFF292524),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      onChanged: (val) {
                        setModalState(() {
                          searchQuery = val.trim();
                        });
                      },
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFF292524)),
                      itemBuilder: (context, index) {
                        final bank = filtered[index];
                        final isSelected = bank.key == _selectedBank?.key;

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          leading: Container(
                            width: 40,
                            height: 40,
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF292524),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF10B981) : Colors.transparent,
                                width: 1.5,
                              ),
                            ),
                            child: bank.buildLogo(size: 32),
                          ),
                          title: Text(
                            bank.name,
                            style: TextStyle(
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              color: isSelected ? const Color(0xFF10B981) : Colors.white,
                              fontSize: 13,
                            ),
                          ),
                          subtitle: bank.prefix.isNotEmpty
                              ? Text(
                                  'پیش‌شماره کارت: ${_toPersianDigit(bank.prefix)}',
                                  style: const TextStyle(color: Color(0xFF78716C), fontSize: 11),
                                )
                              : null,
                          trailing: isSelected
                              ? const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20)
                              : null,
                          onTap: () {
                            setState(() {
                              _selectedBank = bank;
                              if (!_isEditMode && (_titleController.text.isEmpty ||
                                  BankData.allBanks.any((b) => b.name == _titleController.text || b.key == _titleController.text))) {
                                _titleController.text = bank.name;
                              }
                            });
                            Navigator.pop(context);
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final title = _titleController.text.trim();
      final cleanBal = _cleanDigits(_balanceController.text);
      final balance = double.tryParse(cleanBal) ?? 0.0;
      final cardNumber = _cardNumberController.text.trim();
      final accountNumber = _accountNumberController.text.trim();
      final bankName = _selectedBank?.key ?? _selectedBank?.name;
      final colorHex = _selectedBank?.colorHex ?? '0xFF10B981';

      if (_isEditMode) {
        final updated = Account(
          id: widget.accountToEdit!.id,
          title: title,
          balance: balance,
          bankName: bankName,
          cardNumber: cardNumber.isNotEmpty ? cardNumber : null,
          accountNumber: accountNumber.isNotEmpty ? accountNumber : null,
          colorHex: colorHex,
          isDefault: widget.accountToEdit!.isDefault,
        );
        await DatabaseHelper.instance.updateAccount(updated);
      } else {
        final newAcc = Account(
          title: title,
          balance: balance,
          bankName: bankName,
          cardNumber: cardNumber.isNotEmpty ? cardNumber : null,
          accountNumber: accountNumber.isNotEmpty ? accountNumber : null,
          colorHex: colorHex,
          isDefault: false,
        );
        await DatabaseHelper.instance.insertAccount(newAcc);
      }

      if (mounted) {
        widget.onSaved();
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isEditMode ? 'اطلاعات حساب با موفقیت ویرایش شد ✓' : 'حساب بانکی جدید با موفقیت افزوده شد ✓',
              style: const TextStyle(fontFamily: 'Vazirmatn'),
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('خطا در ذخیره حساب: $e', style: const TextStyle(fontFamily: 'Vazirmatn')),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1C1917),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 12,
        left: 16,
        right: 16,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF44403C),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.account_balance_rounded, size: 18, color: Color(0xFF38BDF8)),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isEditMode ? 'ویرایش اطلاعات حساب بانکی' : 'تعریف حساب بانکی جدید',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFFA8A29E)),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 16, color: Color(0xFF292524)),
              const SizedBox(height: 6),

              // انتخاب بانک
              const Text(
                '۱. انتخاب بانک یا مؤسسه مالی *',
                style: TextStyle(color: Color(0xFFD6D3D1), fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              InkWell(
                onTap: _openBankPicker,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF292524),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF44403C)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1C1917),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: _selectedBank != null
                            ? _selectedBank!.buildLogo(size: 32)
                            : const Icon(Icons.account_balance_rounded, color: Color(0xFF38BDF8)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedBank?.name ?? 'انتخاب بانک...',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
                            ),
                            const Text(
                              'برای تغییر بانک کلیک کنید',
                              style: TextStyle(fontSize: 10, color: Color(0xFF78716C)),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFFA8A29E)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // نام / عنوان حساب
              const Text(
                '۲. عنوان و نام حساب *',
                style: TextStyle(color: Color(0xFFD6D3D1), fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _titleController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'مثلاً: کارت حقوق، جاری، پس‌انداز، بلوبانک شخصی',
                  hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 12),
                  prefixIcon: const Icon(Icons.badge_rounded, color: Color(0xFF78716C), size: 18),
                  filled: true,
                  fillColor: const Color(0xFF292524),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'لطفاً عنوان حساب را وارد کنید';
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // شماره کارت ۱۶ رقمی
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '۳. شماره کارت ۱۶ رقمی (اختیاری)',
                    style: TextStyle(color: Color(0xFFD6D3D1), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  const Text(
                    'تشخیص خودکار بانک با ۶ رقم اول',
                    style: TextStyle(color: Color(0xFF0284C7), fontSize: 10),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _cardNumberController,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1.5),
                decoration: InputDecoration(
                  hintText: '6037-9971-XXXX-XXXX',
                  hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 13, letterSpacing: 1),
                  prefixIcon: const Icon(Icons.credit_card_rounded, color: Color(0xFF78716C), size: 18),
                  filled: true,
                  fillColor: const Color(0xFF292524),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
                onChanged: _onCardNumberChanged,
              ),
              const SizedBox(height: 14),

              // شماره حساب
              const Text(
                '۴. شماره حساب (اختیاری)',
                style: TextStyle(color: Color(0xFFD6D3D1), fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _accountNumberController,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                decoration: InputDecoration(
                  hintText: '0123456789',
                  hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 12),
                  prefixIcon: const Icon(Icons.numbers_rounded, color: Color(0xFF78716C), size: 18),
                  filled: true,
                  fillColor: const Color(0xFF292524),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 14),

              // موجودی اولیه
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _isEditMode ? '۵. مانده موجودی فعلی (تومان)' : '۵. موجودی اولیه (تومان)',
                    style: const TextStyle(color: Color(0xFFD6D3D1), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  if (_balanceController.text.isNotEmpty)
                    Text(
                      '${_toPersianDigit(_balanceController.text)} تومان',
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _balanceController,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  hintText: '0',
                  hintStyle: const TextStyle(color: Color(0xFF78716C), fontSize: 14),
                  prefixIcon: const Icon(Icons.attach_money_rounded, color: Color(0xFF10B981), size: 20),
                  suffixText: 'تومان',
                  suffixStyle: const TextStyle(color: Color(0xFFA8A29E), fontSize: 11),
                  filled: true,
                  fillColor: const Color(0xFF292524),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
                onChanged: _onBalanceChanged,
              ),
              const SizedBox(height: 22),

              // دکمه ذخیره
              ElevatedButton.icon(
                onPressed: _isSaving ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                icon: _isSaving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline_rounded, size: 20),
                label: Text(
                  _isEditMode ? 'ذخیره تغییرات حساب' : 'ثبت حساب و کارت بانکی',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
