import 'package:flutter/material.dart';
import '../models/node_model.dart';
import '../controllers/engine_controller.dart';
import 'package:provider/provider.dart';

class ChoiceOverlay extends StatelessWidget {
  final EventNodeModel eventNode;

  const ChoiceOverlay({Key? key, required this.eventNode}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: eventNode.choices.map((choice) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8.0),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  textStyle: const TextStyle(fontSize: 18),
                ),
                onPressed: () {
                  Provider.of<EngineController>(context, listen: false).makeChoice(choice.nextNodeId);
                },
                child: Text(choice.label),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
