import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/account_model.dart';
import '../models/transaction_model.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  // حافظه سریع برای وب
  final List<Account> _webAccounts = [
    Account(
      id: 1,
      title: 'کیف پول نقدی',
      balance: 0.0,
      bankName: 'نقدی',
      colorHex: '0xFF1E88E5',
      isDefault: true,
    ),
  ];
  final List<TransactionModel> _webTransactions = [];

  DatabaseHelper._init();

  Future<Database?> get database async {
    if (kIsWeb) return null;
    if (_database != null) return _database!;
    _database = await _initDB('maymoney.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        balance REAL NOT NULL,
        bank_name TEXT,
        card_number TEXT,
        account_number TEXT,
        color_hex TEXT,
        is_default INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type INTEGER NOT NULL,
        amount REAL NOT NULL,
        account_id INTEGER NOT NULL,
        destination_account_id INTEGER,
        category TEXT NOT NULL,
        description TEXT,
        date_time TEXT NOT NULL,
        shamsi_date TEXT NOT NULL,
        tracking_code TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )
    ''');

    // حساب پیش‌فرض
    await db.insert('accounts', {
      'title': 'کیف پول نقدی',
      'balance': 0.0,
      'bank_name': 'نقدی',
      'color_hex': '0xFF1E88E5',
      'is_default': 1,
    });
  }

  // --- عملیات حساب‌ها ---

  Future<List<Account>> getAllAccounts() async {
    if (kIsWeb) {
      return List.unmodifiable(_webAccounts);
    }
    final db = await database;
    final maps = await db!.query('accounts', orderBy: 'is_default DESC, id ASC');
    return maps.map((m) => Account.fromMap(m)).toList();
  }

  Future<int> insertAccount(Account account) async {
    if (kIsWeb) {
      final newId = (_webAccounts.isEmpty ? 0 : _webAccounts.map((a) => a.id ?? 0).reduce((a, b) => a > b ? a : b)) + 1;
      final newAcc = Account(
        id: newId,
        title: account.title,
        balance: account.balance,
        bankName: account.bankName,
        cardNumber: account.cardNumber,
        accountNumber: account.accountNumber,
        colorHex: account.colorHex,
        isDefault: account.isDefault,
      );
      _webAccounts.add(newAcc);
      return newId;
    }
    final db = await database;
    return await db!.insert('accounts', account.toMap());
  }

  Future<int> updateAccount(Account account) async {
    if (kIsWeb) {
      final index = _webAccounts.indexWhere((a) => a.id == account.id);
      if (index != -1) {
        _webAccounts[index] = account;
        return 1;
      }
      return 0;
    }
    final db = await database;
    return await db!.update(
      'accounts',
      account.toMap(),
      where: 'id = ?',
      whereArgs: [account.id],
    );
  }

  // --- عملیات تراکنش‌ها ---

  Future<List<TransactionModel>> getAllTransactions() async {
    if (kIsWeb) {
      final sorted = List<TransactionModel>.from(_webTransactions);
      sorted.sort((a, b) => b.dateTime.compareTo(a.dateTime));
      return sorted;
    }
    final db = await database;
    final maps = await db!.query('transactions', orderBy: 'date_time DESC');
    return maps.map((m) => TransactionModel.fromMap(m)).toList();
  }

  Future<int> insertTransaction(TransactionModel tx) async {
    if (kIsWeb) {
      final newId = (_webTransactions.isEmpty ? 0 : _webTransactions.map((t) => t.id ?? 0).reduce((a, b) => a > b ? a : b)) + 1;
      final newTx = TransactionModel(
        id: newId,
        type: tx.type,
        amount: tx.amount,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId,
        category: tx.category,
        description: tx.description,
        dateTime: tx.dateTime,
        shamsiDate: tx.shamsiDate,
        trackingCode: tx.trackingCode,
      );
      _webTransactions.add(newTx);

      // آپدیت موجودی
      final srcIndex = _webAccounts.indexWhere((a) => a.id == tx.accountId);
      if (srcIndex != -1) {
        final src = _webAccounts[srcIndex];
        double newBal = src.balance;
        if (tx.type == TransactionType.income) {
          newBal += tx.amount;
        } else if (tx.type == TransactionType.expense || tx.type == TransactionType.transfer) {
          newBal -= tx.amount;
        }
        _webAccounts[srcIndex] = Account(
          id: src.id,
          title: src.title,
          balance: newBal,
          bankName: src.bankName,
          cardNumber: src.cardNumber,
          accountNumber: src.accountNumber,
          colorHex: src.colorHex,
          isDefault: src.isDefault,
        );
      }

      if (tx.type == TransactionType.transfer && tx.destinationAccountId != null) {
        final dstIndex = _webAccounts.indexWhere((a) => a.id == tx.destinationAccountId);
        if (dstIndex != -1) {
          final dst = _webAccounts[dstIndex];
          _webAccounts[dstIndex] = Account(
            id: dst.id,
            title: dst.title,
            balance: dst.balance + tx.amount,
            bankName: dst.bankName,
            cardNumber: dst.cardNumber,
            accountNumber: dst.accountNumber,
            colorHex: dst.colorHex,
            isDefault: dst.isDefault,
          );
        }
      }

      return newId;
    }

    final db = await database;
    return await db!.transaction((txn) async {
      final id = await txn.insert('transactions', tx.toMap());

      // اثر روی حساب مبدأ
      if (tx.type == TransactionType.income) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [tx.amount, tx.accountId],
        );
      } else if (tx.type == TransactionType.expense || tx.type == TransactionType.transfer) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance - ? WHERE id = ?',
          [tx.amount, tx.accountId],
        );
      }

      // اثر روی حساب مقصد
      if (tx.type == TransactionType.transfer && tx.destinationAccountId != null) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [tx.amount, tx.destinationAccountId],
        );
      }

      return id;
    });
  }

  Future<int> deleteTransaction(int id) async {
    if (kIsWeb) {
      final index = _webTransactions.indexWhere((t) => t.id == id);
      if (index != -1) {
        final tx = _webTransactions[index];
        _webTransactions.removeAt(index);

        // برگشت اثر موجودی
        final srcIndex = _webAccounts.indexWhere((a) => a.id == tx.accountId);
        if (srcIndex != -1) {
          final src = _webAccounts[srcIndex];
          double newBal = src.balance;
          if (tx.type == TransactionType.expense || tx.type == TransactionType.transfer) {
            newBal += tx.amount;
          } else if (tx.type == TransactionType.income) {
            newBal -= tx.amount;
          }
          _webAccounts[srcIndex] = Account(
            id: src.id,
            title: src.title,
            balance: newBal,
            bankName: src.bankName,
            cardNumber: src.cardNumber,
            accountNumber: src.accountNumber,
            colorHex: src.colorHex,
            isDefault: src.isDefault,
          );
        }

        if (tx.type == TransactionType.transfer && tx.destinationAccountId != null) {
          final dstIndex = _webAccounts.indexWhere((a) => a.id == tx.destinationAccountId);
          if (dstIndex != -1) {
            final dst = _webAccounts[dstIndex];
            _webAccounts[dstIndex] = Account(
              id: dst.id,
              title: dst.title,
              balance: dst.balance - tx.amount,
              bankName: dst.bankName,
              cardNumber: dst.cardNumber,
              accountNumber: dst.accountNumber,
              colorHex: dst.colorHex,
              isDefault: dst.isDefault,
            );
          }
        }
        return 1;
      }
      return 0;
    }

    final db = await database;
    return await db!.transaction((txn) async {
      final list = await txn.query('transactions', where: 'id = ?', whereArgs: [id]);
      if (list.isEmpty) return 0;

      final tx = TransactionModel.fromMap(list.first);

      // برگشت اثر موجودی در دیتابیس
      if (tx.type == TransactionType.income) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance - ? WHERE id = ?',
          [tx.amount, tx.accountId],
        );
      } else if (tx.type == TransactionType.expense || tx.type == TransactionType.transfer) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [tx.amount, tx.accountId],
        );
      }

      if (tx.type == TransactionType.transfer && tx.destinationAccountId != null) {
        await txn.rawUpdate(
          'UPDATE accounts SET balance = balance - ? WHERE id = ?',
          [tx.amount, tx.destinationAccountId],
        );
      }

      return await txn.delete('transactions', where: 'id = ?', whereArgs: [id]);
    });
  }

  Future<void> close() async {
    final db = await database;
    if (db != null) await db.close();
  }
}
