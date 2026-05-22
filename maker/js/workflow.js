/**
 * Maker Custom Workflow & Helpers (워크플로우 제어 및 시각화 도우미)
 * 
 * SOLID 단일 책임 원칙(SRP)에 따라 SRT 클립보드 복사/붙여넣기, 
 * 어니언 스킨 실루엣 가이드 드로잉, 
 * 그리고 Cubic-Bezier 제어점에 대한 1차 미분 가속도 곡선 썸네일 렌더링을 제공합니다.
 */
export class MakerWorkflow {
  constructor() {
    // SRT 복사용 단일 임시 버퍼 (클립보드)
    this.srtClipboard = null;
  }

  /**
   * 선택된 본의 SRT 상태값을 복사하여 클립보드에 보존
   */
  copySRT(bone) {
    if (!bone) return;
    this.srtClipboard = {
      tx: bone.tx !== undefined ? bone.tx : 0,
      ty: bone.ty !== undefined ? bone.ty : 0,
      rotation: bone.rotation !== undefined ? bone.rotation : 0,
      scaleX: bone.scaleX !== undefined ? bone.scaleX : 1.0,
      scaleY: bone.scaleY !== undefined ? bone.scaleY : 1.0
    };
    console.log(`[MakerWorkflow] 본 "${bone.id}"의 SRT 상태값을 클립보드에 복사했습니다.`, this.srtClipboard);
  }

  /**
   * 복사된 클립보드 SRT 속성을 대상 본에 붙여넣기
   * 
   * @param {Object} targetBone - 대상 본 객체
   * @returns {boolean} 붙여넣기 성공 여부
   */
  pasteSRT(targetBone) {
    if (!targetBone || !this.srtClipboard) return false;

    targetBone.tx = this.srtClipboard.tx;
    targetBone.ty = this.srtClipboard.ty;
    targetBone.rotation = this.srtClipboard.rotation;
    targetBone.scaleX = this.srtClipboard.scaleX;
    targetBone.scaleY = this.srtClipboard.scaleY;

    console.log(`[MakerWorkflow] 클립보드 SRT 데이터를 대상 본 "${targetBone.id}"에 성공적으로 주입했습니다.`);
    return true;
  }

