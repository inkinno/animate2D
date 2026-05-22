/**
 * 마스터 JSON 스키마 규격 검증기 (Schema Validator)
 * 
 * 시스템 로딩 직후 외부 JSON 파일이 마스터 규격(Bones, Slots, Animations)에
 * 부합하는지 런타임 검사하여 파손된 파일 주입으로 인한 엔진 폭사를 방지합니다.
 */
export class SchemaValidator {
  /**
   * 주입된 JSON 데이터의 유효성을 검사합니다.
   * 
   * @param {Object} data - 검증할 JSON 데이터 객체
   * @returns {boolean} 유효 여부
   */
  static validate(data) {
    if (!data) {
      console.error('[SchemaValidator] 데이터가 존재하지 않습니다 (null or undefined).');
      return false;
    }

    // 1. 필수 루트 노드 및 메타 정보 확인
    if (!data.meta || typeof data.meta !== 'Object' && data.meta === null) {
      // JavaScript typeof null === 'object' 주의
      if (typeof data.meta !== 'object') {
        console.error('[SchemaValidator] meta 필드가 누락되었거나 객체가 아닙니다.');
        return false;
      }
    }

    if (!data.meta.version) {
      console.warn('[SchemaValidator] meta.version이 누락되었습니다. 기본 버전으로 간주합니다.');
    }

    // 2. 라이브러리 스프라이트 필드 점검
    if (!data.library || !Array.isArray(data.library.sprites)) {
      console.error('[SchemaValidator] library.sprites 필드가 없거나 배열 형식이 아닙니다.');
      return false;
    }

    // 3. skeleton 노드 및 하부 bones, slots 점검
    if (!data.skeleton) {
      console.error('[SchemaValidator] skeleton 노드가 누락되었습니다.');
      return false;
    }

    if (!Array.isArray(data.skeleton.bones)) {
      console.error('[SchemaValidator] skeleton.bones가 배열 형식이 아닙니다.');
      return false;
    }

    if (!Array.isArray(data.skeleton.slots)) {
      console.error('[SchemaValidator] skeleton.slots가 배열 형식이 아닙니다.');
      return false;
    }

    // 4. bones 구조 세부 검증 (id, parent 존재 체크)
    const boneIds = new Set();
    for (let i = 0; i < data.skeleton.bones.length; i++) {
      const bone = data.skeleton.bones[i];
      if (!bone.id) {
        console.error(`[SchemaValidator] bones[${i}] 요소에 id가 존재하지 않습니다.`);
        return false;
      }
      boneIds.add(bone.id);
    }

    // 부모 본이 존재하는 본인지 교차 검증
    for (let i = 0; i < data.skeleton.bones.length; i++) {
      const bone = data.skeleton.bones[i];
      if (bone.parent && !boneIds.has(bone.parent)) {
        console.error(`[SchemaValidator] bone "${bone.id}"의 부모 본 "${bone.parent}"을 찾을 수 없습니다.`);
        return false;
      }
    }

    // 5. slots 구조 세부 검증 (id, bone 귀속 체크)
    for (let i = 0; i < data.skeleton.slots.length; i++) {
      const slot = data.skeleton.slots[i];
      if (!slot.id || !slot.bone) {
        console.error(`[SchemaValidator] slots[${i}] 요소에 id 혹은 bone 지주가 누락되었습니다.`);
        return false;
      }
      if (!boneIds.has(slot.bone)) {
        console.error(`[SchemaValidator] slot "${slot.id}"이 존재하지 않는 본 "${slot.bone}"에 묶여 있습니다.`);
        return false;
      }
    }

    return true;
  }
}
