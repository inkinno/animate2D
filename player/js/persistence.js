/**
 * 영속적 상태 저장 모듈 (State Persistence Module)
 * 
 * 브라우저 환경에서 유저의 비정상적인 이탈(뒤로가기, 새로고침, 탭 닫기)에 실시간 대응하며,
 * LocalStorage / IndexedDB 쓰기 실패(보안 정책, 용량 초과 등) 시 메모리 상의 임시 Map으로
 * 자동 대체(Bypass Fallback)되는 메모리-스토리지 듀얼 버퍼 아키텍처를 가집니다.
 */
export class StatePersistence {
  constructor(saveKey = '2d_skeletal_save') {
    this.saveKey = saveKey;
    this.memoryFallbackStore = {};
    this.isStorageAvailable = this.checkStorageAvailability();
  }

  /**
   * 브라우저 LocalStorage 가용 여부를 안전성 사전 체크합니다.
   */
  checkStorageAvailability() {
    try {
      const x = '__storage_test__';
      localStorage.setItem(x, x);
      localStorage.removeItem(x);
      return true;
    } catch (e) {
      console.warn('[StatePersistence] 로컬 스토리지를 사용할 수 없어 메모리 맵으로 바이패스합니다.');
      return false;
    }
  }

  /**
   * 유저의 감상 씬, 경과 시간, 선택 상태 플래그 데이터를 실시간 비동기 스냅샷으로 저장합니다.
   * 
   * @param {string} sceneId - 현재 플레이 중인 씬 ID
   * @param {number} timeMs - 현재 타임라인의 밀리초 지점
   * @param {Object} stateFlags - 유저의 분기점 선택 완료 플래그 상태 객체
   */
  saveSnapshot(sceneId, timeMs, stateFlags = {}) {
    const payload = {
      sceneId,
      timeMs,
      stateFlags,
      timestamp: Date.now()
    };

    if (this.isStorageAvailable) {
      try {
        localStorage.setItem(this.saveKey, JSON.stringify(payload));
      } catch (e) {
        console.error('[StatePersistence] 데이터 쓰기 에러 (용량 초과 등) - 메모리 버퍼로 바이패스.', e);
        this.memoryFallbackStore[this.saveKey] = payload;
      }
    } else {
      this.memoryFallbackStore[this.saveKey] = payload;
    }
  }

  /**
   * 저장되어 있던 최종 체크포인트 진행 데이터를 포착하여 반환합니다.
   * 
   * @returns {Object|null} 세이브 포인트 페이로드 또는 null
   */
  loadSnapshot() {
    if (this.isStorageAvailable) {
      try {
        const raw = localStorage.getItem(this.saveKey);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (e) {
        console.error('[StatePersistence] 데이터 복원 에러 - 메모리 스냅샷 조회 전환.', e);
      }
    }
    return this.memoryFallbackStore[this.saveKey] || null;
  }

  /**
   * 유저가 리셋(처음으로 돌아가기)을 트리거할 시 축적되던 진행 데이터 스택을 영구 파기합니다.
   */
  clearSnapshot() {
    if (this.isStorageAvailable) {
      try {
        localStorage.removeItem(this.saveKey);
      } catch (e) {
        console.error('[StatePersistence] 세이브 파기 실패.', e);
      }
    }
    delete this.memoryFallbackStore[this.saveKey];
    console.log('[StatePersistence] 유저 진행 세이브 스택 마스터 리셋 완료.');
  }
}
