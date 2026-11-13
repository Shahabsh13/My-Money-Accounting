import 'dart:convert';

/// Lossless JSON representation of a document from the original application.
///
/// Identifiers, optional properties and unknown nested fields are preserved;
/// absent fields are not manufactured. This model does not write to SQLite.
class LegacyTransaction {
  LegacyTransaction.fromJson(Map<String, dynamic> json) : _data = _copy(json);

  final Map<String, dynamic> _data;

  Object? get id => _data['id'];
  Object? get documentNumber => _data['documentNumber'];
  Object? get type => _data['type'];
  Object? get amount => _data['amount'];
  Object? get account => _data['account'];
  Object? get destinationAccount => _data['destinationAccount'];
  Object? get category => _data['category'];
  Object? get date => _data['date'];
  Object? get feeAmount => _data['feeAmount'];
  Object? get feeAccount => _data['feeAccount'];
  Object? get isCompound => _data['isCompound'];
  Object? get isReversal => _data['isReversal'];
  Object? get isRefundReceipt => _data['isRefundReceipt'];
  Object? get reversalOfDocNumber => _data['reversalOfDocNumber'];

  // Return copies so that modifying a nested check or entry cannot mutate the model.
  Object? get check => toJson()['check'];
  Object? get compoundSources => toJson()['compoundSources'];
  Object? get compoundDestinations => toJson()['compoundDestinations'];

  Map<String, dynamic> toJson() => _copy(_data);

  static Map<String, dynamic> _copy(Map<String, dynamic> data) =>
      jsonDecode(jsonEncode(data)) as Map<String, dynamic>;
}
