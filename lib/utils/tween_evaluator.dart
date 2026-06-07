import 'package:flutter/animation.dart';
import '../models/action_model.dart';

class TweenEvaluator {
  static double evaluate(ActionModel action, int elapsedMs) {
    if (elapsedMs <= action.startMs) return 0.0;
    if (elapsedMs >= action.endMs) return 1.0;

    double progress = (elapsedMs - action.startMs) / (action.endMs - action.startMs);
    Curve curve = _getCurve(action.curve);
    return curve.transform(progress);
  }

  static double evaluateValue(ActionModel action, int elapsedMs, double from, double to) {
    double progress = evaluate(action, elapsedMs);
    return from + (to - from) * progress;
  }

  static Curve _getCurve(String curveName) {
    switch (curveName) {
      case 'easeIn':
        return Curves.easeIn;
      case 'easeOut':
        return Curves.easeOut;
      case 'easeInOut':
        return Curves.easeInOut;
      case 'bounceOut':
        return Curves.bounceOut;
      case 'linear':
      default:
        return Curves.linear;
    }
  }
}
