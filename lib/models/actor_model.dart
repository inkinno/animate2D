import 'action_model.dart';

class ActorModel {
  final String actorId;
  final String assetPath;
  final int zIndex;
  final List<ActionModel> actions;
  final List<ActorModel>? children; // 계층적 모듈화 (Matrix Transform) 지원

  ActorModel({
    required this.actorId,
    required this.assetPath,
    required this.zIndex,
    required this.actions,
    this.children,
  });

  factory ActorModel.fromJson(Map<String, dynamic> json) {
    return ActorModel(
      actorId: json['actor_id'] ?? '',
      assetPath: json['asset_path'] ?? '',
      zIndex: json['z_index'] ?? 0,
      actions: (json['actions'] as List<dynamic>?)
              ?.map((e) => ActionModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => ActorModel.fromJson(e as Map<String, dynamic>))
              .toList(),
    );
  }
}
