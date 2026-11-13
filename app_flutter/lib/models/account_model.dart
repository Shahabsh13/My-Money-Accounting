class Account {
  final int? id;
  final String title;          // عنوان حساب، مثلا: کارت ملت، کیف‌پول نقدی
  final double balance;        // موجودی فعلی
  final String? bankName;      // نام بانک
  final String? cardNumber;    // ۴ یا ۱۶ رقم کارت
  final String? accountNumber; // شماره حساب
  final String? colorHex;      // رنگ کارت برای نمایش زیبا (مثلا قرمز برای ملت)
  final bool isDefault;        // حساب پیش‌فرض برای ثبت سریع

  Account({
    this.id,
    required this.title,
    required this.balance,
    this.bankName,
    this.cardNumber,
    this.accountNumber,
    this.colorHex,
    this.isDefault = false,
  });

  // تبدیل داده‌های دیتابیس (Map) به شیء فلوتر
  factory Account.fromMap(Map<String, dynamic> map) {
    return Account(
      id: map['id'] as int?,
      title: map['title'] as String,
      balance: (map['balance'] as num).toDouble(),
      bankName: map['bank_name'] as String?,
      cardNumber: map['card_number'] as String?,
      accountNumber: map['account_number'] as String?,
      colorHex: map['color_hex'] as String?,
      isDefault: (map['is_default'] as int?) == 1,
    );
  }

  // تبدیل شیء فلوتر به فرمت دیتابیس SQLite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'balance': balance,
      'bank_name': bankName,
      'card_number': cardNumber,
      'account_number': accountNumber,
      'color_hex': colorHex,
      'is_default': isDefault ? 1 : 0,
    };
  }
}