  /**
   * 어니언 스킨(Onion Skinning) 투영 렌더러
   * 
   * 현재 시점(T)을 기준으로 직전 키프레임(T-80ms, 과거: 파란색)과 직후 키프레임(T+80ms, 미래: 빨간색) 
   * 실루엣 잔상을 알파값 20% 투명도로 캔버스에 덧칠 렌더링합니다.
   */
  renderOnionSkin(ctx, engine, animId, currentTimeMs, loadedAssets, viewport) {
    if (!engine || !engine.data.animations[animId]) return;

    const duration = engine.data.animations[animId].duration;
    const dpr = viewport ? viewport.dpr : 1;
    const halfW = (ctx.canvas.width / dpr) / 2;
    const halfH = (ctx.canvas.height / dpr) / 2;

    // 과거 프레임(-80ms)과 미래 프레임(+80ms) 시간대 설정
    const offsets = [
      { time: Math.max(0, currentTimeMs - 120), color: 'rgba(56, 189, 248, 0.22)', label: 'Past' },   // Light Blue
      { time: Math.min(duration, currentTimeMs + 120), color: 'rgba(244, 63, 94, 0.22)', label: 'Future' } // Light Rose
    ];

    ctx.save();
    
    for (let i = 0; i < offsets.length; i++) {
      const skin = offsets[i];
      if (skin.time === currentTimeMs) continue;

      // 1. 임시 프레임 시간에 맞춰 엔진 내부 행렬 상태 가상 갱신
      engine.update(animId, skin.time);

      const slots = engine.data.skeleton.slots;
      const sortedSlots = [...slots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      // 2. 해당 시간 프레임의 실루엣 투영 렌더
      for (let j = 0; j < sortedSlots.length; j++) {
        const slot = sortedSlots[j];
        const slotMat = engine.slotMatrices[slot.id];
        const assetId = slot.defaultAsset;
        const img = loadedAssets[assetId];

        if (!slotMat || !img) continue;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(halfW, halfH);

        // 월드 변환 적용
        ctx.transform(
          slotMat[0], slotMat[1],
          slotMat[3], slotMat[4],
          slotMat[6], slotMat[7]
        );

        // 어니언 실루엣 전용 마스크 칠 기법
        // 캔버스 드로잉에 전역 합성 모드를 입히거나, 간이 실루엣 드로잉
        ctx.globalAlpha = 0.2;
        
        // 반투명 단색 실루엣 연출을 위해 임시 캔버스 역할을 대신할 마스크 컬러 처리
        ctx.fillStyle = skin.color;
        
        // 브라우저 렉 방지를 위해 단순 이미지를 반투명 드로잉하고 오버레이
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // 이미지 형태에 맞춰 틴트를 주는 효과를 캔버스 globalCompositeOperation으로 가볍게 연출
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillRect(0, 0, img.width, img.height);

        ctx.restore();
      }
    }

    ctx.restore();

    // 3. 렌더링이 완료된 후 엔진 행렬 상태를 현재 본래의 프레임 시간(currentTimeMs)으로 자동 롤백
    engine.update(animId, currentTimeMs);
  }

  /**
   * Cubic-Bezier 변형 가속도 궤적(속도 미분 그래프) 실시간 썸네일 드로잉
   * 
   * @param {HTMLCanvasElement} canvas - 프리뷰할 타겟 미니 캔버스 엘리먼트
   * @param {number} x1 - Bezier 제어점 X1
   * @param {number} y1 - Bezier 제어점 Y1
   * @param {number} x2 - Bezier 제어점 X2
   * @param {number} y2 - Bezier 제어점 Y2
   */
  drawEasingThumbnail(canvas, x1, y1, x2, y2) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, w, height);

    // 격자 가이드선 (글래스모피즘 어울림)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2); ctx.lineTo(w, height / 2);
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, height);
    ctx.stroke();

    // 1. 기본 Bezier 이징 곡선 그리기 (연청색 선)
    ctx.strokeStyle = '#06b6d4'; // Neon Cyan
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, height); // (0, 0) 원점은 하단 왼쪽

    // 64프레임 샘플링 보간 그리기
    const samples = 64;
    const easingPoints = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      
      // Bezier Cubic 식에 의한 계산
      const cx = 3 * x1;
      const bx = 3 * (x2 - x1) - cx;
      const ax = 1 - cx - bx;
      
      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;

      const px = ((ax * t + bx) * t + cx) * t;
      const py = ((ay * t + by) * t + cy) * t;

      const drawX = px * w;
      const drawY = height - (py * height); // 상하 뒤집기

      ctx.lineTo(drawX, drawY);
      easingPoints.push({ x: px, y: py });
    }
    ctx.stroke();

    // 2. 가속도 미분 그래프 썸네일 그리기 (네온 보라색 선)
    // 인접 속도 변화율(dy/dx)을 계산하여 속도 그래프 드로잉
    ctx.strokeStyle = '#a855f7'; // Neon Purple
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 1; i < easingPoints.length; i++) {
      const p1 = easingPoints[i - 1];
      const p2 = easingPoints[i];

      const dx = p2.x - p1.x || 0.001;
      const dy = p2.y - p1.y;

      const speed = dy / dx; // 미분 속도값
      const normSpeed = Math.min(3.0, Math.max(0.0, speed)) / 3.0; // 3배 최대 가속도 정규화

      const drawX = p2.x * w;
      const drawY = height - (normSpeed * height); // 하단 기준 속도 곡선

      ctx.lineTo(drawX, drawY);
    }
    ctx.stroke();
    ctx.setLineDash([]); // 대시 리셋
  }
}
