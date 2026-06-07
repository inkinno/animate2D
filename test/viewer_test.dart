import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:viewer_web/main.dart';
import 'package:viewer_web/controllers/timeline_controller.dart';


void main() {
  testWidgets('ViewerScreen renders without error', (WidgetTester tester) async {
    FlutterError.onError = (FlutterErrorDetails details) {
      print('FlutterError: ' + details.exception.toString());
      print(details.stack);
    };

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => TimelineController()),
        ],
        child: const MyApp(),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
