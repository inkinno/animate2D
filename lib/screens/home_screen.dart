import 'package:flutter/material.dart';
import '../widgets/episode_card.dart';
import 'viewer_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Generate some dummy episodes for now
    final List<Map<String, String>> episodes = [
      {
        'title': '프린세스 메이냥 - 15턴의 이세계 묘생',
        'image': 'assets/images/episode_1_cover.png',
        'episode_path': 'assets/data/episode_nodes.json',
        'user_save_path': 'assets/data/user_save.json',
      },
      {
        'title': '다가오는 폭풍 (업데이트 예정)',
        'image': 'assets/images/episode_1_cover.png',
        'episode_path': '',
        'user_save_path': '',
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E), // Dark modern background
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Animate2D',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('설정 화면은 준비 중입니다.')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.person, color: Colors.white),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('로그인 기능은 준비 중입니다.')),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '게임을 선택하세요',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '당신의 이야기를 만들어보세요',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 32),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    // Responsive grid based on width
                    int crossAxisCount = constraints.maxWidth > 1200
                        ? 4
                        : constraints.maxWidth > 800
                            ? 3
                            : constraints.maxWidth > 500
                                ? 2
                                : 1;

                    return GridView.builder(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: crossAxisCount,
                        childAspectRatio: 0.75,
                        crossAxisSpacing: 24,
                        mainAxisSpacing: 24,
                      ),
                      itemCount: episodes.length,
                      itemBuilder: (context, index) {
                        final ep = episodes[index];
                        return EpisodeCard(
                          title: ep['title']!,
                          imagePath: ep['image']!,
                          onTap: () {
                            if (ep['episode_path']!.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('아직 준비되지 않은 에피소드입니다.')),
                              );
                              return;
                            }
                            // Navigate to Viewer
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ViewerScreen(
                                  episodePath: ep['episode_path']!,
                                  userSavePath: ep['user_save_path']!,
                                ),
                              ),
                            );
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
