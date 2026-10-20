/* Public SMS format fixtures; provenance per sample. Not bank-certified templates. */
(function(root){root.HnBankSmsSamples = [
  {
    "id": "ayandeh",
    "name": "بانک آینده",
    "keywords": [
      "آینده"
    ],
    "senders": [
      "AYANDEH",
      "AyandehBank",
      "+98200040"
    ],
    "samples": [
      {
        "text": "بانک آینده\nواریز: ۹٬۵۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۱۹۵٬۰۰۰٬۰۰۰ ریال",
        "sender": "AYANDEH",
        "type": "income",
        "amount": 9500000,
        "balance": 195000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/ayandeh.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "blu",
    "name": "بلوبانک",
    "keywords": [
      "بلوبانک",
      "بلو",
      "بلوبانک"
    ],
    "senders": [
      "BLUBANK",
      "blubank",
      "+982000021",
      "+989999987641"
    ],
    "samples": [
      {
        "text": "+۴٬۵۰۰٬۲۸۰ ریال — بلو کارت **** موجودی: ۱۲۵٬۰۰۰٬۰۰۰ ریال",
        "sender": "BLUBANK",
        "type": "income",
        "amount": 4500280,
        "balance": 125000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/blu.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "-۱٬۲۰۰٬۰۰۰ ریال — بلو کارت **** موجودی: ۱۲۳٬۸۰۰٬۰۰۰ ریال",
        "sender": "BLUBANK",
        "type": "expense",
        "amount": 1200000,
        "balance": 123800000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/blu.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "بلو\nبرداشت پول\nکاربر عزیز، 20,000,000 ریال از حساب شما پرید.\nموجودی: 77,436,726 ریال\n۱۰:۴۷\n۱۴۰۵.۰۷.۰۶",
        "sender": "+989999987641",
        "type": "expense",
        "amount": 20000000,
        "balance": 77436726,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بلو\nواریز پول\n کاربر عزیز، 2,500,000 ریال به حساب شما نشست.\n موجودی: 104,451,226 ریال\n۱۸:۲۳\n۱۴۰۵.۰۷.۰۳",
        "sender": "+989999987641",
        "type": "income",
        "amount": 2500000,
        "balance": 104451226,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بلو\nبرداشت پول\nکاربر عزیز، 3,000,000ریال از حساب شما پرید.\nموجودی: 63,475,726 ریال\n۱۶:۰۰\n۱۴۰۵.۰۷.۱۲",
        "sender": "+989999987641",
        "type": "expense",
        "amount": 3000000,
        "balance": 63475726,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بلو\nکاربر عزیز 27,272,727 ریال بابت بازپرداخت بدهی وام قرض الحسنه ازدواج، از حساب شما پرید.\nموجودی: 13,781,170 ریال\n۱۴:۲۰\n۱۴۰۵.۰۷.۲۵",
        "sender": "+989999987641",
        "type": "expense",
        "amount": 27272727,
        "balance": 13781170,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "keshavarzi",
    "name": "بانک کشاورزی",
    "keywords": [
      "کشاورزی"
    ],
    "senders": [
      "KESHAVARZI",
      "AgriBank",
      "+98200016"
    ],
    "samples": [
      {
        "text": "بانک کشاورزی\nواریز: ۴٬۲۰۰٬۰۰۰ ریال\nحساب: ۸۸۹۰\nمانده: ۶۱٬۵۰۰٬۰۰۰ ریال",
        "sender": "KESHAVARZI",
        "type": "income",
        "amount": 4200000,
        "balance": 61500000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/keshavarzi.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "mellat",
    "name": "بانک ملت",
    "keywords": [
      "ملت"
    ],
    "senders": [
      "MELLAT",
      "Mellat",
      "+98200000",
      "Bank Mellat"
    ],
    "samples": [
      {
        "text": "بانک ملت\nواریز: ۲٬۵۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۴۵٬۰۰۰٬۰۰۰ ریال\nپیگیری: ۹۸۷۶۵۴۳۲",
        "sender": "MELLAT",
        "type": "income",
        "amount": 2500000,
        "balance": 45000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/mellat.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "بانک ملت\nبرداشت: ۵۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۴۴٬۵۰۰٬۰۰۰ ریال\nپیگیری: ۱۲۳۴۵۶۷۸",
        "sender": "MELLAT",
        "type": "expense",
        "amount": 500000,
        "balance": 44500000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/mellat.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "حساب1848394556\nواریز31,500,000\nمانده31,894,014\n05/06/28-13:57",
        "sender": "Bank Mellat",
        "type": "income",
        "amount": 31500000,
        "balance": 31894014,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "melli",
    "name": "بانک ملی ایران",
    "keywords": [
      "ملی ایران",
      "ملی"
    ],
    "senders": [
      "BMI",
      "MELLI",
      "BankMelli",
      "+9820000",
      "700717"
    ],
    "samples": [
      {
        "text": "بانک ملی ایران\nواریز: ۶٬۲۰۰٬۰۰۰ ریال\nحساب: ۱۲۳۴\nمانده: ۸۴٬۰۰۰٬۰۰۰ ریال\nشناسه پیگیری: ۸۷۶۵۴۳۲۱",
        "sender": "BMI",
        "type": "income",
        "amount": 6200000,
        "balance": 84000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/melli.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "بانك ملي ايران\nبرداشت:500,000-\nحساب:10000\nمانده:23,488,359\n0705-20:46",
        "sender": "700717",
        "type": "expense",
        "amount": 500000,
        "balance": 23488359,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بانك ملي ايران\nانتقال:25,000,000+\nحساب:10000\nمانده:198,088,329\n0625-19:42",
        "sender": "700717",
        "type": "income",
        "amount": 25000000,
        "balance": 198088329,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بانك ملي ايران\nپايا:140,000,000-\nحساب:10000\nمانده:46,075,429\n0629-15:50",
        "sender": "700717",
        "type": "expense",
        "amount": 140000000,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بانك ملي ايران\nخريداينترنتي:7,714,450-\nحساب:10000\nمانده:186,675,429\n0626-20:17",
        "sender": "700717",
        "type": "expense",
        "amount": 7714450,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "parsian",
    "name": "بانک پارسیان",
    "keywords": [
      "پارسیان"
    ],
    "senders": [
      "PARSIAN",
      "ParsianBank",
      "+98200020",
      "PARSIANBANK"
    ],
    "samples": [
      {
        "text": "بانک پارسیان\nواریز: ۳٬۴۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۱۸٬۲۰۰٬۰۰۰ ریال",
        "sender": "PARSIAN",
        "type": "income",
        "amount": 3400000,
        "balance": 18200000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/parsian.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "30101540968603\nمبلغ:397,500-\nمانده:81,294,045\n07/06\n14:49",
        "sender": "PARSIANBANK",
        "type": "expense",
        "amount": 397500,
        "balance": 81294045,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "30101540968603\nمبلغ:2,582,800,000+\nمانده:2,616,820,545\n07/04\n09:22",
        "sender": "PARSIANBANK",
        "type": "income",
        "amount": 2582800000,
        "balance": 2616820545,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "pasargad",
    "name": "بانک پاسارگاد",
    "keywords": [
      "پاسارگاد"
    ],
    "senders": [
      "PASARGAD",
      "BPI",
      "+981000900",
      "B.Pasargad"
    ],
    "samples": [
      {
        "text": "بانک پاسارگاد\nواریز: ۱۰٬۰۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۲۵۰٬۰۰۰٬۰۰۰ ریال\nکد پیگیری: ۵۵۴۴۳۳",
        "sender": "PASARGAD",
        "type": "income",
        "amount": 10000000,
        "balance": 250000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/pasargad.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "232.800.1442198.1\n-80,000\n06/16_19:45\nمانده: 31,516,369",
        "sender": "B.Pasargad",
        "type": "expense",
        "amount": 80000,
        "balance": 31516369,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "postbank",
    "name": "پست بانک ایران",
    "keywords": [
      "پست بانک ایران",
      "پست بانک"
    ],
    "senders": [
      "POSTBANK",
      "PostBank",
      "+98200025"
    ],
    "samples": [
      {
        "text": "پست بانک ایران\nواریز: ۱٬۱۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۱۵٬۰۰۰٬۰۰۰ ریال",
        "sender": "POSTBANK",
        "type": "income",
        "amount": 1100000,
        "balance": 15000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/postbank.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "پست بانک\nاز پرداخت شما متشکریم.\nشماره تسهیلات:\n-140,053,000\n1405/04/22\n14:52\nمانده: 13,372,884 ریال",
        "sender": "POSTBANK",
        "type": "expense",
        "amount": 140053000,
        "balance": 13372884,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "refah",
    "name": "بانک رفاه کارگران",
    "keywords": [
      "رفاه کارگران"
    ],
    "senders": [
      "REFAH",
      "BankRefah",
      "+98200022"
    ],
    "samples": [
      {
        "text": "بانک رفاه کارگران\nواریز: ۳٬۱۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۵۲٬۰۰۰٬۰۰۰ ریال",
        "sender": "REFAH",
        "type": "income",
        "amount": 3100000,
        "balance": 52000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/refah.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "resalat",
    "name": "بانک قرض‌الحسنه رسالت",
    "keywords": [
      "قرض‌الحسنه رسالت",
      "رسالت"
    ],
    "senders": [
      "RESALAT",
      "RQBank",
      "+98200030",
      "ResalatBank"
    ],
    "samples": [
      {
        "text": "بانک رسالت\nواریز مبلغ: ۷٬۷۰۰٬۰۰۰ ریال\nسپرده: ۸۰۸۰\nموجودی: ۱۱۰٬۰۰۰٬۰۰۰ ریال",
        "sender": "RESALAT",
        "type": "income",
        "amount": 7700000,
        "balance": 110000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/resalat.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "10.3372914.1 \n-13,550,000  \n07/11_00:12 \nمانده: 428,428,242",
        "sender": "ResalatBank",
        "type": "expense",
        "amount": 13550000,
        "balance": 428428242,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "10.3372914.1 \n+4,692,800  \n07/11_22:01 \nمانده: 433,121,042",
        "sender": "ResalatBank",
        "type": "income",
        "amount": 4692800,
        "balance": 433121042,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "saderat",
    "name": "بانک صادرات ایران",
    "keywords": [
      "صادرات ایران"
    ],
    "senders": [
      "SADERAT",
      "BSI",
      "+98200019"
    ],
    "samples": [
      {
        "text": "بانک صادرات ایران\nواریز: ۵٬۰۰۰٬۰۰۰ ریال\nکارت: ****\nمانده: ۱۰۵٬۰۰۰٬۰۰۰ ریال",
        "sender": "SADERAT",
        "type": "income",
        "amount": 5000000,
        "balance": 105000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/saderat.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "saman",
    "name": "بانک سامان",
    "keywords": [
      "سامان"
    ],
    "senders": [
      "SAMAN",
      "SamanBank",
      "+9820008"
    ],
    "samples": [
      {
        "text": "بانک سامان\nواریز مبلغ: ۳٬۰۰۰٬۰۰۰ ریال\nکارت: ****\nمانده: ۷۰٬۰۰۰٬۰۰۰ ریال",
        "sender": "SAMAN",
        "type": "income",
        "amount": 3000000,
        "balance": 70000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/saman.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "sepah",
    "name": "بانک سپه",
    "keywords": [
      "سپه"
    ],
    "senders": [
      "SEPAH",
      "BankSepah",
      "+9820004"
    ],
    "samples": [
      {
        "text": "بانک سپه\nواریز: ۱٬۵۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۳۳٬۰۰۰٬۰۰۰ ریال",
        "sender": "SEPAH",
        "type": "income",
        "amount": 1500000,
        "balance": 33000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/sepah.json",
        "kind": "public-test-fixture"
      }
    ]
  },
  {
    "id": "shahr",
    "name": "بانک شهر",
    "keywords": [
      "شهر"
    ],
    "senders": [
      "SHAHR",
      "ShahrBank",
      "+98200028"
    ],
    "samples": [
      {
        "text": "بانک شهر\nواریز: ۱٬۸۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۴۰٬۰۰۰٬۰۰۰ ریال",
        "sender": "SHAHR",
        "type": "income",
        "amount": 1800000,
        "balance": 40000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/shahr.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "*بانک شهر*\nسود\nواريز به:700814110204\nمبلغ:377,743ريال\nموجودي:89,371,480ريال\n1405/07/1 00:41:16",
        "sender": "",
        "type": "income",
        "amount": 377743,
        "balance": 89371480,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "tejarat",
    "name": "بانک تجارت",
    "keywords": [
      "تجارت"
    ],
    "senders": [
      "TEJARAT",
      "TejaratBank",
      "+98200021"
    ],
    "samples": [
      {
        "text": "بانک تجارت\nواریز: ۸٬۰۰۰٬۰۰۰ ریال\nکارت: ****\nموجودی: ۹۰٬۰۰۰٬۰۰۰ ریال",
        "sender": "TEJARAT",
        "type": "income",
        "amount": 8000000,
        "balance": 90000000,
        "source": "https://github.com/milibots/smsGAClient/blob/f254853f85fbc3951df0f0a0103dd5dc6931bf20/app/src/main/assets/banks/tejarat.json",
        "kind": "public-test-fixture"
      },
      {
        "text": "*بانک تجارت*  \nحساب: 0177002186043  \nبرداشت: 60,000 ریال  \nاز طريق: پایانه فروش   \nمانده: 24,502,460 ریال  \n1405/07/11 \n14:15",
        "sender": "TejaratBank",
        "type": "expense",
        "amount": 60000,
        "balance": 24502460,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "*بانک تجارت*  \nحساب: 0177002186043  \nواریز: 5,000,000 ریال  \nاز طريق: شتاب   \nمانده: 24,562,460 ریال  \n1405/07/05 \n18:39",
        "sender": "TejaratBank",
        "type": "income",
        "amount": 5000000,
        "balance": 24562460,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "*بانک تجارت* \nحساب: 0177007456214 \nواریز حقوق : 685,426,335 ریال \nاز طريق: شعبه  \nکدشعبه: 2080\nمانده: 689,090,968 ریال \n1405/06/31\n11:23",
        "sender": "TejaratBank",
        "type": "income",
        "amount": 685426335,
        "balance": 689090968,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "mehr-iran",
    "name": "بانک قرض‌الحسنه مهر ایران",
    "keywords": [
      "مهر ایران"
    ],
    "senders": [
      "B.QMEHRIRAN"
    ],
    "samples": [
      {
        "text": "300362322544 \n400,000-\n1405/7/1-16:31\nمانده:2,279,556",
        "sender": "B.QMEHRIRAN",
        "type": "expense",
        "amount": 400000,
        "balance": 2279556,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": " 300362322544  \n5,000,000+\n1405/7/11-14:40\n مانده:7,239,695",
        "sender": "B.QMEHRIRAN",
        "type": "income",
        "amount": 5000000,
        "balance": 7239695,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  },
  {
    "id": "khavarmianeh",
    "name": "بانک خاورمیانه",
    "keywords": [
      "خاورمیانه"
    ],
    "senders": [
      "KH M BANK"
    ],
    "samples": [
      {
        "text": "بانک خاورمیانه\n838/000115456\n-208,000,000\n07/08\n15:58\nمانده 536,365\nبرداشت حواله پل",
        "sender": "KH M BANK",
        "type": "expense",
        "amount": 208000000,
        "balance": 536365,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      },
      {
        "text": "بانک خاورمیانه\n838/000115456\n+200,000,000\n07/08\n15:57\nمانده 208,536,365",
        "sender": "KH M BANK",
        "type": "income",
        "amount": 200000000,
        "balance": 208536365,
        "source": "https://github.com/nos486/realrate/blob/db203be7d5b411d97d29852dc780878cc16cb6e8/api/tests/unit/bankSms.test.js",
        "kind": "reported-real-format-numbers-changed"
      }
    ]
  }
];})(typeof window!=="undefined"?window:globalThis);
