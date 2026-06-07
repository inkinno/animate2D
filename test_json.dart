import 'dart:io';
import 'dart:convert';
import 'lib/models/timeline_model.dart';

void main() async {
  try {
    final file = File('assets/data/timeline.json');
    final response = await file.readAsString();
    final data = json.decode(response);
    final timeline = TimelineModel.fromJson(data);
    print('Timeline parsed successfully: \${timeline.timelineId}, scenes: \${timeline.scenes.length}');
    for (var scene in timeline.scenes) {
      print('Scene: \${scene.sceneId}, actors: \${scene.actors.length}');
      for (var actor in scene.actors) {
         print('Actor: \${actor.actorId}, actions: \${actor.actions.length}');
      }
    }
  } catch (e, stack) {
    print('Error: $e');
    print(stack);
  }
}
