import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../controllers/engine_controller.dart';
import '../widgets/scene_renderer.dart';
import '../widgets/choice_overlay.dart';
import '../models/node_model.dart';

class ViewerScreen extends StatefulWidget {
  final String episodePath;
  final String userSavePath;
  const ViewerScreen({
    Key? key,
    required this.episodePath,
    required this.userSavePath,
  }) : super(key: key);

  @override
  _ViewerScreenState createState() => _ViewerScreenState();
}

class _ViewerScreenState extends State<ViewerScreen> with SingleTickerProviderStateMixin {
  late EngineController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Provider.of<EngineController>(context, listen: false);
    _controller.initController(this);
    
    // Load data
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _controller.loadData(widget.episodePath, widget.userSavePath);
      _controller.startEngine(); // Start flat graph execution
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Consumer<EngineController>(
        builder: (context, controller, child) {
          final currentNode = controller.currentNode;

          if (currentNode == null) {
            return const Center(child: CircularProgressIndicator());
          }

          Widget currentView;
          
          if (currentNode is SceneNodeModel) {
            currentView = SceneRenderer(scene: currentNode.sceneData);
          } else if (currentNode is EventNodeModel) {
            currentView = ChoiceOverlay(eventNode: currentNode);
          } else {
            currentView = const SizedBox.shrink(); // Condition node
          }

          return Stack(
            children: [
              currentView,
              Positioned(
                top: 16,
                left: 16,
                child: SafeArea(
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white, size: 30),
                    onPressed: () {
                      controller.pause();
                      Navigator.pop(context);
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: Consumer<EngineController>(
        builder: (context, controller, child) {
          return FloatingActionButton(
            onPressed: () {
              if (controller.isPlaying) {
                controller.pause();
              } else {
                controller.resume();
              }
            },
            child: Icon(controller.isPlaying ? Icons.pause : Icons.play_arrow),
          );
        },
      ),
    );
  }
}
