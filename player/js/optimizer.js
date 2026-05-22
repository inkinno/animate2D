/**
 * 정적 대기 상태(Idle State) 리소스 최적화 및 부분 전력 루프 관리자
 * 
 * 타임라인 시퀀스의 재생이 종료되거나 유저 입력을 대기하는 상태에서
 * requestAnimationFrame 연산 루프 전체를 물리적으로 정지하지 않고,
 * 메인 타임라인 연산은 일시 휴면(Hibernate)시키되 캐릭터가 미세 호흡(Breathing) 및
 * 안구 깜빡임(Blink) 상태를 부드럽게 유지할 수 있도록 최소화 전력 연산만 대행합니다.
 */
export class IdleOptimizer {
  constructor() {
    this.isIdle = false;
    this.breathingPhase = 0;
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.blinkDuration = 150; // 안구 깜빡임 속도 (ms)
    this.nextBlinkInterval = 3000; // 다음 깜빡임 간격 (ms)
  }

  /**
   * 정적 대기 상태(Idle Mode) 진입 여부를 설정합니다.
   */
  setIdle(state) {
    this.isIdle = state;
    if (state) {
      this.breathingPhase = 0;
      this.blinkTimer = 0;
      this.isBlinking = false;
      console.log('[IdleOptimizer] 대기 모드 돌입 - 최소 전력 미세 호흡/깜빡임 루프 구동.');
    }
  }

  /**
   * 대기 상태 동안 캐릭터의 생동감(미세 진동 행렬) 유지를 위한 보간 가중치를 산출합니다.
   * 
   * @param {number} deltaTimeMs - 프레임 간 경과 시간
   * @returns {Object} 미세 보간 가중치 오프셋 { chestScaleY, eyeScaleY }
   */
  calculateIdleOffsets(deltaTimeMs) {
    if (!this.isIdle) {
      return { chestScaleY: 1.0, eyeScaleY: 1.0 };
    }

    // 1. 미세 호흡 (Breathing Variance): 사인파 기반 팽창 수축
    this.breathingPhase += deltaTimeMs * 0.002; // 느릿한 호흡 속도 가중치
    const breathingOffset = Math.sin(this.breathingPhase) * 0.015; // 최대 1.5% 미세 팽창

    // 2. 안구 깜빡임 (Blink Tick): 결정론적 타이머에 의해 0.15초만 안구 스케일 축소
    this.blinkTimer += deltaTimeMs;
    
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    } else if (this.isBlinking && this.blinkTimer >= this.blinkDuration) {
      this.isBlinking = false;
      this.blinkTimer = 0;
      // 다음 안구 깜빡임 지점을 2초 ~ 5초 사이로 무작위 배정
      this.nextBlinkInterval = 2000 + Math.random() * 3000;
    }

    const eyeScaleY = this.isBlinking ? 0.1 : 1.0; // 눈 감을 시 Y축 압축

    return {
      chestScaleY: 1.0 + breathingOffset,
      eyeScaleY: eyeScaleY
    };
  }
}
