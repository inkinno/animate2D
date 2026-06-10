import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/actor_model.dart';
import '../models/action_model.dart';
import '../controllers/engine_controller.dart';
import '../utils/tween_evaluator.dart';
import 'dart:math' as math;

class ActorRenderer extends StatelessWidget {
  final ActorModel actor;
  final bool isRoot;

  const ActorRenderer({super.key, required this.actor, this.isRoot = true});

  @override
  Widget build(BuildContext context) {
    return Consumer<EngineController>(
      builder: (context, controller, child) {
        int elapsedMs = controller.elapsedMs;

        double opacity = 1.0;
        double x = 0.0;
        double y = 0.0;
        double scale = 1.0;
        double rotation = 0.0;

        // 1. 초기값 설정
        for (var action in actor.actions) {
          if (action.type == ActionType.move && action.fromX != null) {
            x = action.fromX!; y = action.fromY ?? 0.0;
          }
          if (action.type == ActionType.scale && action.fromScale != null) {
            scale = action.fromScale!;
          }
          if (action.type == ActionType.fade && action.from != null) {
            opacity = action.from!;
          }
          if (action.type == ActionType.rotate && action.fromAngle != null) {
            rotation = action.fromAngle!;
          }
        }

        // 2. 시간에 따른 액션 연산 (Tweening)
        for (var action in actor.actions) {
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

        // 3. 컬링 최적화 (Culling)
        final screenSize = MediaQuery.of(context).size;
        bool isOffscreen = false;
        if (isRoot) {
            if (x < -2000 || x > screenSize.width + 2000 || y < -2000 || y > screenSize.height + 2000) {
                isOffscreen = true;
            }
        }

        if (isOffscreen) {
            return const SizedBox(); // 컬링 적용 (렌더링 생략)
        }

        // 4. 위젯 트리 빌드 및 자식(Children) 재귀 호출
        Widget actorWidget = Transform.scale(
          scale: scale,
          child: Transform.rotate(
            angle: rotation * math.pi / 180,
            child: Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  if (actor.assetPath.isNotEmpty)
                    Image.asset(
                      actor.assetPath,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) => const SizedBox(),
                    ),
                  if (actor.children != null)
                    ...actor.children!.map((childActor) => ActorRenderer(
                          actor: childActor,
                          isRoot: false,
                        )),
                ],
              ),
            ),
          ),
        );

        if (isRoot) {
          // 본체(Root)는 Positioned로 절대 좌표 이동
          return Positioned(
            left: x,
            top: y,
            child: actorWidget,
          );
        } else {
          // 자식(Children)은 상위 객체 기준 상대 좌표(Translate) 이동
          return Transform.translate(
            offset: Offset(x, y),
            child: actorWidget,
          );
        }
      },
    );
  }
}
