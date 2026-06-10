import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/scene_model.dart';
import '../models/action_model.dart';
import '../controllers/engine_controller.dart';
import '../utils/tween_evaluator.dart';
import 'actor_renderer.dart';
import 'dart:math' as math;

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

        // --- Camera Track Evaluation ---
        double camX = 0.0;
        double camY = 0.0;
        double camScale = 1.0;
        double camRotation = 0.0;

        if (scene.cameraTrack != null) {
          // 1. Initial values
          for (var action in scene.cameraTrack!.actions) {
            if (action.type == ActionType.move && action.fromX != null) {
              camX = action.fromX!; camY = action.fromY ?? 0.0;
            }
            if (action.type == ActionType.scale && action.fromScale != null) {
              camScale = action.fromScale!;
            }
            if (action.type == ActionType.rotate && action.fromAngle != null) {
              camRotation = action.fromAngle!;
            }
          }

          // 2. Evaluate
          for (var action in scene.cameraTrack!.actions) {
            int start = action.startMs + action.randomStartOffset;
            int end = action.endMs + action.randomStartOffset;
            
            if (elapsedMs >= start) {
              double currentVal = 1.0;
              if (elapsedMs < end) {
                 currentVal = TweenEvaluator.evaluate(action, elapsedMs - action.randomStartOffset);
              } else {
                 if (action.isLoop) {
                    int duration = end - start;
                    if (duration > 0) {
                       int localMs = (elapsedMs - start) % duration;
                       currentVal = TweenEvaluator.evaluate(action, start + localMs - action.randomStartOffset);
                    }
                 } else if (!action.playOnceAndHold) {
                    currentVal = 0.0; 
                 }
              }

              switch (action.type) {
                case ActionType.move:
                  if (action.fromX != null && action.toX != null) {
                    camX = action.fromX! + (action.toX! - action.fromX!) * currentVal;
                  }
                  if (action.fromY != null && action.toY != null) {
                    camY = action.fromY! + (action.toY! - action.fromY!) * currentVal;
                  }
                  break;
                case ActionType.scale:
                  if (action.fromScale != null && action.toScale != null) {
                    camScale = action.fromScale! + (action.toScale! - action.fromScale!) * currentVal;
                  }
                  break;
                case ActionType.rotate:
                  if (action.fromAngle != null && action.toAngle != null) {
                    camRotation = action.fromAngle! + (action.toAngle! - action.fromAngle!) * currentVal;
                  }
                  break;
                default:
                  break;
              }
            }
          }
        }
        // ---------------------------------

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
          }
        }

        // Add Actors
        stackChildren.addAll(sortedActors.map((actor) => ActorRenderer(actor: actor)).toList());

        // 씬 렌더링 코어 (카메라 역변환 적용)
        Widget sceneRoot = Stack(
          children: stackChildren,
        );

        if (scene.cameraTrack != null) {
          // 화면 중앙을 기준으로 줌/회전하도록 MediaQuery를 참조
          final screenSize = MediaQuery.of(context).size;
          // 카메라 이동은 반대로(-camX, -camY), 스케일은 그대로, 회전은 반대로 적용
          sceneRoot = Transform.translate(
            offset: Offset(-camX, -camY),
            child: Transform.scale(
              scale: camScale,
              alignment: Alignment.center,
              child: Transform.rotate(
                angle: -camRotation * math.pi / 180,
                alignment: Alignment.center,
                child: SizedBox(
                   width: screenSize.width,
                   height: screenSize.height,
                   child: sceneRoot,
                ),
              ),
            ),
          );
        }

        return sceneRoot;
      },
    );
  }
}
