/**
 * Maker Global State Store (반응형 상태 저장소)
 * 
 * SOLID 단일 책임 원칙(SRP)에 따라 메이커 전역 상태(마스터 데이터, 선택 요소, 프레임 시간)를 
 * 관리하고 LIFO Undo/Redo 스택(최대 50개 제한) 및 LocalStorage 영속화 예외 우회 장치를 집행합니다.
 */
export class MakerStore {
  /**
   * @param {Object} initialSchema - shared/demo-schema.json 등의 초기 기본 스펙 데이터
   */
  constructor(initialSchema) {
    this.schema = JSON.parse(JSON.stringify(initialSchema));
    this.selectedBoneId = null;
    this.selectedSlotId = null;
    this.currentTimeMs = 0;
    this.isPlaying = false;

    // Undo/Redo LIFO 히스토리 스택 (최대 50개 제한)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;

    // 옵저버 구독자 관리 맵
    this.listeners = new Map();

    // LocalStorage 저장을 위한 고유 키 및 가상 임시 세션 폴백 (Q1 옵션 A 적용)
    this.storageKey = '2d_maker_workspace_save';
    this.memoryFallbackStore = null;
    this.storageDiagnostics = { limitExceeded: false, usageBytes: 0, quotaBytes: 0, remainingBytes: null };
    this.isStorageAvailable = this.checkStorageAvailability();

    this.initStorage();
  }

  /**
   * 브라우저 저장 가용성(시크릿 모드, 차단 상태 등)을 1차 사전 체크합니다.
   */
  checkStorageAvailability() {
    try {
      if (!window.localStorage) return false;
      const x = '__storage_test_maker__';
      localStorage.setItem(x, x);
      localStorage.removeItem(x);
      return true;
    } catch (e) {
      console.warn('[MakerStore] 로컬 저장소를 사용할 수 없습니다. 수동 백업이 필수로 권장됩니다.');
      return false;
    }
  }

  /**
   * 현대식 브라우저의 StorageManager API를 활용하여 저장 공간(Quota)을 정밀 진단하는 비동기 메서드입니다.
   */
  async estimateStorageSpace() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        this.storageDiagnostics.usageBytes = estimate.usage || 0;
        this.storageDiagnostics.quotaBytes = estimate.quota || 0;
        
        const remaining = this.storageDiagnostics.quotaBytes - this.storageDiagnostics.usageBytes;
        this.storageDiagnostics.remainingBytes = remaining;

