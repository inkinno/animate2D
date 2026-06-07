import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/actor_model.dart';
import '../models/action_model.dart';
import '../controllers/timeline_controller.dart';
import '../utils/tween_evaluator.dart';
import 'dart:math' as math;

class ActorRenderer extends StatelessWidget {
  final ActorModel actor;

  const ActorRenderer({Key? key, required this.actor}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<TimelineController>(
      builder: (context, controller, child) {
        int elapsedMs = controller.elapsedMs;

        double opacity = 1.0;
        double x = 0.0;
        double y = 0.0;
        double scale = 1.0;
        double rotation = 0.0; // in degrees

        // 1. Set initial values based on the first action's 'from' parameters
        for (var action in actor.actions) {
          if (action.type == ActionType.move && action.fromX != null) {
            x = action.fromX!;
            y = action.fromY ?? 0.0;
            break;
          }
        }
        for (var action in actor.actions) {
          if (action.type == ActionType.scale && action.fromScale != null) {
            scale = action.fromScale!;
            break;
          }
        }
        for (var action in actor.actions) {
          if (action.type == ActionType.fade && action.from != null) {
            opacity = action.from!;
            break;
          }
        }
        for (var action in actor.actions) {
          if (action.type == ActionType.rotate && action.fromAngle != null) {
            rotation = action.fromAngle!;
            break;
          }
        }

        // 2. Evaluate actions based on current time
        for (var action in actor.actions) {
          if (elapsedMs >= action.startMs) {
            double currentVal;
            if (elapsedMs >= action.endMs) {
              currentVal = 1.0;
            } else {
              currentVal = TweenEvaluator.evaluate(action, elapsedMs);
            }

            switch (action.type) {
              case ActionType.fade:
                if (action.from != null && action.to != null) {
                  opacity = action.from! + (action.to! - action.from!) * currentVal;
                }
                break;
              case ActionType.move:
                if (action.fromX != null && action.toX != null) {
                  x = action.fromX! + (action.toX! - action.fromX!) * currentVal;
                }
                if (action.fromY != null && action.toY != null) {
                  y = action.fromY! + (action.toY! - action.fromY!) * currentVal;
                }
                break;
              case ActionType.scale:
                if (action.fromScale != null && action.toScale != null) {
                  scale = action.fromScale! + (action.toScale! - action.fromScale!) * currentVal;
                }
                break;
              case ActionType.rotate:
                if (action.fromAngle != null && action.toAngle != null) {
                  rotation = action.fromAngle! + (action.toAngle! - action.fromAngle!) * currentVal;
                }
                break;
              default:
                break;
            }
          }
        }

        return Positioned(
          left: x,
          top: y,
          child: Transform.scale(
            scale: scale,
            child: Transform.rotate(
              angle: rotation * math.pi / 180,
              child: Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Image.asset(
                  actor.assetPath,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 100,
                      height: 100,
                      color: Colors.red,
                      child: const Center(child: Text('Image Error')),
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
