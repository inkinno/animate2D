import { Matrix3 } from './matrix.js';

/**
 * Garbage Collection 방지용 Object Pool (Matrix3 전용)
 * 
 * requestAnimationFrame 렌더링 루프 등 매 프레임 수백 번 일어나는 행렬 연산에서
 * Float32Array 인스턴스를 무분별하게 new 생성하면 GC Jank가 발생합니다.
 * 이를 차단하기 위해 미리 행렬 버퍼를 풀에 적재하고 재사용하는 모듈입니다.
 */
export class MatrixPool {
  constructor(initialSize = 100) {
    this.size = initialSize;
    this.pool = [];
    this.index = 0;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(Matrix3.create());
    }
  }

  /**
   * 풀에서 행렬 하나를 빌립니다.
   */
  get() {
    if (this.index >= this.size) {
      // 필요 시 정적 풀 자동 확장
      const additionalSize = 50;
      for (let i = 0; i < additionalSize; i++) {
        this.pool.push(Matrix3.create());
      }
      this.size += additionalSize;
    }
    const mat = this.pool[this.index++];
    Matrix3.identity(mat); // 사용 전 단위행렬로 보장
    return mat;
  }

  /**
   * 매 프레임 연산이 완전히 완료된 시점에 풀 인덱스를 0으로 리셋하여
   * 동적 메모리 소모 없이 처음부터 공간을 안전하게 재활용하도록 합니다.
   */
  reset() {
    this.index = 0;
  }

  /**
   * 풀 내의 모든 자원을 소거합니다. (Lifecycle Termination 시 호출)
   */
  clear() {
    this.pool = [];
    this.size = 0;
    this.index = 0;
  }
}

// 글로벌 공유 뼈대 연산 풀 인스턴스
export const globalMatrixPool = new MatrixPool(200);
export const globalVectorPool = {
  pool: Array.from({ length: 50 }, () => new Float32Array(2)),
  index: 0,
  get() {
    if (this.index >= this.pool.length) {
      this.pool.push(new Float32Array(2));
    }
    const vec = this.pool[this.index++];
    vec[0] = 0;
    vec[1] = 0;
    return vec;
  },
  reset() {
    this.index = 0;
  }
};
