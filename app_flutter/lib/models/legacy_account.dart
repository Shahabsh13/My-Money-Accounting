import 'dart:convert';

/// Account data in the JSON format used by the original app.
///
/// This is separate from the current SQLite Account model: legacy identifiers,
/// hierarchy, initial balance and unknown fields must not be discarded during
/// future migration. No import or database writes are performed here.
class LegacyAccount {
  LegacyAccount.fromJson(Map<String, dynamic> json) : _data = _copy(json);

  final Map<String, dynamic> _data;

  Object? get id => _data['id'];
  Object? get name => _data['name'];
  Object? get group => _data['group'];
  Object? get parentId => _data['parentId'];
  Object? get initialBalance => _data['initialBalance'];
  Object? get active => _data['active'];
  Object? get system => _data['system'];

  Map<String, dynamic> toJson() => _copy(_data);

  static Map<String, dynamic> _copy(Map<String, dynamic> data) =>
      jsonDecode(jsonEncode(data)) as Map<String, dynamic>;
}
