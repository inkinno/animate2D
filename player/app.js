import { CoreEngine } from '../core-engine/index.js';
import { ResponsiveViewport } from './js/viewport.js';
import { AssetDownloader } from './js/downloader.js';
import { TimelineController } from './js/controller.js';
import { StatePersistence } from './js/persistence.js';
import { IdleOptimizer } from './js/optimizer.js';
import { SchemaValidator } from '../shared/js/schema-validator.js';
import { Matrix3 } from '../core-engine/matrix.js';

/**
 * 2D Skeletal Animation Player Application Core
 * 
 * 모든 서브 모듈(Engine, Viewport, Downloader, Controller, Save, Idle)을 
 * 유기적으로 본딩 결합하고, Canvas 2D context 하드웨어 가속 아핀 변환을 활용하여
 * 프레임 렉(Jank)이 없는 프리미엄 재생 샌드박스를 제공합니다.
 */
export class AnimationPlayer {
  /**
   * @param {string} containerId - 플레이어가 주입되어 캔버스를 동적 생성할 DIV ID
   * @param {Object|string} schemaSource - JSON 데이터 객체 또는 JSON 파일 URL
   */
  constructor(containerId, schemaSource) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`[AnimationPlayer] 컨테이너 엘리먼트 "${containerId}"를 찾을 수 없습니다.`);
    }

    this.schemaSource = schemaSource;
    this.canvas = null;
    this.ctx = null;
    this.engine = null;
    this.viewport = null;
    
    // 서브 모듈 인스턴스화
    this.downloader = new AssetDownloader();
    this.controller = new TimelineController(2000);
    this.persistence = new StatePersistence(`2d_player_save_${containerId}`);
    this.optimizer = new IdleOptimizer();
    
    this.currentAnimId = '';
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.isDestroyed = false;

    // UI 요소 적층 구성을 위한 반응형 바인딩 리스트 설정
    this.excludeSelectors = ['.player-header', '.dialog-panel', '.ads-banner'];

    // 캔버스 초기 동적 빌드 실행
    this.initCanvas();
  }

  /**
   * 샌드박스 캔버스를 컨테이너 내부에 동적 생성하고 2D 하드웨어 가속 컨텍스트를 획득합니다.
   */
  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'animation-player-canvas';
    // 상단 정렬 및 중앙 배치를 위한 기본 스타일 주입
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * 플레이어 구동을 개시하는 메인 비동기 진입 함수
   */
  async start() {
    this.renderLoadingScreen(0, 100);

    // 1단계: 스키마 로드 및 유효성 검사
    let schemaData = null;
    try {
      if (typeof this.schemaSource === 'string') {
        const response = await fetch(this.schemaSource);
        schemaData = await response.json();
      } else {
        schemaData = this.schemaSource;
      }
    } catch (e) {
      this.renderErrorScreen('JSON 데이터 로드에 실패했습니다.');
      return;
    }

    if (!SchemaValidator.validate(schemaData)) {
      this.renderErrorScreen('유효하지 않은 마스터 JSON 스펙 데이터입니다.');
      return;
    }

    // 2단계: 코어 엔진 인스턴스화 및 룩업테이블 베이킹
    this.engine = new CoreEngine(schemaData);

    // 3단계: 로컬 세이브 데이터 유무 선행 검사 (LIFO 복구 방식)
    const saveSnapshot = this.persistence.loadSnapshot();
    let initialAnimId = 'punch_sequence'; // 기본 디폴트 애니메이션
    let startFrameMs = 0;

    if (saveSnapshot) {
      console.log('[AnimationPlayer] 복원 가능한 세이브 포인트 포착. 즉각 복구 정렬 개시.');
      if (saveSnapshot.sceneId) initialAnimId = saveSnapshot.sceneId;
      if (saveSnapshot.timeMs) startFrameMs = saveSnapshot.timeMs;
    }

    this.currentAnimId = initialAnimId;
    
    const animConfig = schemaData.animations[initialAnimId];
    if (animConfig) {
      this.controller.duration = animConfig.duration;
    }
    this.controller.setTime(startFrameMs);

    // 4단계: 에셋 다운로드 큐 구동 (진입 에셋 우선 로드 및 백그라운드 적재)
    this.downloader.onLoadingProgress = (loaded, total) => {
      this.renderLoadingScreen(loaded, total);
    };

    this.downloader.onSuspensionChange = (isSuspended) => {
      if (isSuspended) {
        console.warn('[AnimationPlayer] 에셋 미확보로 플레이어 일시 대기(Suspended) 상태 전환.');
      }
    };

    // 첫 애니메이션 구동에 연동된 슬롯 디폴트 에셋 목록 추출
    const initialAssetIds = [];
    const slots = schemaData.skeleton.slots;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].defaultAsset) {
        initialAssetIds.push(slots[i].defaultAsset);
      }
    }

    await this.downloader.loadAssets(schemaData.library.sprites, initialAssetIds);

    // 5단계: 반응형 뷰포트 장착 및 리사이즈 이벤트 바인딩
    this.resizeViewport();
    window.addEventListener('resize', () => this.resizeViewport());

    // 6단계: 타임라인 컨트롤러 및 영속 플러싱 이벤트 연동
    this.controller.onTimeUpdate = (timeMs) => {
      // 실시간 자동 세이브
      this.persistence.saveSnapshot(this.currentAnimId, timeMs);
    };

    this.controller.onPlaybackEnd = () => {
      // 재생 완료 시 Idle 대기 상태로 전이
      this.optimizer.setIdle(true);
    };

    // 7단계: 재생 개시 및 메인 연산 루프 진입
    this.controller.play();
    this.lastFrameTime = performance.now();
    this.loop();
  }

  /**
   * 가용 면적을 선행 환산하여 뷰포트 크기를 피팅합니다.
   */
  resizeViewport() {
    if (this.isDestroyed || !this.canvas) return;
    
    // 마스터 기획에 따른 1:1 또는 정사각 최적 가용 영역 추출
    this.viewport = ResponsiveViewport.resize(this.canvas, 1, 1, this.excludeSelectors);
  }

  /**
   * 매 프레임 구동되는 requestAnimationFrame 런타임 루프
   */
  loop() {
    if (this.isDestroyed) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 1. 에셋 로딩 중이거나 Suspended인 경우 연산 바이패스 및 로딩 씬 유지
    if (this.downloader.isSuspended) {
      this.renderLoadingScreen(50, 100); // 간이 미확보 대기 스크린
      this.animationFrameId = requestAnimationFrame(() => this.loop());
      return;
    }

    // 2. 컨트롤러 틱 갱신
    this.controller.tick(deltaTime);

    // 3. 대기 상태 오프셋 가중치 계산
    const idleOffsets = this.optimizer.calculateIdleOffsets(deltaTime);

    // 4. 엔진 프레임 아핀/FK 행렬 변환 집행
    this.engine.update(this.currentAnimId, this.controller.currentTime);

    // 5. Canvas 2D GPU 가속 드로우콜 렌더링
    this.renderFrame(idleOffsets);

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * 변환된 행렬 버퍼를 기반으로 스프라이트 조각들을 WebGL/Canvas에 렌더링합니다.
   */
  renderFrame(idleOffsets) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const dpr = this.viewport ? this.viewport.dpr : 1;

    // 캔버스 클리어 및 DPR 고해상도 리셋
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 가용 해상도 영역을 중앙 정렬하여 중앙 (width/2, height/2)을 기준 좌표계로 설정
    const halfW = (canvas.width / dpr) / 2;
    const halfH = (canvas.height / dpr) / 2;

    const slots = this.engine.data.skeleton.slots;

    // Z-Index 순서대로 실시간 드로우 정렬 (안정적인 레이어 뎁스 보장)
    const sortedSlots = [...slots].sort((a, b) => {
      const zA = a.zIndex !== undefined ? a.zIndex : 0;
      const zB = b.zIndex !== undefined ? b.zIndex : 0;
      return zA - zB;
    });

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const slotMat = this.engine.slotMatrices[slot.id];
      const assetId = slot.defaultAsset;
      const img = this.downloader.loadedAssets[assetId];

      if (!slotMat || !img) continue;

      ctx.save();
      
      // DPR 고해상도 스케일 선행 적용
      ctx.scale(dpr, dpr);
      
      // 화면 중앙 원점으로 트랜스폼 평행이동 설정
      ctx.translate(halfW, halfH);

      // 슬롯의 최종 변환 행렬을 Canvas 2D 변환 행렬에 1:1 대입 인젝션
      // m00(a), m10(b), m01(c), m11(d), m02(e), m12(f)
      ctx.transform(
        slotMat[0], slotMat[1],
        slotMat[3], slotMat[4],
        slotMat[6], slotMat[7]
      );

      // 대기 모드 시 호흡/안구 미세 변형을 관절 본에 추가 가중치 곱 연산 적용
      if (this.optimizer.isIdle) {
        if (slot.bone === 'shoulder_R' || slot.bone === 'root') {
          // 가슴/몸통 부속 미세 팽창
          ctx.scale(1.0, idleOffsets.chestScaleY);
        }
        if (slot.id.includes('eye') || slot.bone.includes('head')) {
          // 눈 깜빡임 수직 압축
          ctx.scale(1.0, idleOffsets.eyeScaleY);
        }
      }

      // 아핀 변환 좌표계 내부에서 이미지의 고유 해상도 크기를 곱하여 최종 드로잉 완료
      // Matrix 계산 시 피봇(-px, -py) 스케일링이 들어가 있으므로, 픽셀 크기만큼 넓혀 그림
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      ctx.restore();
    }
  }

  /**
   * 로딩 진입 장벽 보호를 위해 부드러운 글래스모피즘 계열 로딩 화면을 캔버스에 직접 드로잉합니다.
   */
  renderLoadingScreen(loaded, total) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f172a'; // 다크 심해 테마색
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const percent = Math.floor((loaded / (total || 1)) * 100);

    // 미려한 텍스트 렌더링
    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('로딩 중...', canvas.width / 2, canvas.height / 2 - 20);

    // 로딩바 게이지 드로잉
    ctx.fillStyle = '#1e293b';
    const barWidth = 300;
    const barHeight = 8;
    const barX = (canvas.width - barWidth) / 2;
    const barY = canvas.height / 2 + 10;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 로딩 진행바 채우기 (그라데이션 기법 적용)
    const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    grad.addColorStop(0, '#6366f1'); // Indigo
    grad.addColorStop(1, '#a855f7'); // Purple
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barWidth * (percent / 100), barHeight);
  }

  /**
   * 유효하지 않은 데이터 파손 시 복구 불가능 화면 송출
   */
  renderErrorScreen(message) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1e1b4b'; // Deep Indigo
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f43f5e'; // Red rose
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('오류 발생', canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px sans-serif';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 10);
  }

  /**
   * 플레이어 종료 시 자원 회수 및 타이머/루프 영구 파기 (Lifecycle Termination)
   */
  destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // 엔진 메모리 정적 풀 완전 소거 집행
    if (this.engine) {
      this.engine.destroy();
    }
    
    this.persistence.clearSnapshot();
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    console.log('[AnimationPlayer] 플레이어 인스턴스 자원 완벽 격리 해제 완료.');
  }
}
