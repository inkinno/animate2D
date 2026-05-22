import { Matrix3 } from './matrix.js';

/**
 * 2D Skeletal 관절 결합부 동적 경계 매칭 (Dynamic Boundary Matching) 모듈
 * 
 * 메쉬 변형(Mesh Deformation) 없이 단순 평면 스프라이트를 회전/확장할 때,
 * 부모-자식 관절 결합부(피봇)가 끊어지거나 어긋나는 불연속성을 연산 레벨에서 제어합니다.
 */
export class BoundaryMatcher {
  /**
   * 부모 본의 변형(특히 스케일)에 따라 자식 본의 스케일 및 오프셋을 자동 도킹 매칭시킵니다.
   * 
   * @param {Object} animatedValues - 현재 프레임의 SRT 보간값 맵 (In-place 수정)
   * @param {Array} bones - skeleton.bones에 해당하는 원본 구조 배열
   */
  static apply(animatedValues, bones) {
    const boneMap = {};
    for (let i = 0; i < bones.length; i++) {
      boneMap[bones[i].id] = bones[i];
    }

    // 부모-자식 관계를 바탕으로 경계 매칭 보정 진행
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      if (!bone.parent) continue; // 부모가 없으면 스킵

      const parentBone = boneMap[bone.parent];
      if (!parentBone) continue;

      const selfAnim = animatedValues[bone.id] || {};
      const parentAnim = animatedValues[parentBone.id] || {};

      // 부모 본의 스케일 변형값 가져오기
      const pScaleX = parentAnim.scaleX !== undefined ? parentAnim.scaleX : parentBone.scaleX;
      const pScaleY = parentAnim.scaleY !== undefined ? parentAnim.scaleY : parentBone.scaleY;

      // 만약 부모 본의 스케일이 1.0이 아니면(변형이 일어나면)
      // 자식 본의 결합부도 이 비율을 가중치로 흡수하여 찢어짐을 원천 방지합니다.
      if (pScaleX !== 1.0 || pScaleY !== 1.0) {
        // 자식 본의 스케일 강제 동기화 보정
        // 종횡비 고정이 필요한 본의 경우 추가 제어 수행 가능
        if (!animatedValues[bone.id]) {
          animatedValues[bone.id] = {
            x: bone.x,
            y: bone.y,
            rotation: bone.rotation,
            scaleX: bone.scaleX,
            scaleY: bone.scaleY
          };
        }
        
        // 자식 본의 시작 좌표(X, Y)는 부모 본의 팽창(Scale)량과 곱하여 정확히 자석 도킹 정렬
        // 부모 로컬 좌표계 기준의 오프셋이므로, 부모의 스케일에 비례해 오프셋 이동
        animatedValues[bone.id].x = bone.x * pScaleX;
        animatedValues[bone.id].y = bone.y * pScaleY;
      }
    }
  }
}
