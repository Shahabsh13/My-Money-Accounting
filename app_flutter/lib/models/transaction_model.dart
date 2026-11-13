enum TransactionType {
  expense,  // هزینه
  income,   // درآمد
  transfer, // انتقال بین حساب‌ها
}

class TransactionModel {
  final int? id;
  final double amount;                // مبلغ تراکنش
  final TransactionType type;         // نوع: هزینه، درآمد یا انتقال
  final int accountId;                // حساب مبدأ (یا حساب اصلی)
  final int? destinationAccountId;    // حساب مقصد (مخصوص انتقال وجه)
  final String category;              // دسته‌بندی (مثلا: خوراک، حقوق، سوخت)
  final DateTime dateTime;            // تاریخ و ساعت میلادی برای محاسبات
  final String shamsiDate;            // تاریخ شمسی ذخیره‌شده (مثلا: ۱۴۰۵/۰۸/۱۸)
  final String? description;          // توضیحات و یادداشت
  final String? trackingCode;         // شماره پیگیری یا ارجاع بانکی

  TransactionModel({
    this.id,
    required this.amount,
    required this.type,
    required this.accountId,
    this.destinationAccountId,
    required this.category,
    required this.dateTime,
    required this.shamsiDate,
    this.description,
    this.trackingCode,
  });

  // تبدیل داده دیتابیس به شیء فلوتر
  factory TransactionModel.fromMap(Map<String, dynamic> map) {
    return TransactionModel(
      id: map['id'] as int?,
      amount: (map['amount'] as num).toDouble(),
      type: TransactionType.values.firstWhere(
        (e) => e.name == map['type'],
        orElse: () => TransactionType.expense,
      ),
      accountId: map['account_id'] as int,
      destinationAccountId: map['destination_account_id'] as int?,
      category: map['category'] as String,
      dateTime: DateTime.parse(map['date_time'] as String),
      shamsiDate: map['shamsi_date'] as String,
      description: map['description'] as String?,
      trackingCode: map['tracking_code'] as String?,
    );
  }

  // تبدیل شیء فلوتر برای ذخیره در SQLite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'amount': amount,
      'type': type.name, // ذخیره به عنوان 'expense', 'income', 'transfer'
      'account_id': accountId,
      'destination_account_id': destinationAccountId,
      'category': category,
      'date_time': dateTime.toIso8601String(),
      'shamsi_date': shamsiDate,
      'description': description,
      'tracking_code': trackingCode,
    };
  }
}