        // 남은 용량이 1MB (1,048,576 bytes) 이하이거나 이미 꽉 차기 직전인 경우
        if (remaining < 1024 * 1024) {
          this.storageDiagnostics.limitExceeded = true;
          this.notify('storageStatus', {
            isAvailable: this.isStorageAvailable,
            diagnostics: this.storageDiagnostics,
            warning: '저장 가능 공간이 1MB 미만으로 매우 협소합니다. 곧 브라우저 자동 저장이 실패할 수 있습니다.'
          });
        } else {
          this.notify('storageStatus', {
            isAvailable: this.isStorageAvailable,
            diagnostics: this.storageDiagnostics,
            warning: null
          });
        }
      } catch (err) {
        console.warn('[MakerStore] Storage Estimate 실패:', err);
      }
    } else {
      // API 미지원 시 기본 감지 상태 전파
      this.notify('storageStatus', {
        isAvailable: this.isStorageAvailable,
        diagnostics: this.storageDiagnostics,
        warning: this.isStorageAvailable ? null : '브라우저 쿠키/저장소 차단 또는 시크릿 모드가 감지되었습니다.'
      });
    }
  }

  /**
   * 영속 저장소 준비 및 자동 복원 시도
   */
  initStorage() {
    if (!this.isStorageAvailable) {
      this.memoryFallbackStore = JSON.stringify(this.schema);
      return;
    }

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.schema = JSON.parse(saved);
        console.log('[MakerStore] LocalStorage로부터 기존 세션 작업본을 자동 복원했습니다.');
      }
    } catch (e) {
      this.isStorageAvailable = false;
      this.memoryFallbackStore = JSON.stringify(this.schema);
      console.warn('[MakerStore] LocalStorage 복원 또는 접근 에러. 가상 메모리 백업 버퍼로 우회합니다.');
    }
  }

  /**
   * 전역 상태 변경 이벤트 구독 기능 (Observer 패턴)
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.unsubscribe(event, callback);
  }

  /**
   * 전역 상태 변경 이벤트 구독 해제
   */
  unsubscribe(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    const idx = list.indexOf(callback);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
  }

  /**
   * 전역 변경 사항 통지 전파
   */
  notify(event, data) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    for (let i = 0; i < list.length; i++) {
      list[i](data);
    }
  }

  /**
   * 상태의 스냅샷을 캡처하여 Undo 스택에 저장 (데이터 수정 직전 실행)
   */
  saveHistoryState() {
    this.undoStack.push(JSON.stringify(this.schema));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift(); // LIFO 50개 제한 초과분 제거
    }
    this.redoStack = []; // 새로운 동작이 일어나면 Redo 스택 클리어
    this.notify('historyChange', { canUndo: true, canRedo: false });
  }

  /**
   * 변경 사항을 브라우저 스토리지 및 세션에 영속화
   */
  persist() {
    const rawString = JSON.stringify(this.schema);
    let writeSuccess = true;
    
    if (this.isStorageAvailable) {
      try {
        localStorage.setItem(this.storageKey, rawString);
      } catch (e) {
        writeSuccess = false;
        this.isStorageAvailable = false; // 이후 자동 저장 차단 및 수동 우회 강제
        this.memoryFallbackStore = rawString;
        this.storageDiagnostics.limitExceeded = true;
        
        console.error('[MakerStore] LocalStorage 쓰기 한도 초과 또는 접근 실패! 메모리 백업으로 긴급 우회합니다.', e);
        this.notify('storageStatus', {
          isAvailable: false,
          diagnostics: this.storageDiagnostics,
          warning: '물리 디스크 쓰기에 실패했습니다 (저장 용량 초과 또는 시크릿 모드 차단). 수동 백업을 권장합니다.'
        });
      }
    } else {
      this.memoryFallbackStore = rawString;
    }
    
    this.notify('schemaUpdate', this.schema);
  }

  /**
   * 실행 취소 (Undo) - LIFO 복원
   */
  undo() {
    if (this.undoStack.length === 0) return;

    this.redoStack.push(JSON.stringify(this.schema));
    const previous = this.undoStack.pop();
    this.schema = JSON.parse(previous);

    this.persist();
    this.notify('historyChange', { 
      canUndo: this.undoStack.length > 0, 
      canRedo: this.redoStack.length > 0 
    });
  }

  /**
   * 다시 실행 (Redo) - LIFO 복원
   */
  redo() {
    if (this.redoStack.length === 0) return;

    this.undoStack.push(JSON.stringify(this.schema));
    const next = this.redoStack.pop();
    this.schema = JSON.parse(next);

    this.persist();
    this.notify('historyChange', { 
      canUndo: this.undoStack.length > 0, 
      canRedo: this.redoStack.length > 0 
    });
  }

  /**
   * 특정 본/슬롯 선택 상태 업데이트
   */
  selectElement(boneId, slotId = null) {
    this.selectedBoneId = boneId;
    this.selectedSlotId = slotId;
    this.notify('selectionChange', { boneId, slotId });
  }

  /**
   * 타임라인 재생 시각(ms) 동적 동기화
   */
  setCurrentTime(timeMs) {
    this.currentTimeMs = timeMs;
    this.notify('timeChange', timeMs);
  }

  /**
   * 재생/일시정지 상태 토글
   */
  setPlaying(playing) {
    this.isPlaying = playing;
    this.notify('playStateChange', playing);
  }

  /**
   * 특정 본의 SRT(Translate, Rotate, Scale) 속성을 정밀 수동 수정
   */
  updateBoneTransform(boneId, transformKey, value) {
    const bone = this.schema.skeleton.bones.find(b => b.id === boneId);
    if (!bone) return;

    this.saveHistoryState();
    
    // 키값 1차 매핑 및 보정
    if (transformKey === 'tx') bone.tx = value;
    else if (transformKey === 'ty') bone.ty = value;
    else if (transformKey === 'rotation') bone.rotation = value;
    else if (transformKey === 'scaleX') bone.scaleX = value;
    else if (transformKey === 'scaleY') bone.scaleY = value;

    this.persist();
  }

  /**
   * 세션 초기화 및 워크스페이스 완전 포맷
   */
  clearSession() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      this.memoryFallbackStore = null;
    }
    this.undoStack = [];
    this.redoStack = [];
    this.selectedBoneId = null;
    this.selectedSlotId = null;
  }

  /**
   * 현재 워크스페이스 스키마 데이터를 JSON 객체 형식으로 딥카피하여 반환 (수동 파일 백업용)
   */
  exportSchema() {
    return JSON.parse(JSON.stringify(this.schema));
  }

  /**
   * 외부 JSON 파일을 가져와 현재 워크스페이스 상태를 덮어쓰고 실시간 반영
   */
  importSchema(newSchema) {
    if (!newSchema || !newSchema.skeleton || !newSchema.skeleton.bones) {
      throw new Error('유효하지 않은 Animate2D 스키마 파일입니다.');
    }
    this.saveHistoryState();
    this.schema = JSON.parse(JSON.stringify(newSchema));
    this.persist();
  }
}
