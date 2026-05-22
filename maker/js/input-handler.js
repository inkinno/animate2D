/**
 * Maker Input & Shortcut Handler (조작 및 단축키 제어 모듈)
 * 
 * SOLID 단일 책임 원칙(SRP)에 따라 마우스 드래그 변형(Transform Gizmo)을 차단하고
 * 수치 조작 패널 포커스 전이(Tab: Tx -> Ty -> Rotation -> ScaleX -> ScaleY) 및 
 * 실행 취소(Ctrl+Z)/다시실행(Ctrl+Y) 등 전역 단축키 바인딩을 전담합니다.
 */
export class MakerInputHandler {
  /**
   * @param {MakerStore} store - 메이커 상태 관리소
   * @param {HTMLElement} canvasElement - 캔버스 엘리먼트
   */
  constructor(store, canvasElement) {
    this.store = store;
    this.canvas = canvasElement;

    // 수치 폼 DOM 아이디 정의 매핑 목록 (Tab 순서 보장)
    this.transformFields = ['input-tx', 'input-ty', 'input-rotation', 'input-scaleX', 'input-scaleY'];

    this.initEvents();
  }

  /**
   * 이벤트 바인딩 등록
   */
  initEvents() {
    // 1. 키보드 단축키 및 Tab 포커싱 오버라이드
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // 2. 캔버스 마우스 드래그 차단 및 단순 '클릭' 감지
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // 3. 스토어 선택 변경 시 포커스 전이 구독
    this.store.subscribe('selectionChange', (selection) => this.onSelectionChange(selection));
  }

  /**
   * 본 또는 슬롯을 클릭하여 선택했을 때, 우측 패널의 Rotation 입력 필드로 즉시 자동 포커싱
   */
  onSelectionChange(selection) {
    if (selection.boneId) {
      setTimeout(() => {
        const rotInput = document.getElementById('input-rotation');
        if (rotInput) {
          rotInput.focus();
          rotInput.select(); // 기존 수치 블록 지정으로 빠른 덮어쓰기 편의 제공
        }
      }, 50);
    }
  }

  /**
   * Tab 키 순차 전이 및 전역 단축키 단방향 트리거
   */
  handleKeyDown(e) {
    const activeEl = document.activeElement;
    const isInputActive = activeEl && activeEl.tagName === 'INPUT';

    // A. Tab 키 정밀 커서 전이 (Tx -> Ty -> Rotation -> ScaleX -> ScaleY)
    if (e.key === 'Tab') {
      if (isInputActive && this.transformFields.includes(activeEl.id)) {
        e.preventDefault(); // 브라우저 고유 탭 포커스 체인 강제 중단
        
        const curIdx = this.transformFields.indexOf(activeEl.id);
        const nextIdx = (curIdx + 1) % this.transformFields.length;
        const nextInput = document.getElementById(this.transformFields[nextIdx]);

        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
        return;
      }
    }

    // B. 전역 제어 단축키 (Ctrl 조합)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      
      if (key === 'z') {
        e.preventDefault();
        this.store.undo();
      } else if (key === 'y') {
        e.preventDefault();
        this.store.redo();
      } else if (key === 'c') {
        // 복사 이벤트 바인딩 트리거
        e.preventDefault();
        this.store.notify('clipboardCopy', this.store.selectedBoneId);
      } else if (key === 'v') {
        // 붙여넣기 이벤트 바인딩 트리거
        e.preventDefault();
        this.store.notify('clipboardPaste', this.store.selectedBoneId);
      }
    }

    // C. 스페이스바 (타임라인 재생 / 정지)
    if (e.key === ' ' && !isInputActive) {
      e.preventDefault();
      this.store.setPlaying(!this.store.isPlaying);
    }
  }

  /**
   * 뷰포트 마우스 프레스 감지 (단순 클릭 판별용)
   */
  handleMouseDown(e) {
    this.isDragging = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  }

  /**
   * 마우스 드래그 동작이 관찰되더라도 기즈모 변형 잠금을 위반하지 못하도록 드래그 동작 무시
   */
  handleMouseMove(e) {
    if (Math.abs(e.clientX - this.dragStartX) > 5 || Math.abs(e.clientY - this.dragStartY) > 5) {
      this.isDragging = true; // 드래그 상태로 판별되어 클릭 취소
    }
  }

  /**
   * 마우스를 뗄 때 단순 클릭이었는지 검증 후, 해당 본 영역이 감지되면 즉시 뼈대 선택
   */
  handleMouseUp(e) {
    if (!this.isDragging) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // app.js의 충돌 알고리즘을 타기 위해 이벤트 전파
      this.store.notify('viewportClick', { x, y });
    }
    this.isDragging = false;
  }
}
