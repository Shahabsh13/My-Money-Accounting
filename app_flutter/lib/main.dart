import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:shamsi_date/shamsi_date.dart';

import 'models/account_model.dart';
import 'models/transaction_model.dart';
import 'services/database_helper.dart';
import 'data/bank_data.dart';
import 'widgets/transaction_form_sheet.dart';
import 'widgets/account_form_sheet.dart';
import 'screens/transactions_screen.dart';
import 'screens/accounts_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyMoneyApp());
}

class MyMoneyApp extends StatelessWidget {
  const MyMoneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Money',
      debugShowCheckedModeBanner: false,
      locale: const Locale('fa', 'IR'),
      supportedLocales: const [Locale('fa', 'IR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Vazirmatn',
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF141416),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981), // emerald-500
          surface: Color(0xFF1C1917), // stone-900
        ),
      ),
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentTabIndex = 0; // 0: خانه, 1: تراکنش‌ها, 2: گزارش‌ها, 3: بیشتر
  bool _hideNumbers = false;
  bool _isLoading = true;

  List<Account> _accounts = [];
  List<TransactionModel> _transactions = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final accs = await DatabaseHelper.instance.getAllAccounts();
    final txs = await DatabaseHelper.instance.getAllTransactions();
    setState(() {
      _accounts = accs;
      _transactions = txs;
      _isLoading = false;
    });
  }

  String _toPersianDigit(String input) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return input.replaceAllMapped(RegExp(r'\d'), (m) => farsiDigits[int.parse(m.group(0)!)]);
  }

  String _formatMoney(double amount) {
    if (_hideNumbers) return '••••••';
    final rounded = amount.round().abs();
    final formatted = rounded.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}،',
        );
    final prefix = amount < 0 ? '-' : '';
    return _toPersianDigit('$prefix$formatted');
  }

  double get _totalBalance => _accounts.fold(0.0, (sum, a) => sum + a.balance);

  double get _monthlyIncome {
    final now = Jalali.now();
    final currentYearMonth = '${now.year}/${now.month.toString().padLeft(2, '0')}';
    return _transactions
        .where((t) => t.type == TransactionType.income && (t.shamsiDate.startsWith(currentYearMonth)))
        .fold(0.0, (sum, t) => sum + t.amount);
  }

  double get _monthlyExpense {
    final now = Jalali.now();
    final currentYearMonth = '${now.year}/${now.month.toString().padLeft(2, '0')}';
    return _transactions
        .where((t) => t.type == TransactionType.expense && (t.shamsiDate.startsWith(currentYearMonth)))
        .fold(0.0, (sum, t) => sum + t.amount);
  }

  void _openTransactionForm({TransactionType? initialType}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TransactionFormSheet(
        initialType: initialType ?? TransactionType.expense,
        onSaved: _loadData,
      ),
    );
  }

  void _openAccountForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AccountFormSheet(onSaved: _loadData),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = Jalali.now();
    final f = now.formatter;
    final todayText = _toPersianDigit('${f.wN} ${f.d} ${f.mN} ${f.yyyy}');

    return Scaffold(
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
            : IndexedStack(
                index: _currentTabIndex,
                children: [
                  _buildHomeTab(todayText),
                  TransactionsScreen(onDataChanged: _loadData),
                  _buildPlaceholderTab('گزارش‌های مالی', Icons.bar_chart_rounded),
                  _buildPlaceholderTab('بخش بیشتر (تنظیمات، چک، وام)', Icons.grid_view_rounded),
                ],
              ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHomeTab(String todayText) {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: const Color(0xFF10B981),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // ۱. هدر بالا
          _buildHeader(todayText),
          const SizedBox(height: 12),

          // ۲. کارت هیرو اصلی (Dashboard Hero Card)
          _buildHeroCard(),
          const SizedBox(height: 14),

          // ۳. سه دکمه اصلی عملیات سریع (دریافت، پرداخت، انتقال)
          _buildQuickActionButtons(),
          const SizedBox(height: 12),

          // ۴. بخش ثابت کارت‌های دوتایی چک‌ها و پیامبانک
          _buildFixedDashboardWidgets(),
          const SizedBox(height: 16),

          // ۵. ویجت طلب و بدهی اشخاص
          _buildReceivablesPayablesWidget(),
          const SizedBox(height: 14),

          // ۶. ویجت حساب‌های بانکی
          _buildBanksCardWidget(),
          const SizedBox(height: 14),

          // ۷. ویجت آخرین تراکنش‌ها
          _buildRecentTransactionsWidget(),
        ],
      ),
    );
  }

  // --- لایه ۱: هدر بالا ---
  Widget _buildHeader(String todayText) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFF059669), Color(0xFF10B981)],
                  begin: Alignment.bottomRight,
                  end: Alignment.topLeft,
                ),
              ),
              child: const Center(
                child: Text('👤', style: TextStyle(fontSize: 22)),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Row(
                  children: [
                    Text('سلام کاربر عزیز', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                    SizedBox(width: 4),
                    Text('👋', style: TextStyle(fontSize: 14)),
                  ],
                ),
                SizedBox(height: 2),
                Text(
                  'امیدوارم امروز روز خوبی داشته باشی ♡',
                  style: TextStyle(color: Color(0xFFA8A29E), fontSize: 11),
                ),
              ],
            ),
          ],
        ),
        Row(
          children: [
            IconButton(
              icon: Icon(
                _hideNumbers ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                color: const Color(0xFFA8A29E),
                size: 20,
              ),
              onPressed: () => setState(() => _hideNumbers = !_hideNumbers),
              tooltip: _hideNumbers ? 'نمایش مبالغ' : 'مخفی‌سازی مبالغ',
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF292524),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF44403C)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 12, color: Color(0xFF10B981)),
                  const SizedBox(width: 6),
                  Text(
                    todayText,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFE7E5E4)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // --- لایه ۲: کارت هیرو (Hero Card) ---
  Widget _buildHeroCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF072126), Color(0xFF092D34), Color(0xFF072428)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFF14B8A6).withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            flex: 5,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                      ),
                      child: const Icon(Icons.arrow_downward_rounded, size: 16, color: Color(0xFF34D399)),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('درآمد این ماه', style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E))),
                        Row(
                          children: [
                            Text(
                              _formatMoney(_monthlyIncome),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            const SizedBox(width: 3),
                            const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFF78716C))),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.4)),
                      ),
                      child: const Icon(Icons.arrow_upward_rounded, size: 16, color: Color(0xFFFB7185)),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('هزینه این ماه', style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E))),
                        Row(
                          children: [
                            Text(
                              _formatMoney(_monthlyExpense),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFFB7185)),
                            ),
                            const SizedBox(width: 3),
                            const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFF78716C))),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            height: 60,
            width: 1,
            margin: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.transparent,
                  const Color(0xFF14B8A6).withValues(alpha: 0.4),
                  Colors.transparent,
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.account_balance_wallet_rounded, size: 16, color: Color(0xFF34D399)),
                    SizedBox(width: 6),
                    Text(
                      'موجودی کل (بانک و صندوق)',
                      style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        _formatMoney(_totalBalance),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text('تومان', style: TextStyle(fontSize: 11, color: Color(0xFF34D399))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- لایه ۳: ۳ دکمه عملیات سریع (دریافت، پرداخت، انتقال) ---
  Widget _buildQuickActionButtons() {
    return Row(
      children: [
        _buildActionButton(
          label: 'دریافت',
          icon: Icons.arrow_downward_rounded,
          bgColor: const Color(0xFF10B981).withValues(alpha: 0.12),
          borderColor: const Color(0xFF10B981).withValues(alpha: 0.3),
          iconBoxColor: const Color(0xFF10B981),
          textColor: const Color(0xFF34D399),
          onTap: () => _openTransactionForm(initialType: TransactionType.income),
        ),
        const SizedBox(width: 8),
        _buildActionButton(
          label: 'پرداخت',
          icon: Icons.arrow_upward_rounded,
          bgColor: const Color(0xFFF43F5E).withValues(alpha: 0.12),
          borderColor: const Color(0xFFF43F5E).withValues(alpha: 0.3),
          iconBoxColor: const Color(0xFFF43F5E),
          textColor: const Color(0xFFFB7185),
          onTap: () => _openTransactionForm(initialType: TransactionType.expense),
        ),
        const SizedBox(width: 8),
        _buildActionButton(
          label: 'انتقال',
          icon: Icons.swap_horiz_rounded,
          bgColor: const Color(0xFF0EA5E9).withValues(alpha: 0.12),
          borderColor: const Color(0xFF0EA5E9).withValues(alpha: 0.3),
          iconBoxColor: const Color(0xFF0EA5E9),
          textColor: const Color(0xFF38BDF8),
          onTap: () => _openTransactionForm(initialType: TransactionType.transfer),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color bgColor,
    required Color borderColor,
    required Color iconBoxColor,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBoxColor,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: iconBoxColor.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(icon, color: const Color(0xFF0C0A09), size: 22),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textColor),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- لایه ۴: بخش ثابت کارت‌های دوتایی (چک‌ها و پیامبانک) ---
  Widget _buildFixedDashboardWidgets() {
    return Row(
      children: [
        Expanded(
          child: _buildFixedCard(
            title: 'چک‌ها',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('بخش مدیریت چک‌های صیادی در گام چک‌ها پیاده‌سازی خواهد شد.'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            rows: [
              _FixedCardRowData(
                label: 'چک سررسید نزدیک',
                count: 0,
                badgeBg: const Color(0xFF7A3452),
                badgeText: const Color(0xFFFFD9E5),
              ),
              _FixedCardRowData(
                label: 'پرداختی پیش‌رو',
                count: 0,
                badgeBg: const Color(0xFF8B571B),
                badgeText: const Color(0xFFFFE6B0),
              ),
              _FixedCardRowData(
                label: 'چک‌های دریافتنی',
                count: 0,
                badgeBg: const Color(0xFF176D59),
                badgeText: const Color(0xFFC4F7E4),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildFixedCard(
            title: 'پیامبانک',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('بخش پیامبانک هوشمند در گام SMS پیاده‌سازی خواهد شد.'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            rows: [
              _FixedCardRowData(
                label: 'صندوق پیامک‌ها',
                count: 0,
                badgeBg: const Color(0xFF7A3452),
                badgeText: const Color(0xFFFFD9E5),
              ),
              _FixedCardRowData(
                label: 'نیازمند ثبت',
                count: 0,
                badgeBg: const Color(0xFF8B571B),
                badgeText: const Color(0xFFFFE6B0),
              ),
              _FixedCardRowData(
                label: 'ثبت‌شده‌ها',
                count: 0,
                badgeBg: const Color(0xFF176D59),
                badgeText: const Color(0xFFC4F7E4),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFixedCard({
    required String title,
    required VoidCallback onTap,
    required List<_FixedCardRowData> rows,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            colors: [Color(0xFF14232B), Color(0xFF101A21)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: const Color(0xFF2B414B), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.18),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFE2EDF1),
                  ),
                ),
                const Icon(
                  Icons.chevron_left_rounded,
                  size: 18,
                  color: Color(0xFF91A8B3),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              height: 1,
              color: Colors.white.withValues(alpha: 0.08),
            ),
            const SizedBox(height: 8),
            ...rows.map((row) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        constraints: const BoxConstraints(minWidth: 22),
                        height: 20,
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: BoxDecoration(
                          color: row.badgeBg,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Center(
                          child: Text(
                            _toPersianDigit(row.count.toString()),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: row.badgeText,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          row.label,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFB8C8CF),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  // --- لایه ۵: ویجت طلب و بدهی اشخاص ---
  Widget _buildReceivablesPayablesWidget() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1917),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF292524)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.people_outline_rounded, size: 20, color: Color(0xFF10B981)),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('طلب از اشخاص', style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E))),
                    const SizedBox(height: 2),
                    Text(
                      _formatMoney(0),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF34D399)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(height: 32, width: 1, color: const Color(0xFF292524), margin: const EdgeInsets.symmetric(horizontal: 8)),
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF43F5E).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.handshake_outlined, size: 20, color: Color(0xFFF43F5E)),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('بدهی و اقساط', style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E))),
                    const SizedBox(height: 2),
                    Text(
                      _formatMoney(0),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFFB7185)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- لایه ۶: ویجت حساب‌های بانکی ---
  Widget _buildBanksCardWidget() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1C1917),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF292524)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AccountsScreen(onAccountsChanged: _loadData),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_rounded, size: 18, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 8),
                      const Text('حساب‌های بانکی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 11, color: Color(0xFF78716C)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: const Color(0xFF292524),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _toPersianDigit('${_accounts.length}'),
                        style: const TextStyle(fontSize: 10, color: Color(0xFFA8A29E)),
                      ),
                    ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: _openAccountForm,
                  icon: const Icon(Icons.add_rounded, size: 16, color: Color(0xFF10B981)),
                  label: const Text('افزودن کارت', style: TextStyle(fontSize: 11, color: Color(0xFF10B981))),
                  style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF292524)),
          if (_accounts.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: TextButton.icon(
                  onPressed: _openAccountForm,
                  icon: const Icon(Icons.add_card_rounded, color: Color(0xFF10B981)),
                  label: const Text('ثبت اولین کارت بانکی', style: TextStyle(color: Color(0xFF10B981))),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _accounts.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFF292524)),
              itemBuilder: (_, index) {
                final acc = _accounts[index];
                BankItem? bank;
                try {
                  bank = BankData.allBanks.firstWhere(
                    (b) => b.key == (acc.bankName ?? '') || b.name == (acc.bankName ?? '') || b.name == acc.title,
                  );
                } catch (_) {
                  bank = null;
                }

                return ListTile(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AccountsScreen(onAccountsChanged: _loadData),
                      ),
                    );
                  },
                  leading: bank != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: bank.buildLogo(size: 36),
                        )
                      : Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFF292524),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.credit_card_rounded, color: Color(0xFF38BDF8), size: 20),
                        ),
                  title: Text(acc.title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  subtitle: acc.cardNumber != null && acc.cardNumber!.isNotEmpty
                      ? Text(
                          _toPersianDigit(acc.cardNumber!),
                          style: const TextStyle(fontSize: 10, color: Color(0xFF78716C)),
                        )
                      : const Text('صورتحساب تفصیلی', style: TextStyle(fontSize: 10, color: Color(0xFF78716C))),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _formatMoney(acc.balance),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(width: 4),
                      const Text('تومان', style: TextStyle(fontSize: 10, color: Color(0xFFA8A29E))),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  // --- لایه ۷: آخرین تراکنش‌ها ---
  Widget _buildRecentTransactionsWidget() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1C1917),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF292524)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.history_rounded, size: 18, color: Color(0xFF10B981)),
                    SizedBox(width: 8),
                    Text('آخرین تراکنش‌ها', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                TextButton(
                  onPressed: () => setState(() => _currentTabIndex = 1),
                  child: const Text('مشاهده همه', style: TextStyle(fontSize: 11, color: Color(0xFF10B981))),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF292524)),
          if (_transactions.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('هنوز تراکنشی ثبت نشده است', style: TextStyle(color: Color(0xFFA8A29E), fontSize: 12)),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _transactions.take(5).length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFF292524)),
              itemBuilder: (_, index) {
                final tx = _transactions[index];
                final isIncome = tx.type == TransactionType.income;
                final isExpense = tx.type == TransactionType.expense;
                final accTitle = _accounts.where((a) => a.id == tx.accountId).firstOrNull?.title;

                return ListTile(
                  leading: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: isIncome
                          ? const Color(0xFF10B981).withValues(alpha: 0.15)
                          : isExpense
                              ? const Color(0xFFF43F5E).withValues(alpha: 0.15)
                              : const Color(0xFF0EA5E9).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      isIncome
                          ? Icons.arrow_downward_rounded
                          : isExpense
                              ? Icons.arrow_upward_rounded
                              : Icons.swap_horiz_rounded,
                      color: isIncome
                          ? const Color(0xFF34D399)
                          : isExpense
                              ? const Color(0xFFFB7185)
                              : const Color(0xFF38BDF8),
                      size: 20,
                    ),
                  ),
                  title: Text(
                    tx.category.isNotEmpty ? tx.category : (isIncome ? 'درآمد' : isExpense ? 'هزینه' : 'انتقال'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    [
                      if (tx.shamsiDate.isNotEmpty) _toPersianDigit(tx.shamsiDate),
                      if (accTitle != null) accTitle,
                      if (tx.description != null && tx.description!.isNotEmpty) tx.description,
                    ].join(' • '),
                    style: const TextStyle(fontSize: 10, color: Color(0xFFA8A29E)),
                  ),
                  trailing: Text(
                    '${isIncome ? '+' : isExpense ? '-' : ''}${_formatMoney(tx.amount)} تومان',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isIncome
                          ? const Color(0xFF34D399)
                          : isExpense
                              ? const Color(0xFFFB7185)
                              : const Color(0xFF38BDF8),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  // --- نوار ناوبری پایین ---
  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF141416),
        border: Border(top: BorderSide(color: Color(0xFF292524), width: 1)),
      ),
      child: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        onTap: (index) => setState(() => _currentTabIndex = index),
        backgroundColor: Colors.transparent,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF10B981),
        unselectedItemColor: const Color(0xFF78716C),
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'خانه',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_rounded),
            label: 'تراکنش‌ها',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart_rounded),
            label: 'گزارش‌ها',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_rounded),
            label: 'بیشتر',
          ),
        ],
      ),
    );
  }

  Widget _buildPlaceholderTab(String title, IconData icon) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: const Color(0xFF44403C)),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFA8A29E))),
          const SizedBox(height: 6),
          const Text('در گام‌های بعدی پیاده‌سازی خواهد شد', style: TextStyle(fontSize: 12, color: Color(0xFF78716C))),
        ],
      ),
    );
  }
}

class _FixedCardRowData {
  final String label;
  final int count;
  final Color badgeBg;
  final Color badgeText;

  _FixedCardRowData({
    required this.label,
    required this.count,
    required this.badgeBg,
    required this.badgeText,
  });
}