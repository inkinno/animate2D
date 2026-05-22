/**
 * Layer Guard & Attribute Locker (레이어 가드 및 속성 락 제어 모듈)
 * 
 * SOLID 단일 책임 원칙(SRP)에 따라 자식 본의 극단적 축소로 결합부에 틈이 발생할 때 
 * Z-Index 레이어 순서를 동적 승격시켜 파편화를 마스킹하고, 
 * 각 본/슬롯의 속성 수정 잠금 상태(Locker)를 통제합니다.
 */
export class MakerLayerGuard {
  constructor() {
    // 락 상태 데이터 맵 (Key: "boneId_property", Value: Boolean)
    this.lockedAttributes = new Set();
  }

  /**
   * 특정 본의 특정 변형 속성에 대한 Lock 상태 토글
   * 
   * @param {string} boneId - 대상 본 ID
   * @param {string} property - 'tx' | 'ty' | 'rotation' | 'scaleX' | 'scaleY'
   * @returns {boolean} 최종 락 여부
   */
  toggleLock(boneId, property) {
    const key = `${boneId}_${property}`;
    if (this.lockedAttributes.has(key)) {
      this.lockedAttributes.delete(key);
      return false;
    } else {
      this.lockedAttributes.add(key);
      return true;
    }
  }

  /**
   * 해당 본의 속성이 락 상태인지 검사
   */
  isLocked(boneId, property) {
    return this.lockedAttributes.has(`${boneId}_${property}`);
  }

  /**
   * 레이어 가드 (Z-Index Swap)
   * 
   * 자식 본의 최종 결합 스케일 곱이 부모 스케일 대비 현저히 줄어들면(0.5배 이하),
   * 결합 틈새가 벌어져 찢어지는 현상을 가리기 위해 자식 본이 위치한 슬롯의 Z-Index를 
   * 부모 본의 Z-Index보다 1계단 우선 강제 동적 승격시킵니다.
   * 
   * @param {Object} schema - 스토어에 보존된 마스터 JSON 데이터 구조
   */
  executeZIndexGuard(schema) {
    const bones = schema.skeleton.bones;
    const slots = schema.skeleton.slots;

    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      if (!bone.parent) continue; // 부모가 없으면 상속 관계가 아니므로 스킵

      const parentBone = bones.find(b => b.id === bone.parent);
      if (!parentBone) continue;

      // 자식과 부모의 스케일 차이 분석
      const childScale = (bone.scaleX !== undefined ? bone.scaleX : 1.0) * (bone.scaleY !== undefined ? bone.scaleY : 1.0);
      const parentScale = (parentBone.scaleX !== undefined ? parentBone.scaleX : 1.0) * (parentBone.scaleY !== undefined ? parentBone.scaleY : 1.0);

      // 자식이 부모 스케일에 비해 0.5배 이하로 과다 축소된 경우
      if (childScale / (parentScale || 1.0) <= 0.5) {
        // 자식 본에 장착된 슬롯 탐색
        const childSlots = slots.filter(s => s.bone === bone.id);
        // 부모 본에 장착된 슬롯 탐색
        const parentSlots = slots.filter(s => s.bone === parentBone.id);

        if (childSlots.length > 0 && parentSlots.length > 0) {
          // 부모 슬롯 중 최대 Z-Index 산출
          const maxParentZ = Math.max(...parentSlots.map(s => s.zIndex !== undefined ? s.zIndex : 0));

          // 자식 슬롯들을 부모 슬롯의 최대 뎁스 바로 윗단계로 동적 승격 (Z-Index Swap)
          for (let j = 0; j < childSlots.length; j++) {
            if ((childSlots[j].zIndex !== undefined ? childSlots[j].zIndex : 0) <= maxParentZ) {
              childSlots[j].zIndex = maxParentZ + 1; // 1계단 위로 레이어 스왑
            }
          }
        }
      }
    }
  }
}
