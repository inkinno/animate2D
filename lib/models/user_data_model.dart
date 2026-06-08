class UserDataModel {
  final Map<String, dynamic> userSave;

  UserDataModel({
    required this.userSave,
  });

  factory UserDataModel.fromJson(Map<String, dynamic> json) {
    return UserDataModel(
      userSave: json,
    );
  }

  dynamic getValue(String key) {
    return userSave[key];
  }
}
