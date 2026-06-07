import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../controllers/timeline_controller.dart';
import '../widgets/scene_renderer.dart';

class ViewerScreen extends StatefulWidget {
  const ViewerScreen({Key? key}) : super(key: key);

  @override
  _ViewerScreenState createState() => _ViewerScreenState();
}

class _ViewerScreenState extends State<ViewerScreen> with SingleTickerProviderStateMixin {
  late TimelineController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Provider.of<TimelineController>(context, listen: false);
    _controller.initController(this);
    
    // Load timeline data
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _controller.loadTimeline('assets/data/timeline.json');
      _controller.play(); // Auto-play
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<TimelineController>(
        builder: (context, controller, child) {
          if (controller.timeline == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return Stack(
            children: controller.timeline!.scenes
                .map((scene) => SceneRenderer(scene: scene))
                .toList(),
          );
        },
      ),
      floatingActionButton: Consumer<TimelineController>(
        builder: (context, controller, child) {
          return FloatingActionButton(
            onPressed: () {
              if (controller.isPlaying) {
                controller.pause();
              } else {
                if (controller.elapsedMs >= (controller.timeline?.totalDurationMs ?? 0)) {
                  controller.reset();
                }
                controller.play();
              }
            },
            child: Icon(controller.isPlaying ? Icons.pause : Icons.play_arrow),
          );
        },
      ),
    );
  }
}
