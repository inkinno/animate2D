enum ActionType { fade, move, scale, rotate, none }

class ActionModel {
  final ActionType type;
  final int startMs;
  final int endMs;
  final double? from;
  final double? to;
  final double? fromX;
  final double? fromY;
  final double? toX;
  final double? toY;
  final double? fromScale;
  final double? toScale;
  final double? fromAngle;
  final double? toAngle;
  final String curve;

  ActionModel({
    required this.type,
    required this.startMs,
    required this.endMs,
    this.from,
    this.to,
    this.fromX,
    this.fromY,
    this.toX,
    this.toY,
    this.fromScale,
    this.toScale,
    this.fromAngle,
    this.toAngle,
    required this.curve,
  });

  factory ActionModel.fromJson(Map<String, dynamic> json) {
    ActionType type = ActionType.values.firstWhere(
      (e) => e.toString().split('.').last == json['type'],
      orElse: () => ActionType.none,
    );
    return ActionModel(
      type: type,
      startMs: json['start_ms'] ?? 0,
      endMs: json['end_ms'] ?? 0,
      from: json['from']?.toDouble(),
      to: json['to']?.toDouble(),
      fromX: json['from_x']?.toDouble(),
      fromY: json['from_y']?.toDouble(),
      toX: json['to_x']?.toDouble(),
      toY: json['to_y']?.toDouble(),
      fromScale: json['from_scale']?.toDouble(),
      toScale: json['to_scale']?.toDouble(),
      fromAngle: json['from_angle']?.toDouble(),
      toAngle: json['to_angle']?.toDouble(),
      curve: json['curve'] ?? 'linear',
    );
  }
}
