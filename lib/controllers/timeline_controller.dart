import 'package:flutter/material.dart';
import '../models/timeline_model.dart';
import 'dart:convert';
import 'package:flutter/services.dart';

class TimelineController extends ChangeNotifier {
  TimelineModel? _timeline;
  TimelineModel? get timeline => _timeline;

  int _elapsedMs = 0;
  int get elapsedMs => _elapsedMs;

  bool _isPlaying = false;
  bool get isPlaying => _isPlaying;

  late AnimationController _animationController;

  void initController(TickerProvider vsync) {
    _animationController = AnimationController(
      vsync: vsync,
    )..addListener(() {
        _elapsedMs = (_animationController.value * (_timeline?.totalDurationMs ?? 10000)).toInt();
        notifyListeners();
      });
  }

  Future<void> loadTimeline(String assetPath) async {
    try {
      final String response = await rootBundle.loadString(assetPath);
      final data = await json.decode(response);
      _timeline = TimelineModel.fromJson(data);
      _animationController.duration = Duration(milliseconds: _timeline!.totalDurationMs);
      notifyListeners();
    } catch (e) {
      print('Error loading timeline: $e');
    }
  }

  void play() {
    if (_timeline == null) return;
    _isPlaying = true;
    _animationController.forward(from: _animationController.value);
    notifyListeners();
  }

  void pause() {
    _isPlaying = false;
    _animationController.stop();
    notifyListeners();
  }

  void reset() {
    _isPlaying = false;
    _animationController.reset();
    _elapsedMs = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
}
