import 'scene_model.dart';

class TimelineModel {
  final String timelineId;
  final int totalDurationMs;
  final List<SceneModel> scenes;

  TimelineModel({
    required this.timelineId,
    required this.totalDurationMs,
    required this.scenes,
  });

  factory TimelineModel.fromJson(Map<String, dynamic> json) {
    return TimelineModel(
      timelineId: json['timeline_id'] ?? '',
      totalDurationMs: json['total_duration_ms'] ?? 0,
      scenes: (json['scenes'] as List<dynamic>?)
              ?.map((e) => SceneModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
