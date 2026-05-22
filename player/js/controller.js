/**
 * 타임라인 재생 제어 및 양방향 스크롤 매핑 컨트롤러
 * 
 * 일반 결정론적 재생 외에 웹툰 스크롤 친화적인 2가지 모드를 지원합니다:
 * 1. 양방향 스크롤 매핑 모드: 마우스 휠 / 터치 스와이프 델타값을 타임라인의 경과 시간(ms)으로
 *    정/역방향 양방향 실시간 매핑 연산합니다.
 * 2. 단방향 트리거 모드: 휠 임계점 돌파 시 1회 정방향 재생 후 계산 Freeze 상태를 보장합니다.
 */
export class TimelineController {
  constructor(durationMs = 2000) {
    this.duration = durationMs;
    this.currentTime = 0;
    this.isPlaying = false;
    this.mode = 'PLAYING'; // 'PLAYING', 'SCROLL_MAPPED', 'TRIGGER_ONCE'
    
    this.scrollSensitivity = 1.2; // 스크롤 델타 -> ms 변환 가중치
    this.onTimeUpdate = null; // (currentTimeMs) => {}
    this.onPlaybackEnd = null; // () => {}
  }

  /**
   * 컨트롤러의 시간 재생 및 델타 갱신 연산
   * 
   * @param {number} deltaTimeMs - requestAnimationFrame 사이의 실제 경과 시간
   */
  tick(deltaTimeMs) {
    if (this.mode === 'PLAYING' && this.isPlaying) {
      this.setTime(this.currentTime + deltaTimeMs);
      if (this.currentTime >= this.duration) {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
      }
    }
  }

  /**
   * 현재 타임라인의 포인터 시간을 범위 안에서 강제 제한하며 갱신합니다.
   */
  setTime(timeMs) {
    const oldTime = this.currentTime;
    this.currentTime = Math.max(0, Math.min(this.duration, timeMs));
    
    if (oldTime !== this.currentTime && this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
  }

  /**
   * 일반 정방향 재생을 시작합니다.
   */
  play() {
    if (this.currentTime >= this.duration) {
      this.currentTime = 0; // 엔딩 회귀 시 초기화
    }
    this.isPlaying = true;
    this.mode = 'PLAYING';
  }

  /**
   * 일시 정지시킵니다.
   */
  pause() {
    this.isPlaying = false;
  }

  /**
   * 양방향 스크롤 매핑 모드를 활성화하고 마우스 휠 및 터치 이벤트를 바인딩합니다.
   * 
   * @param {HTMLElement} element - 이벤트를 주입받을 컨테이너 엘리먼트
   */
  enableScrollMapping(element) {
    this.mode = 'SCROLL_MAPPED';
    this.isPlaying = false;

    // 1. 마우스 휠 델타 매핑
    const wheelHandler = (e) => {
      e.preventDefault();
      // 휠 방향 및 델타값을 ms 단위로 양방향 변환 연산
      const timeDelta = e.deltaY * this.scrollSensitivity;
      this.setTime(this.currentTime + timeDelta);
    };

    // 2. 터치 스와이프 델타 매핑 (모바일 대응)
    let touchStartY = 0;
    const touchStartHandler = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const touchMoveHandler = (e) => {
      e.preventDefault();
      const currentY = e.touches[0].clientY;
      const deltaY = (touchStartY - currentY) * 2.5; // 터치 감도 보정
      touchStartY = currentY;
      
      const timeDelta = deltaY * this.scrollSensitivity;
      this.setTime(this.currentTime + timeDelta);
    };

    element.addEventListener('wheel', wheelHandler, { passive: false });
    element.addEventListener('touchstart', touchStartHandler, { passive: true });
    element.addEventListener('touchmove', touchMoveHandler, { passive: false });

    // 바인딩 해제를 위한 해제 람다 맵 리턴 (Clean up)
    return () => {
      element.removeEventListener('wheel', wheelHandler);
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchmove', touchMoveHandler);
    };
  }

  /**
   * 단방향 트리거 모드를 설정합니다.
   */
  enableTriggerOnceMode() {
    this.mode = 'TRIGGER_ONCE';
    this.isPlaying = false;
  }

  /**
   * 단방향 트리거 경계선 돌파를 시뮬레이션 및 가동합니다.
   */
  triggerOnce() {
    if (this.mode === 'TRIGGER_ONCE') {
      this.currentTime = 0;
      this.isPlaying = true;
      this.mode = 'PLAYING'; // 재생 개시하여 tick()에서 흘려 보낸 뒤 끝점에서 자동 동결
    }
  }

  /**
   * 타임라인 포인터를 0ms로 전면 리셋합니다. (Master Reset)
   */
  reset() {
    this.setTime(0);
    this.isPlaying = false;
  }
}
