import 'node_model.dart';

class TimelineModel {
  final String episodeId;
  final String startNodeId;
  final Map<String, BaseNodeModel> nodes;

  TimelineModel({
    required this.episodeId,
    required this.startNodeId,
    required this.nodes,
  });

  factory TimelineModel.fromJson(Map<String, dynamic> json) {
    final Map<String, BaseNodeModel> parsedNodes = {};
    
    if (json['nodes'] != null) {
      final nodesList = json['nodes'] as List<dynamic>;
      for (var nodeJson in nodesList) {
        final node = BaseNodeModel.fromJson(nodeJson);
        parsedNodes[node.nodeId] = node;
      }
    }

    return TimelineModel(
      episodeId: json['episode_id'] ?? '',
      startNodeId: json['start_node_id'] ?? '',
      nodes: parsedNodes,
    );
  }
}
