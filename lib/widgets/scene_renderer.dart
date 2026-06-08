import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/scene_model.dart';
import '../controllers/engine_controller.dart';
import 'actor_renderer.dart';

class SceneRenderer extends StatelessWidget {
  final SceneModel scene;

  const SceneRenderer({super.key, required this.scene});

  @override
  Widget build(BuildContext context) {
    return Consumer<EngineController>(
      builder: (context, controller, child) {
        int elapsedMs = controller.elapsedMs;

        // Check if scene is active
        if (elapsedMs < scene.startTimeMs || elapsedMs > scene.endTimeMs) {
          return const SizedBox.shrink(); // Hide if outside of scene time
        }

        // Sort actors by z-index
        var sortedActors = List.from(scene.actors)
          ..sort((a, b) => a.zIndex.compareTo(b.zIndex));
        
        List<Widget> stackChildren = [];
        
        // Background
        if (scene.background != null) {
          if (scene.background!.type == 'image') {
            stackChildren.add(
              Positioned.fill(
                child: Image.asset(
                  scene.background!.assetPath,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(color: Colors.grey);
                  },
                ),
              ),
            );
          } else {
             // can handle color
             // Color c = Color(int.parse(scene.background!.color.replaceAll('#', '0xff')));
          }
        }

        // Add Actors
        stackChildren.addAll(sortedActors.map((actor) => ActorRenderer(actor: actor)).toList());

        return Stack(
          children: stackChildren,
        );
      },
    );
  }
}
