/**
 * Pseudo-3D Engine (의사 3D 보간 알고리즘)
 * 
 * 3D 메시 연산 없이 평면 2D 이미지만으로 입체적인 회전 공간 착시를 주기 위해
 * Q2(의견 A) 5개 기본 각도 축[-90, -45, 0, 45, 90]의 Opacity와 ScaleX 가중치를 수학적으로 보간합니다.
 */
export class Pseudo3DEngine {
  constructor() {
    // 5대 핵심 기준 각도 스택 (오름차순)
    this.anchorAngles = [-90, -45, 0, 45, 90];
  }

  /**
   * 임의의 사용자 지정 각도에 대해 인접한 두 앵커 각도의 가중치(Opacity) 및 보정 ScaleX를 반환합니다.
   * 
   * @param {number} angle - 작가가 설정한 2D 씬의 회전 각도 (도 단위, -180 ~ 180도 범위 권장)
   * @returns {Object} {
   *   primaryIdx: 주 각도 앵커 인덱스,
   *   secondaryIdx: 보조 각도 앵커 인덱스,
   *   primaryWeight: 주 각도 투명도 가중치 (0~1),
   *   secondaryWeight: 보조 각도 투명도 가중치 (0~1),
   *   scaleX: 입체감을 주기 위한 가로 폭 보정 곱수 (cos 기반 감쇄)
   * }
   */
  calculateInterpolation(angle) {
    // 각도 범위를 -180 ~ 180도로 정규화
    let normAngle = ((angle + 180) % 360) - 180;
    if (normAngle < -180) normAngle += 360;

    // 극단적인 범위를 5대 기준 각도 클램프 [-90, 90] 범위로 일단 바인딩
    const clampedAngle = Math.max(-90, Math.min(90, normAngle));

    let primaryIdx = 2; // Default 0도 (정면)
    let secondaryIdx = 2;
    let t = 0; // 보간 가중치 (0 ~ 1)

    // clampedAngle이 속하는 인접 구간 탐색
    for (let i = 0; i < this.anchorAngles.length - 1; i++) {
      const minAng = this.anchorAngles[i];
      const maxAng = this.anchorAngles[i + 1];

      if (clampedAngle >= minAng && clampedAngle <= maxAng) {
        primaryIdx = i;
        secondaryIdx = i + 1;
        t = (clampedAngle - minAng) / (maxAng - minAng);
        break;
      }
    }

    // 주/부 가중치(Opacity) 결정
    const secondaryWeight = t;
    const primaryWeight = 1 - t;

    // 입체감을 살리는 가로 폭 스케일 보정 (코사인 감쇄식 활용)
    // 0도일 때 가로 스케일 100%, 90도/ -90도로 갈수록 0%에 수렴하며 얇아지는 착시
    const rad = (clampedAngle * Math.PI) / 180;
    const scaleX = Math.cos(rad);

    return {
      primaryIdx,
      secondaryIdx,
      primaryWeight,
      secondaryWeight,
      scaleX
    };
  }

  /**
   * 보간 상태를 적용하여 캔버스 2D 컨텍스트에 렌더링할 때의 가중치 수치를 계산합니다.
   * 각 각도별 소스 에셋이 존재한다는 가정 하에, 각 에셋의 활성 불투명도(alpha) 값을 도출합니다.
   * 
   * @param {number} angle - 연산 대상 각도
   * @returns {Array<number>} 5개 앵커 각도 에셋 각각에 곱해질 알파값(Opacity)의 배열 (길이 5)
   */
  getAlphaMap(angle) {
    const alphas = [0, 0, 0, 0, 0];
    const interp = this.calculateInterpolation(angle);

    alphas[interp.primaryIdx] = interp.primaryWeight;
    alphas[interp.secondaryIdx] = interp.secondaryWeight;

    return alphas;
  }
}
