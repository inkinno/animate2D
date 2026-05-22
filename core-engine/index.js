import { Matrix3 } from './matrix.js';
import { globalMatrixPool, globalVectorPool } from './pool.js';
import { ForwardKinetics } from './kinetics.js';
import { BezierEasing, Interpolator } from './interpolation.js';
import { BoundaryMatcher } from './bounds.js';

/**
 * 2D Skeletal Animation Core Engine Orchestrator
 * 
 * 데이터 스키마 유효성 파싱, Cubic-Bezier LUT 사전 베이킹 캐싱,
 * 매 프레임 경과 시간(ms)에 따른 뼈대 FK 행렬 연산 및 슬롯 변환 갱신을 총괄합니다.
 */
export class CoreEngine {
  constructor(schemaData) {
    this.data = schemaData;
    this.bakedLuts = {};
    this.worldMatrices = {}; // { [boneId]: Float32Array(9) }
    this.slotMatrices = {};  // { [slotId]: Float32Array(9) }
    
    // 이징 룩업테이블 사전 미분 베이킹 개시
    this.bakeEasingCurves();
  }

  /**
   * JSON 애니메이션 데이터 내에 명세된 모든 Cubic-Bezier 제어점을 감지하여
   * 256단계 LUT(Look-Up Table) 배열로 사전 굽기 처리(Baking) 및 캐싱합니다.
   */
  bakeEasingCurves() {
    if (!this.data.animations) return;

    for (const animId in this.data.animations) {
      const anim = this.data.animations[animId];
      if (!anim.timeline) continue;

      for (const targetId in anim.timeline) {
        const tracks = anim.timeline[targetId];
        for (const property in tracks) {
          const keyframes = tracks[property];
          if (!Array.isArray(keyframes)) continue;

          for (let i = 0; i < keyframes.length; i++) {
            const kf = keyframes[i];
            if (kf.easing && Array.isArray(kf.easing)) {
              const easingKey = kf.easing.join(',');
              if (!this.bakedLuts[easingKey]) {
                // LUT 사전 굽기 집행
                this.bakedLuts[easingKey] = BezierEasing.bakeLUT(
                  kf.easing[0], kf.easing[1],
                  kf.easing[2], kf.easing[3]
                );
              }
            }
          }
        }
      }
    }
  }

  /**
   * 특정 애니메이션의 특정 시간(ms) 프레임을 연산하여 
   * 최종 월드 본 행렬 및 슬롯 렌더링 행렬을 갱신합니다.
   * 
   * @param {string} animId - 구동할 애니메이션 시퀀스 ID (예: "punch_sequence")
   * @param {number} timeMs - 현재 경과 시간 (밀리초)
   */
  update(animId, timeMs) {
    // 0단계: 임시 연산용 벡터/행렬 풀 인덱스 리셋 (GC Jank 원천 차단)
    globalMatrixPool.reset();
    globalVectorPool.reset();

    const bones = this.data.skeleton.bones;
    const slots = this.data.skeleton.slots;
    const anim = this.data.animations ? this.data.animations[animId] : null;

    // 1단계: 각 본의 보간된 SRT 값 구하기
    const animatedValues = {};
    
    // 기본 정적 바인드 포즈로 초기화
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      animatedValues[bone.id] = {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        scaleX: bone.scaleX,
        scaleY: bone.scaleY
      };
    }

    // 애니메이션 타임라인 보간값 대입
    if (anim && anim.timeline) {
      for (const targetId in anim.timeline) {
        // 해당 타깃이 본(Bone)인지 슬롯(Slot)인지 식별하기 위해 검색
        const isBone = bones.some(b => b.id === targetId);
        
        if (isBone) {
          const tracks = anim.timeline[targetId];
          const animVal = animatedValues[targetId];
          
          if (tracks.x) animVal.x = Interpolator.getValueAtTime(timeMs, tracks.x, this.bakedLuts);
          if (tracks.y) animVal.y = Interpolator.getValueAtTime(timeMs, tracks.y, this.bakedLuts);
          if (tracks.rotation) animVal.rotation = Interpolator.getValueAtTime(timeMs, tracks.rotation, this.bakedLuts);
          if (tracks.scaleX) animVal.scaleX = Interpolator.getValueAtTime(timeMs, tracks.scaleX, this.bakedLuts);
          if (tracks.scaleY) animVal.scaleY = Interpolator.getValueAtTime(timeMs, tracks.scaleY, this.bakedLuts);
        }
      }
    }

    // 2단계: 관절 찢어짐 방지 동적 경계 매칭 적용
    BoundaryMatcher.apply(animatedValues, bones);

    // 3단계: 포워드 키네마틱스(FK) 월드 본 행렬 계산
    ForwardKinetics.compute(bones, animatedValues, this.worldMatrices);

    // 4단계: 슬롯들의 최종 렌더링 월드 변환 행렬 매핑 계산
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      
      // 슬롯에 할당할 렌더링 아웃풋 행렬 메모리 확보 (초기 1회용)
      if (!this.slotMatrices[slot.id]) {
        this.slotMatrices[slot.id] = Matrix3.create();
      }
      
      const slotMat = this.slotMatrices[slot.id];
      const parentBoneMatrix = this.worldMatrices[slot.bone];

      if (!parentBoneMatrix) {
        Matrix3.identity(slotMat);
        continue;
      }

      // 애니메이션 타임라인의 슬롯 스케일 보간값 획득
      let sScaleX = 1.0;
      let sScaleY = 1.0;
      if (anim && anim.timeline && anim.timeline[slot.id]) {
        const slotTracks = anim.timeline[slot.id];
        if (slotTracks.scaleX) sScaleX = Interpolator.getValueAtTime(timeMs, slotTracks.scaleX, this.bakedLuts);
        if (slotTracks.scaleY) sScaleY = Interpolator.getValueAtTime(timeMs, slotTracks.scaleY, this.bakedLuts);
      }

      // 슬롯 자체 피봇 보정 및 스케일 행렬 연산
      // 피봇 기준점 (px, py) 변환: 텍스처 중심축으로 이동 및 스케일
      const localMat = globalMatrixPool.get();
      Matrix3.identity(localMat);
      
      // 슬롯 피봇의 물리적 원점 이동 보정 (피봇 상대좌표 0.0 ~ 1.0 범위)
      // 피봇이 local 원점(0,0)에 오도록 마이너스 오프셋 적용
      const px = slot.pivot ? slot.pivot.x : 0.5;
      const py = slot.pivot ? slot.pivot.y : 0.5;
      
      // SRT 중 스케일을 먼저 적용한 후, 피봇 오프셋 이동
      Matrix3.scale(localMat, localMat, sScaleX, sScaleY);
      Matrix3.translate(localMat, localMat, -px, -py);

      // 본의 월드 행렬과 슬롯 로컬 행렬을 곱하여 최종 슬롯 월드 행렬 확립
      // SlotWorld = BoneWorld * SlotLocal
      Matrix3.multiply(slotMat, parentBoneMatrix, localMat);
    }
  }

  /**
   * 시스템 종료 시 자원을 완벽 해제합니다. (Lifecycle Termination)
   */
  destroy() {
    this.data = null;
    this.bakedLuts = {};
    this.worldMatrices = {};
    this.slotMatrices = {};
    globalMatrixPool.clear();
  }
}
