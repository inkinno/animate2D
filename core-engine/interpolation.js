/**
 * 2D Skeletal Animation Interpolation & Easing Engine
 * 
 * 3차 베지에(Cubic-Bezier) 곡선 연산을 실시간 프레임 런타임에서 계산하면 부하가 생깁니다.
 * 이를 해결하기 위해 에셋 로드 시점에 이징 곡선 정보를 256단계의 정적 룩업 테이블(LUT)로
 * 사전 미분 베이킹하여 런타임 시 정수 인덱싱 및 선형 보간만으로 보간을 초고속 집행합니다.
 */

export class BezierEasing {
  /**
   * 4개의 제어점을 기반으로 256단계 룩업 테이블(LUT)을 생성합니다.
   * 
   * @param {number} mX1 - 제어점 1 X
   * @param {number} mY1 - 제어점 1 Y
   * @param {number} mX2 - 제어점 2 X
   * @param {number} mY2 - 제어점 2 Y
   * @returns {Float32Array} 256단계의 보간율 LUT
   */
  static bakeLUT(mX1, mY1, mX2, mY2) {
    const lut = new Float32Array(256);
    if (mX1 === mY1 && mX2 === mY2) {
      // Linear (선형 보간) 특수 케이스 빠른 처리
      for (let i = 0; i < 256; i++) {
        lut[i] = i / 255;
      }
      return lut;
    }

    // 256단계에 대응하는 Bezier x값에 대응하는 y값을 샘플링
    // t를 0에서 1까지 미세하게 나누어 (예: 1000분할) x값에 맞는 y값들을 채웁니다.
    const sampleSize = 1000;
    const tempX = new Float32Array(sampleSize);
    const tempY = new Float32Array(sampleSize);

    const calcBezier = (t, p1, p2) => {
      return 3.0 * (1.0 - t) * (1.0 - t) * t * p1 + 3.0 * (1.0 - t) * t * t * p2 + t * t * t;
    };

    for (let i = 0; i < sampleSize; i++) {
      const t = i / (sampleSize - 1);
      tempX[i] = calcBezier(t, mX1, mX2);
      tempY[i] = calcBezier(t, mY1, mY2);
    }

    // 256개의 X 지점 (0.0 ~ 1.0)에 해당하는 Y값을 선형 탐색으로 채워넣기
    for (let i = 0; i < 256; i++) {
      const targetX = i / 255;
      // tempX에서 targetX와 가장 가까운 지점 찾기 (tempX는 단조 증가하므로 이진 탐색 가능)
      let low = 0;
      let high = sampleSize - 1;
      let mid = 0;
      
      while (low < high) {
        mid = (low + high) >> 1;
        if (tempX[mid] < targetX) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      // 인접한 두 점 사이에서 선형 보간하여 정밀성 증대
      if (low === 0) {
        lut[i] = tempY[0];
      } else {
        const x0 = tempX[low - 1];
        const x1 = tempX[low];
        const y0 = tempY[low - 1];
        const y1 = tempY[low];
        const ratio = (targetX - x0) / (x1 - x0 || 1);
        lut[i] = y0 + ratio * (y1 - y0);
      }
    }

    return lut;
  }

  /**
   * 베이킹된 LUT를 활용해 시간 비율 t(0.0 ~ 1.0)에 따른 보간율을 고속 반환합니다.
   * 
   * @param {Float32Array} lut - 256단계 베이킹된 LUT
   * @param {number} t - 시간 비율 (0.0 ~ 1.0)
   * @returns {number} 보간 가중치 (0.0 ~ 1.0)
   */
  static interpolate(lut, t) {
    if (t <= 0) return lut[0];
    if (t >= 1) return lut[255];

    // index를 구하고 그 사이를 선형 보간
    const scaledT = t * 255;
    const index = Math.floor(scaledT);
    const fraction = scaledT - index;

    const v0 = lut[index];
    const v1 = lut[index + 1];

    return v0 + fraction * (v1 - v0);
  }
}

/**
 * 2D Skeletal Animation 핵심 보간 프로세서
 */
export class Interpolator {
  /**
   * 두 키프레임 사이의 선형 또는 LUT 이징 값을 계산합니다.
   * 
   * @param {number} time - 현재 절대 시간(ms)
   * @param {Array} keyframes - [{time, value, easing}] 구조의 키프레임 배열
   * @param {Object} bakedLuts - 캐싱된 베이킹 LUT { [easingKey]: Float32Array(256) }
   * @returns {number} 보간된 최종 수치
   */
  static getValueAtTime(time, keyframes, bakedLuts = {}) {
    if (!keyframes || keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    // 1단계: 경계 시간 예외 처리
    if (time <= keyframes[0].time) return keyframes[0].value;
    if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

    // 2단계: 현재 시간에 해당하는 키프레임 세그먼트 탐색 (이진 탐색)
    let low = 0;
    let high = keyframes.length - 2;
    let index = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (time < keyframes[mid].time) {
        high = mid - 1;
      } else if (time >= keyframes[mid + 1].time) {
        low = mid + 1;
      } else {
        index = mid;
        break;
      }
    }

    const k0 = keyframes[index];
    const k1 = keyframes[index + 1];

    // 3단계: 정규화 시간 t (0.0 ~ 1.0) 도출
    const duration = k1.time - k0.time;
    const t = (time - k0.time) / (duration || 1);

    // 4단계: 이징 적용
    let factor = t;
    if (k0.easing) {
      const easingKey = k0.easing.join(',');
      const lut = bakedLuts[easingKey];
      if (lut) {
        factor = BezierEasing.interpolate(lut, t);
      }
    }

    // 5단계: 보간된 수치 값 반환
    return k0.value + factor * (k1.value - k0.value);
  }
}
