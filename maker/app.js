import { CoreEngine } from '../core-engine/index.js';
import { MakerStore } from './js/store.js';
import { MakerInputHandler } from './js/input-handler.js';
import { MakerLayerGuard } from './js/layer-guard.js';
import { MakerWorkflow } from './js/workflow.js';
import { ResponsiveViewport } from '../player/js/viewport.js';
import { AssetDownloader } from '../player/js/downloader.js';

/**
 * Maker Suite Application Main Orchestrator
 * 
 * 4분할 저작 화면(Tree, Viewport, Properties, Timeline)의 모든 UI 요소와 
 * 코어 역학 엔진, Undo/Redo LIFO, Onion Skin, Easing 미분 프리뷰를 
 * 유기적으로 오케스트레이션하여 무결점 저작 경험을 완성합니다.
 */
export class MakerApp {
  /**
   * @param {string} schemaPath - 기본 데모 스펙 JSON 경로
   */
  constructor(schemaPath) {
    this.schemaPath = schemaPath;
    this.store = null;
    this.engine = null;
    
    this.canvas = null;
    this.ctx = null;
    this.viewport = null;
    this.downloader = new AssetDownloader();

    // 메이커 4대 서브 모듈 인스턴스화
    this.guard = new MakerLayerGuard();
    this.workflow = new MakerWorkflow();
    this.inputHandler = null;

    this.currentAnimId = 'punch_sequence';
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.isDestroyed = false;

    // 가용 뷰포트 영역 계산 시 차감할 CSS 셀렉터 목록
    this.excludeSelectors = ['.maker-header', '.timeline-controls', '.quadrant-bottom'];
  }

