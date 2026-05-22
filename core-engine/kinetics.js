import { Matrix3 } from './matrix.js';
import { globalMatrixPool } from './pool.js';

/**
 * 2D Forward Kinematics (FK) 역학 엔진
 * 
 * 부모 본의 트랜스폼 변형 행렬이 자식 본으로 순차 누적 상속되는
 * 완전 복합 아핀 변환(Composite Affine Transformation) 계층 처리를 담당합니다.
 */
export class ForwardKinetics {
  /**
   * 계층 구조 본(Bones)들의 현재 변형 값을 기반으로 
   * 모든 본의 월드 변환 행렬(worldMatrix)을 계산합니다.
   * 
   * @param {Array} bones - skeleton.bones에 해당하는 원본 구조 배열
   * @param {Object} animatedValues - 현재 프레임에 보간된 각 본의 SRT 오버라이드 값 맵 { [boneId]: { x, y, rotation, scaleX, scaleY } }
   * @param {Object} outWorldMatrices - 계산된 월드 행렬을 저장할 맵 { [boneId]: Float32Array(9) }
   */
  static compute(bones, animatedValues, outWorldMatrices) {
    // 1단계: 빠른 ID 조회를 위해 맵 매핑
    const boneMap = {};
    for (let i = 0; i < bones.length; i++) {
      boneMap[bones[i].id] = bones[i];
    }

    // 2단계: 각 본의 로컬 변환 행렬 계산 후 상속 관계를 타고 월드 행렬 계산
    // GC를 막기 위해 풀에서 임시 행렬을 빌려와 순차 처리합니다.
    const visited = {};

    const computeWorldMatrix = (boneId) => {
      if (visited[boneId]) {
        return outWorldMatrices[boneId];
      }

      const bone = boneMap[boneId];
      if (!bone) return null;

      // 결과를 저장할 월드 행렬 공간이 없으면 확보 (초기 1회용)
      if (!outWorldMatrices[boneId]) {
        outWorldMatrices[boneId] = Matrix3.create();
      }
      const worldMat = outWorldMatrices[boneId];

      // 현재 프레임의 보간값 가져오기 (없으면 기본 정적 바인드 포즈 값 적용)
      const anim = animatedValues[boneId] || {};
      const tx = anim.x !== undefined ? anim.x : bone.x;
      const ty = anim.y !== undefined ? anim.y : bone.y;
      const rot = anim.rotation !== undefined ? anim.rotation : bone.rotation;
      const sx = anim.scaleX !== undefined ? anim.scaleX : bone.scaleX;
      const sy = anim.scaleY !== undefined ? anim.scaleY : bone.scaleY;

      // 60분율 회전각(Degree)을 라디안(Radian)으로 정밀 변환
      const rad = (rot * Math.PI) / 180;

      // 임시로 로컬 행렬 계산
      const localMat = globalMatrixPool.get();
      Matrix3.fromSRT(localMat, tx, ty, rad, sx, sy);

      if (bone.parent && boneMap[bone.parent]) {
        // 부모가 있는 경우: 부모 월드 행렬을 재귀 계산 후 곱 연산
        const parentWorldMat = computeWorldMatrix(bone.parent);
        if (parentWorldMat) {
          Matrix3.multiply(worldMat, parentWorldMat, localMat);
        } else {
          Matrix3.copy(worldMat, localMat);
        }
      } else {
        // 루트 노드인 경우: 로컬 행렬이 곧 월드 행렬
        Matrix3.copy(worldMat, localMat);
      }

      visited[boneId] = true;
      return worldMat;
    };

    // 모든 본에 대해 연산 개시
    for (let i = 0; i < bones.length; i++) {
      computeWorldMatrix(bones[i].id);
    }
  }
}
