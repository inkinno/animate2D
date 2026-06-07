import 'actor_model.dart';

class BackgroundModel {
  final String type;
  final String assetPath;
  final String color;

  BackgroundModel({
    required this.type,
    required this.assetPath,
    required this.color,
  });

  factory BackgroundModel.fromJson(Map<String, dynamic> json) {
    return BackgroundModel(
      type: json['type'] ?? '',
      assetPath: json['asset_path'] ?? '',
      color: json['color'] ?? '#FFFFFF',
    );
  }
}

class SceneModel {
  final String sceneId;
  final int startTimeMs;
  final int endTimeMs;
  final BackgroundModel? background;
  final List<ActorModel> actors;

  SceneModel({
    required this.sceneId,
    required this.startTimeMs,
    required this.endTimeMs,
    this.background,
    required this.actors,
  });

  factory SceneModel.fromJson(Map<String, dynamic> json) {
    return SceneModel(
      sceneId: json['scene_id'] ?? '',
      startTimeMs: json['start_time_ms'] ?? 0,
      endTimeMs: json['end_time_ms'] ?? 0,
      background: json['background'] != null
          ? BackgroundModel.fromJson(json['background'])
          : null,
      actors: (json['actors'] as List<dynamic>?)
              ?.map((e) => ActorModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