  /**
   * 메이커 앱 로딩 및 전체 초기화 시동
   */
  async start() {
    // 1. JSON 스키마 로드
    const response = await fetch(this.schemaPath);
    const initialSchema = await response.json();

    // 2. 스토어 및 엔진 마운트
    this.store = new MakerStore(initialSchema);
    this.engine = new CoreEngine(this.store.schema);
    
    // 작업 변경 감지 플래그 (수동 백업 유도용 2중 안전 장치)
    this.isDirty = false;

    // [Q1 대응] 로컬 디바이스 자동 저장 가용성 1차 체크 및 비동기 용량 진단 실행
    if (!this.store.isStorageAvailable) {
      const alertBar = document.getElementById('storage-alert-bar');
      if (alertBar) {
        alertBar.style.display = 'flex';
        this.excludeSelectors.push('#storage-alert-bar');
      }
    }
    
    // 백그라운드 스토리지 여유공간 정밀 진단 시동
    this.store.estimateStorageSpace();

    // 3. 중앙 캔버스 동적 빌드
    const container = document.getElementById('canvas-wrapper-container');
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // 4. 에셋 확보 (가상 에셋 결합 폴백 작동)
    const initialAssetIds = this.store.schema.skeleton.slots.map(s => s.defaultAsset).filter(Boolean);
    await this.downloader.loadAssets(this.store.schema.library.sprites, initialAssetIds);

    // 5. 인풋 핸들러 결합
    this.inputHandler = new MakerInputHandler(this.store, this.canvas);

    // 6. 리사이즈 이벤트 바인딩
    this.resizeViewport();
    window.addEventListener('resize', () => this.resizeViewport());

    // 새로고침 및 이탈 방지 안전장치 (수동 백업 미수행 경고)
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        const msg = '저장되지 않은 작업 내역이 존재합니다. [📥 Export JSON]을 통해 로컬 컴퓨터에 백업 파일을 다운로드받지 않으면 새로고침 시 변경 내역이 모두 유실될 수 있습니다.';
        e.returnValue = msg;
        return msg;
      }
    });

    // 7. UI 바인딩 및 전역 옵저버 구독
    this.bindDOMEvents();
    this.subscribeStoreEvents();

    // 8. 뼈대 트리 및 타임라인 트랙 동적 드로잉 개시
    this.renderBoneTree();
    this.renderTimelineTracks();
    this.updateEasingPreview();

    // 9. 실시간 렌더링 루프 가동
    this.lastFrameTime = performance.now();
    this.loop();

    console.log('[MakerApp] 4분할 프리미엄 워크스페이스가 성공적으로 초기화 가동되었습니다.');
  }

  /**
   * 화면 크기 변동 시 뷰포트 피팅
   */
  resizeViewport() {
    if (this.isDestroyed || !this.canvas) return;
    this.viewport = ResponsiveViewport.resize(this.canvas, 1.2, 1.0, this.excludeSelectors);
  }

  /**
   * DOM 버튼 및 인풋 변경 이벤트 총괄 매핑
   */
  bindDOMEvents() {
    const s = this.store;

    // A. Undo / Redo 헤더 버튼
    document.getElementById('btn-undo').addEventListener('click', () => s.undo());
    document.getElementById('btn-redo').addEventListener('click', () => s.redo());

    // [Q1 대응] B-1. JSON 백업 파일 다운로드 (Export)
    const triggerBackup = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(s.exportSchema(), null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "2d_animation_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.isDirty = false; // 수동 파일 백업 완료 시 유실 경고 면제
      console.log('[MakerApp] 현재 저작본 스키마가 JSON 파일로 성공적으로 내보내기(수동 백업) 되었습니다.');
    };

    document.getElementById('btn-export-json').addEventListener('click', triggerBackup);
    
    const alertBackupBtn = document.getElementById('btn-alert-backup');
    if (alertBackupBtn) {
      alertBackupBtn.addEventListener('click', triggerBackup);
    }

    // [Q1 대응] B-2. 수동 백업 JSON 파일 불러오기 (Import)
    const fileInput = document.getElementById('input-import-file');
    document.getElementById('btn-import-json').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          s.importSchema(parsed);
          
          this.isDirty = false; // 새로운 백업을 막 불러온 상태이므로 초기엔 미변경 처리
          
          // 실시간으로 렌더러와 엔진 전체 갱신 호출
          this.engine = new CoreEngine(s.schema);
          this.renderBoneTree();
          this.renderTimelineTracks();
          this.updateEasingPreview();
          if (s.selectedBoneId) {
            this.updatePropertyPanel(s.selectedBoneId);
          }
          
          alert('성공적으로 백업 파일을 불러와 작업을 복원했습니다!');
        } catch (err) {
          alert('JSON 파일 복원 실패: ' + err.message);
        }
      };
      reader.readAsText(file);
      // 같은 파일을 다시 올릴 때도 작동되게 초기화
      fileInput.value = '';
    });

    // B. 세션 포맷 (Format Session)
    document.getElementById('btn-clear-store').addEventListener('click', () => {
      if (confirm('저장된 작업 세션을 영구 삭제하고 기본 데모 상태로 초기화하시겠습니까?')) {
        s.clearSession();
        window.location.reload();
      }
    });

    // C. 타임라인 재생 / 토글
    const btnPlay = document.getElementById('btn-play-toggle');
    btnPlay.addEventListener('click', () => s.setPlaying(!s.isPlaying));

    const scrubber = document.getElementById('timeline-scrubber');
    scrubber.addEventListener('input', (e) => {
      s.setCurrentTime(parseInt(e.target.value, 10));
    });

    // D. 우측 패널 수치 수정 폼 이벤트
    const props = ['tx', 'ty', 'rotation', 'scaleX', 'scaleY'];
    props.forEach(prop => {
      const input = document.getElementById(`input-${prop}`);
      input.addEventListener('input', (e) => {
        if (!s.selectedBoneId || this.guard.isLocked(s.selectedBoneId, prop)) return;
        s.updateBoneTransform(s.selectedBoneId, prop, parseFloat(e.target.value) || 0);
      });

      // 개별 속성 락(Lock) 토글 버튼 바인딩
      const lockBtn = document.getElementById(`lock-${prop}`);
      lockBtn.addEventListener('click', () => {
        if (!s.selectedBoneId) return;
        const isLocked = this.guard.toggleLock(s.selectedBoneId, prop);
        lockBtn.classList.toggle('locked', isLocked);
        input.disabled = isLocked;
      });
    });

    // E. Cubic-Bezier 이징 값 변경 폼 이벤트
    ['x1', 'y1', 'x2', 'y2'].forEach(coord => {
      document.getElementById(`easing-${coord}`).addEventListener('input', () => {
        this.updateEasingPreview();
      });
    });
  }

  /**
   * 전역 스토어 상태 변경 시의 UI 고속 갱신 바인딩 (Observer)
   */
  subscribeStoreEvents() {
    const s = this.store;

    // 1. LIFO 히스토리 변동 시 헤더 Undo/Redo 활성 갱신 및 dirty 플래그 설정
    s.subscribe('historyChange', (status) => {
      document.getElementById('btn-undo').disabled = !status.canUndo;
      document.getElementById('btn-redo').disabled = !status.canRedo;
      if (status.canUndo) {
        this.isDirty = true; // 변경 감지 활성화
      }
    });

    // 스토리지 정밀 진단 및 경고 실시간 갱신 이벤트 리스너 추가 (Q1 대응)
    s.subscribe('storageStatus', (status) => {
      const alertBar = document.getElementById('storage-alert-bar');
      const diagnosticText = document.getElementById('storage-diagnostic-info');
      if (alertBar && diagnosticText) {
        if (!status.isAvailable || status.diagnostics.limitExceeded) {
          alertBar.style.display = 'flex';
          if (!this.excludeSelectors.includes('#storage-alert-bar')) {
            this.excludeSelectors.push('#storage-alert-bar');
            this.resizeViewport();
          }
          
          if (!status.isAvailable) {
            diagnosticText.textContent = status.warning || '시크릿 모드 또는 브라우저 로컬 저장소가 차단되어 작업이 디스크에 물리적으로 저장되지 않습니다.';
          } else if (status.diagnostics.remainingBytes !== null) {
            const remainingMb = (status.diagnostics.remainingBytes / (1024 * 1024)).toFixed(2);
            diagnosticText.textContent = `남은 브라우저 저장 한계 용량이 약 ${remainingMb}MB 입니다. 곧 자동 저장이 비활성화될 수 있습니다.`;
          }
        } else {
          alertBar.style.display = 'none';
        }
      }
    });

    // 2. 뼈대 선택 변경 시 우측 조작 필드 바인딩 및 락 상태 체크 & [Q2 대응] 상속 체인 브레드크럼 갱신
    s.subscribe('selectionChange', (selection) => {
      this.updatePropertyPanel(selection.boneId);
      this.renderBoneTree(); // 트리 활성 하이라이트 리렌더링

      // 오리진 피봇 상속 체인 연산 및 브레드크럼 렌더러
      const breadcrumb = document.getElementById('breadcrumb-container');
      const infoPanel = document.querySelector('.origin-info-panel p');
      
      if (selection.boneId) {
        // 상속 체인 역추적
        const chain = [];
        let curr = s.schema.skeleton.bones.find(b => b.id === selection.boneId);
        while (curr) {
          chain.unshift(curr);
          curr = curr.parent ? s.schema.skeleton.bones.find(b => b.id === curr.parent) : null;
        }

        if (breadcrumb) {
          breadcrumb.style.display = 'block';
          breadcrumb.innerHTML = chain.map((b, idx) => {
            const isLast = idx === chain.length - 1;
            const isRoot = idx === 0;
            const prefix = isRoot ? '👑 ' : '└─► ';
            const bold = isLast ? 'font-weight: bold; color: #818cf8; text-shadow: 0 0 8px rgba(129, 140, 248, 0.4);' : '';
            return `<span style="${bold}" title="${isRoot ? '최상위 핵심 오리진 (Basic Center)' : '상위 부모 본'}">${prefix}${b.id}</span>`;
          }).join(' ');
        }

        if (infoPanel) {
          const rootId = chain[0].id;
          infoPanel.innerHTML = `
            선택된 <strong>[${selection.boneId}]</strong> 관절은 오리진 피봇 트리를 타고 올라가면 결국 최상위 중심인 <strong>👑 ${rootId} (ROOT ORIGIN)</strong>에 최종 종속되어 있습니다.<br>
            <span style="color:#a5b4fc; font-weight:600; text-shadow: 0 0 4px rgba(165,180,252,0.3);">👑 ${rootId}</span>의 위치나 회전을 조작하면 하위 상속 링크인 <strong>${chain.slice(1).map(b => b.id).join(' -> ') || selection.boneId}</strong> 에도 역학 엔진에 의해 3x3 순방향 아핀 변환(FK)이 실시간 연동되어 상속 상향 조정됩니다.
          `;
        }
      } else {
        if (breadcrumb) breadcrumb.style.display = 'none';
        if (infoPanel) {
          infoPanel.innerHTML = `
            모든 하위 파츠 관절은 부모 관절의 오리진 피봇(Origin Pivot)에 종속됩니다. <br>
            계층 구조의 최상위에 위치한 <strong>👑 ROOT ORIGIN (가장 핵심인 파츠 오리진)</strong>은 전체 오브젝트의 글로벌 좌표 및 움직임을 제어하는 <strong>기본 중심축</strong> 역할을 담당합니다.
          `;
        }
      }
    });

    // 3. 타임라인 시간 갱신 시 Scrubber 및 타이머 수치 동기화
    s.subscribe('timeChange', (timeMs) => {
      document.getElementById('timeline-scrubber').value = timeMs;
      document.getElementById('time-indicator').textContent = `${timeMs} / 2000 ms`;
    });

    // 4. 재생 상태 토글 시 재생 텍스트 갱신
    s.subscribe('playStateChange', (playing) => {
      document.getElementById('btn-play-toggle').textContent = playing ? '⏸ 정지' : '▶ 재생';
    });

    // 5. 스키마 업데이트 시 역학 엔진 데이터 동시 동기화
    s.subscribe('schemaUpdate', (newSchema) => {
      // 레이어 가드 자동 가동 (극단적 스케일 축소 시 Z-Index 1계단 우선 승격)
      this.guard.executeZIndexGuard(newSchema);
      
      this.engine = new CoreEngine(newSchema);
      this.renderBoneTree();
    });

    // 6. 뷰포트 클릭 본 선택 판독 (Raycasting 충돌 분석)
    s.subscribe('viewportClick', (coords) => {
      this.handleViewportSelection(coords.x, coords.y);
    });

    // 7. SRT 클립보드 복사/붙여넣기 핫이벤트 바인딩 (input-handler 연계)
    s.subscribe('clipboardCopy', (boneId) => {
      const bone = s.schema.skeleton.bones.find(b => b.id === boneId);
      this.workflow.copySRT(bone);
    });

    s.subscribe('clipboardPaste', (boneId) => {
      const bone = s.schema.skeleton.bones.find(b => b.id === boneId);
      s.saveHistoryState();
      if (this.workflow.pasteSRT(bone)) {
        s.persist();
      }
    });
  }

  /**
   * 우측 패널 수치 수정 폼에 선택된 본의 데이터를 얹어 활성화
   */
  updatePropertyPanel(boneId) {
    const badge = document.getElementById('selected-bone-badge');
    const props = ['tx', 'ty', 'rotation', 'scaleX', 'scaleY'];

    if (!boneId) {
      badge.textContent = 'Select Bone';
      props.forEach(p => {
        document.getElementById(`input-${p}`).disabled = true;
        document.getElementById(`input-${p}`).value = '';
      });
      return;
    }

    const bone = this.store.schema.skeleton.bones.find(b => b.id === boneId);
    badge.textContent = bone.id;

    props.forEach(p => {
      const input = document.getElementById(`input-${p}`);
      const isLocked = this.guard.isLocked(boneId, p);
      
      input.disabled = isLocked;
      input.value = bone[p] !== undefined ? bone[p] : (p.includes('scale') ? 1.0 : 0);

      const lockBtn = document.getElementById(`lock-${p}`);
      lockBtn.classList.toggle('locked', isLocked);
    });
  }

  /**
   * Cubic-Bezier 곡선 및 1차 미분 가속도 썸네일 실시간 갱신
   */
  updateEasingPreview() {
    const x1 = parseFloat(document.getElementById('easing-x1').value) || 0.25;
    const y1 = parseFloat(document.getElementById('easing-y1').value) || 0.25;
    const x2 = parseFloat(document.getElementById('easing-x2').value) || 0.75;
    const y2 = parseFloat(document.getElementById('easing-y2').value) || 0.75;

    const miniCanvas = document.getElementById('easing-canvas-preview');
    this.workflow.drawEasingThumbnail(miniCanvas, x1, y1, x2, y2);
  }

  /**
   * [1 영역] 좌측 뼈대 탐색기 트리 구조 동적 DOM 빌딩
   */
  renderBoneTree() {
    const container = document.getElementById('bone-tree-list');
    container.innerHTML = '';

    const bones = this.store.schema.skeleton.bones;
    
    // 부모가 없는 루트 뼈대 우선 추출
    const rootBones = bones.filter(b => !b.parent);

    const buildTreeDOM = (bone, depth) => {
      const li = document.createElement('li');
      li.className = `tree-item ${this.store.selectedBoneId === bone.id ? 'active' : ''}`;
      
      if (depth > 0) {
        li.classList.add('tree-indent');
        // 자식 본 계통 상속을 나타내는 접두어 표시
        li.innerHTML = `
          <span><span class="tree-child-prefix">└─►</span> 🦴 ${bone.id}</span>
          <span style="font-size: 10px; color: var(--text-dim);">child (종속)</span>
        `;
      } else {
        // 최상위 핵심 파츠 오리진 (ROOT ORIGIN) 하이라이트
        li.classList.add('tree-item-root');
        li.innerHTML = `
          <span>👑 <strong>ROOT ORIGIN</strong> [${bone.id}]</span>
          <span style="font-size: 9px; color: #d8b4fe; font-weight: bold; text-transform: uppercase;">Basic Center (중심축)</span>
        `;
      }

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.selectElement(bone.id);
      });

      container.appendChild(li);

      // 해당 본을 부모로 두고 있는 자식 본들을 재귀식 탐색
      const children = bones.filter(b => b.parent === bone.id);
      children.forEach(child => buildTreeDOM(child, depth + 1));
    };

    rootBones.forEach(root => buildTreeDOM(root, 0));
  }

  /**
   * [4 영역] 하단 시퀀서 개별 관절 트랙 동적 생성
   */
  renderTimelineTracks() {
    const container = document.getElementById('timeline-tracks-container');
    container.innerHTML = '';

    const bones = this.store.schema.skeleton.bones;

    bones.forEach(bone => {
      const row = document.createElement('div');
      row.className = 'track-row';

      row.innerHTML = `
        <span class="track-label">
          <span>🦴 ${bone.id}</span>
          ${bone.parent ? `<span class="track-parent-id">${bone.parent}</span>` : ''}
        </span>
        <div class="track-ticks">
          <!-- MVP 간이 키프레임 인디케이터 (0ms, 1000ms, 2000ms 지점 다이아몬드) -->
          <div class="keyframe-dot" style="left: 0%;" title="Start Point (0ms)"></div>
          <div class="keyframe-dot" style="left: 50%;" title="Mid Transition (1000ms)"></div>
          <div class="keyframe-dot" style="left: 100%;" title="End Sequence (2000ms)"></div>
        </div>
      `;

      row.addEventListener('click', () => {
        this.store.selectElement(bone.id);
      });

      container.appendChild(row);
    });
  }

  /**
   * 뷰포트 내 마우스 클릭 충돌 판정 (Raycasting)
   * 관절 피봇 위치 반경 25px 내 클릭 포착 시 해당 본을 포커스 선택합니다.
   */
  handleViewportSelection(clickX, clickY) {
    if (!this.viewport || !this.engine) return;

    const dpr = this.viewport.dpr;
    const halfW = (this.canvas.width / dpr) / 2;
    const halfH = (this.canvas.height / dpr) / 2;

    const bones = this.store.schema.skeleton.bones;
    let selectedId = null;
    let minDistance = 25; // 25px 유효 충돌 오차 범위

    bones.forEach(bone => {
      const slotMat = this.engine.slotMatrices[bone.id] || this.engine.boneMatrices[bone.id];
      if (!slotMat) return;

      // 월드 변환 행렬에서 최종 평행이동 좌표 도출
      // m02(slotMat[6]), m12(slotMat[7])
      const worldX = slotMat[6] + halfW;
      const worldY = slotMat[7] + halfH;

      // 클릭 지점과의 유클리드 거리 환산
      const dist = Math.hypot(clickX - worldX, clickY - worldY);

      if (dist < minDistance) {
        minDistance = dist;
        selectedId = bone.id;
      }
    });

    this.store.selectElement(selectedId);
  }

  /**
   * 매 프레임 저작도구 화면을 렌더링하는 requestAnimationFrame 루프
   */
  loop() {
    if (this.isDestroyed) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 1. 자동 재생 모드 시 틱 갱신
    if (this.store.isPlaying) {
      let nextTime = this.store.currentTimeMs + deltaTime;
      if (nextTime > 2000) nextTime = 0; // 루프 재생
      this.store.setCurrentTime(nextTime);
    }

    // 2. 엔진 프레임 연산 집행
    this.engine.update(this.currentAnimId, this.store.currentTimeMs);

    // 3. 뷰포트 캔버스 드로잉
    this.renderViewport();

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * 중앙 뷰포트 실시간 렌더링 및 뼈선/선택 아웃라인 시각화
   */
  renderViewport() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const dpr = this.viewport ? this.viewport.dpr : 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const halfW = (canvas.width / dpr) / 2;
    const halfH = (canvas.height / dpr) / 2;

    // A. [부가 비주얼 워크플로우] Onion Skin 잔상 레이어 선행 드로잉
    const chkOnion = document.getElementById('chk-onion-skin');
    if (chkOnion && chkOnion.checked) {
      this.workflow.renderOnionSkin(
        ctx, this.engine, this.currentAnimId, 
        this.store.currentTimeMs, this.downloader.loadedAssets, this.viewport
      );
    }

    // B. 슬롯 스프라이트 조각 드로잉 (Z-Index 레이어 배치 정렬 준수)
    const slots = this.engine.data.skeleton.slots;
    const sortedSlots = [...slots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const slotMat = this.engine.slotMatrices[slot.id];
      const assetId = slot.defaultAsset;
      const img = this.downloader.loadedAssets[assetId];

      if (!slotMat || !img) continue;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(halfW, halfH);

      // 월드 변환 주입
      ctx.transform(
        slotMat[0], slotMat[1],
        slotMat[3], slotMat[4],
        slotMat[6], slotMat[7]
      );

      // 선택된 본에 장착된 파츠 조각일 경우 테두리에 네온 소프트 글로우 하이라이트 처리
      if (this.store.selectedBoneId === slot.bone) {
        ctx.shadowColor = '#06b6d4'; // Neon Cyan Glow
        ctx.shadowBlur = 15;
      }

      ctx.drawImage(img, 0, 0, img.width, img.height);
      ctx.restore();
    }

    // C. 뼈대 관절 골격(Skeleton Bones) 연결선 및 피봇점 시각화 드로잉
    const bones = this.store.schema.skeleton.bones;
    
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(halfW, halfH);

    bones.forEach(bone => {
      const boneMat = this.engine.boneMatrices[bone.id] || this.engine.slotMatrices[bone.id];
      if (!boneMat) return;

      const bx = boneMat[6];
      const by = boneMat[7];

      // 부모 본이 있다면, 부모 관절 피봇점부터 자식 피봇점까지 뼈선 연결 드로잉
      if (bone.parent) {
        const parentMat = this.engine.boneMatrices[bone.parent] || this.engine.slotMatrices[bone.parent];
        if (parentMat) {
          const px = parentMat[6];
          const py = parentMat[7];

          ctx.strokeStyle = this.store.selectedBoneId === bone.id ? '#f43f5e' : 'rgba(99, 102, 241, 0.4)';
          ctx.lineWidth = this.store.selectedBoneId === bone.id ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      // 관절 피봇 원형 노드 그리기
      ctx.fillStyle = this.store.selectedBoneId === bone.id ? '#f43f5e' : '#06b6d4';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();

      // 관절 노드 라벨 텍스트 표기
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '9px JetBrains Mono, sans-serif';
      ctx.fillText(bone.id, bx + 8, by + 3);
    });

    ctx.restore();

    // D. [Q2 대응] 선택된 본의 상위 오리진 피봇 상속 체인 연결선 네온 핑크 점선 하이라이트
    if (this.store.selectedBoneId) {
      let currId = this.store.selectedBoneId;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(halfW, halfH);
      
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3.0;
      ctx.setLineDash([4, 4]); // 세련된 점선
      
      while (currId) {
        const bone = bones.find(b => b.id === currId);
        if (!bone || !bone.parent) break;
        
        const boneMat = this.engine.boneMatrices[bone.id] || this.engine.slotMatrices[bone.id];
        const parentMat = this.engine.boneMatrices[bone.parent] || this.engine.slotMatrices[bone.parent];
        
        if (boneMat && parentMat) {
          ctx.beginPath();
          ctx.moveTo(parentMat[6], parentMat[7]);
          ctx.lineTo(boneMat[6], boneMat[7]);
          ctx.stroke();
        }
        currId = bone.parent; // 상위 트리를 계속 타고 올라감
      }
      ctx.restore();
    }
  }

  /**
   * 메이커 소멸자 (Lifecycle Termination)
   */
  destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
