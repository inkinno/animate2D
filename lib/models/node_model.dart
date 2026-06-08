import 'scene_model.dart';

enum NodeType {
  scene,
  condition,
  event,
}

abstract class BaseNodeModel {
  final String nodeId;
  final NodeType type;

  BaseNodeModel({
    required this.nodeId,
    required this.type,
  });

  factory BaseNodeModel.fromJson(Map<String, dynamic> json) {
    final String typeStr = json['type'] ?? 'scene';
    
    switch (typeStr) {
      case 'condition':
        return ConditionNodeModel.fromJson(json);
      case 'event':
        return EventNodeModel.fromJson(json);
      case 'scene':
      default:
        return SceneNodeModel.fromJson(json);
    }
  }
}

class SceneNodeModel extends BaseNodeModel {
  final String? nextNodeId;
  final SceneModel sceneData;

  SceneNodeModel({
    required String nodeId,
    this.nextNodeId,
    required this.sceneData,
  }) : super(nodeId: nodeId, type: NodeType.scene);

  factory SceneNodeModel.fromJson(Map<String, dynamic> json) {
    return SceneNodeModel(
      nodeId: json['node_id'] ?? '',
      nextNodeId: json['next_node_id'],
      sceneData: SceneModel.fromJson(json['scene_data'] ?? {}),
    );
  }
}

class ConditionNodeModel extends BaseNodeModel {
  final String targetVar;
  final String operatorStr;
  final dynamic value;
  final String trueNodeId;
  final String falseNodeId;

  ConditionNodeModel({
    required String nodeId,
    required this.targetVar,
    required this.operatorStr,
    required this.value,
    required this.trueNodeId,
    required this.falseNodeId,
  }) : super(nodeId: nodeId, type: NodeType.condition);

  factory ConditionNodeModel.fromJson(Map<String, dynamic> json) {
    return ConditionNodeModel(
      nodeId: json['node_id'] ?? '',
      targetVar: json['target_var'] ?? '',
      operatorStr: json['operator'] ?? '==',
      value: json['value'],
      trueNodeId: json['true_node_id'] ?? '',
      falseNodeId: json['false_node_id'] ?? '',
    );
  }
}

class EventChoice {
  final String label;
  final String nextNodeId;

  EventChoice({required this.label, required this.nextNodeId});

  factory EventChoice.fromJson(Map<String, dynamic> json) {
    return EventChoice(
      label: json['label'] ?? '',
      nextNodeId: json['next_node_id'] ?? '',
    );
  }
}

class EventNodeModel extends BaseNodeModel {
  final String eventType;
  final List<EventChoice> choices;

  EventNodeModel({
    required String nodeId,
    required this.eventType,
    required this.choices,
  }) : super(nodeId: nodeId, type: NodeType.event);

  factory EventNodeModel.fromJson(Map<String, dynamic> json) {
    var list = json['choices'] as List<dynamic>? ?? [];
    List<EventChoice> choiceList = list.map((i) => EventChoice.fromJson(i)).toList();

    return EventNodeModel(
      nodeId: json['node_id'] ?? '',
      eventType: json['event_type'] ?? '',
      choices: choiceList,
    );
  }
}
