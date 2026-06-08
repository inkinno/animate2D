import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import '../models/timeline_model.dart';
import '../models/node_model.dart';
import '../models/user_data_model.dart';

class EngineController extends ChangeNotifier {
  TimelineModel? _timeline;
  UserDataModel? _userData;

  BaseNodeModel? _currentNode;
  BaseNodeModel? get currentNode => _currentNode;

  bool _isPlaying = false;
  bool get isPlaying => _isPlaying;

  late AnimationController _animationController;
  AnimationController get animationController => _animationController;

  void initController(TickerProvider vsync) {
    _animationController = AnimationController(
      vsync: vsync,
    )
      ..addListener(() {
        notifyListeners();
      })
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _onSceneCompleted();
        }
      });
  }

  int get elapsedMs {
    if (_currentNode is SceneNodeModel) {
      final sceneNode = _currentNode as SceneNodeModel;
      final duration = sceneNode.sceneData.endTimeMs - sceneNode.sceneData.startTimeMs;
      return (_animationController.value * (duration > 0 ? duration : 1000)).toInt();
    }
    return 0;
  }

  Future<void> loadData(String episodePath, String userSavePath) async {
    try {
      final String epResponse = await rootBundle.loadString(episodePath);
      final epData = await json.decode(epResponse);
      _timeline = TimelineModel.fromJson(epData);

      final String userResponse = await rootBundle.loadString(userSavePath);
      final userDataJson = await json.decode(userResponse);
      _userData = UserDataModel.fromJson(userDataJson);

      notifyListeners();
    } catch (e) {
      print('Error loading data: $e');
    }
  }

  void startEngine() {
    if (_timeline == null || _userData == null) return;
    _playNode(_timeline!.startNodeId);
  }

  void _playNode(String? nodeId) {
    if (nodeId == null || nodeId.isEmpty) {
      _isPlaying = false;
      notifyListeners();
      return; // End of graph
    }

    _currentNode = _timeline!.nodes[nodeId];
    if (_currentNode == null) return;

    if (_currentNode is SceneNodeModel) {
      final sceneNode = _currentNode as SceneNodeModel;
      int duration = sceneNode.sceneData.endTimeMs - sceneNode.sceneData.startTimeMs;
      if (duration <= 0) duration = 1000;
      
      _animationController.duration = Duration(milliseconds: duration);
      _animationController.reset();
      _animationController.forward();
      _isPlaying = true;
      notifyListeners();
    } else if (_currentNode is ConditionNodeModel) {
      _evaluateCondition(_currentNode as ConditionNodeModel);
    } else if (_currentNode is EventNodeModel) {
      _handleEvent(_currentNode as EventNodeModel);
    }
  }

  void _onSceneCompleted() {
    if (_currentNode is SceneNodeModel) {
      final sceneNode = _currentNode as SceneNodeModel;
      _playNode(sceneNode.nextNodeId);
    }
  }

  void _evaluateCondition(ConditionNodeModel conditionNode) {
    final userVal = _userData?.getValue(conditionNode.targetVar);
    bool result = false;

    if (conditionNode.operatorStr == '==') {
      result = userVal == conditionNode.value;
    } else if (conditionNode.operatorStr == '!=') {
      result = userVal != conditionNode.value;
    } else if (conditionNode.operatorStr == '>=') {
      result = (userVal ?? 0) >= (conditionNode.value ?? 0);
    } else if (conditionNode.operatorStr == '<=') {
      result = (userVal ?? 0) <= (conditionNode.value ?? 0);
    } else if (conditionNode.operatorStr == '>') {
      result = (userVal ?? 0) > (conditionNode.value ?? 0);
    } else if (conditionNode.operatorStr == '<') {
      result = (userVal ?? 0) < (conditionNode.value ?? 0);
    }

    final nextId = result ? conditionNode.trueNodeId : conditionNode.falseNodeId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _playNode(nextId);
    });
  }

  void _handleEvent(EventNodeModel eventNode) {
    _isPlaying = false;
    if (_animationController.isAnimating) {
      _animationController.stop();
    }
    notifyListeners();
  }

  void makeChoice(String nextNodeId) {
    _playNode(nextNodeId);
  }

  void pause() {
    if (_currentNode is SceneNodeModel) {
      _isPlaying = false;
      _animationController.stop();
      notifyListeners();
    }
  }

  void resume() {
    if (_currentNode is SceneNodeModel && !_isPlaying) {
      _isPlaying = true;
      _animationController.forward();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
}
