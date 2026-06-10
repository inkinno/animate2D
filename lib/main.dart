import 'package:flutter/material.dart';
import 'dart:convert';

// 파이썬 메이커가 만든 임시 JSON 데이터 (테스트용)
const String dummyJson = '''
{
  "total_duration_ms": 15000,
  "scenes": [
    {
      "scene_id": "scene_01",
      "actors": []
    }
  ]
}
''';

void main() {
  runApp(const PixelNovelEngine());
}

class PixelNovelEngine extends StatelessWidget {
  const PixelNovelEngine({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: '프린세스 메이냥 플레이어',
      home: Scaffold(
        backgroundColor: const Color(0xFF1E1E1E), // 다크 캔버스 배경
        body: FlutterEpisodePlayer(jsonString: dummyJson),
      ),
    );
  }
}

class FlutterEpisodePlayer extends StatefulWidget {
  final String jsonString;
  const FlutterEpisodePlayer({Key? key, required this.jsonString}) : super(key: key);

  @override
  State<FlutterEpisodePlayer> createState() => _FlutterEpisodePlayerState();
}

class _FlutterEpisodePlayerState extends State<FlutterEpisodePlayer> with SingleTickerProviderStateMixin {
  late AnimationController _masterController;
  Map<String, dynamic> _episodeData = {};

  @override
  void initState() {
    super.initState();
    
    // 1. JSON 데이터 파싱
    _episodeData = jsonDecode(widget.jsonString);
    int totalDuration = _episodeData['total_duration_ms'] ?? 10000;

    // 2. 마스터 타임라인 컨트롤러 세팅
    _masterController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: totalDuration),
    );

    // 3. 엔진 루프: 타임라인이 흐를 때마다 화면을 리빌드 (실시간 렌더링)
    _masterController.addListener(() {
      setState(() {}); 
    });

    // 시작과 동시에 자동 재생 (추후 버튼 트리거로 변경 가능)
    _masterController.forward();
  }

  @override
  void dispose() {
    _masterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 현재 경과 시간 계산 (ms)
    double currentTimeMs = _masterController.value * _masterController.duration!.inMilliseconds;

    return Center(
      child: AspectRatio(
        aspectRatio: 16 / 9, // 고정된 뷰포트 비율 (카메라 렌즈 역할)
        child: Container(
          color: Colors.black,
          child: Stack(
            clipBehavior: Clip.hardEdge, // 뷰포트 밖으로 나가는 파츠는 잘라냄 (가벼운 컬링 효과)
            children: [
              // TODO: 여기에 JSON 데이터를 기반으로 파츠(Actor)들이 렌더링 됩니다.
              
              // 현재 타임라인 시간 확인용 더미 텍스트
              Positioned(
                top: 20,
                left: 20,
                child: Text(
                  "마스터 타임라인: ${currentTimeMs.toInt()} ms / ${_masterController.duration!.inMilliseconds} ms",
                  style: const TextStyle(color: Colors.greenAccent, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}