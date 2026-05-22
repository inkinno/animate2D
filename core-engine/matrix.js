/**
 * 2D Affine Transformation Matrix (3x3) Module
 * 
 * 성능 최적화 및 Garbage Collection 최소화를 위해
 * 모든 연산은 새로운 객체를 동적 생성하지 않고, 
 * 결과를 저장할 out 행렬을 인자로 받는 정적 메모리(In-place) 연산 방식으로 동작합니다.
 * 
 * 3x3 Matrix 구조 (Float32Array(9)):
 * [
 *   m00(a), m10(b), m20(0),  <- column 0 (X축 base)
 *   m01(c), m11(d), m21(0),  <- column 1 (Y축 base)
 *   m02(e), m12(f), m22(1)   <- column 2 (Translation)
 * ]
 * 
 * Canvas 2D / WebGL 호환 형태 (a, b, c, d, e, f):
 * a = m00, b = m10, c = m01, d = m11, e = m02, f = m12
 */

export class Matrix3 {
  /**
   * 새로운 Matrix3 인스턴스를 생성합니다. (초기화 단계에서만 사용 권장)
   */
  static create() {
    const mat = new Float32Array(9);
    mat[0] = 1; mat[4] = 1; mat[8] = 1; // Identity matrix
    return mat;
  }

  /**
   * 행렬을 단위행렬(Identity Matrix)로 리셋합니다.
   */
  static identity(out) {
    out[0] = 1; out[1] = 0; out[2] = 0;
    out[3] = 0; out[4] = 1; out[5] = 0;
    out[6] = 0; out[7] = 0; out[8] = 1;
    return out;
  }

  /**
   * 행렬 A와 B를 곱하여 out에 저장합니다. (out = A * B)
   */
  static multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];
    const a20 = a[6], a21 = a[7], a22 = a[8];

    const b00 = b[0], b01 = b[1], b02 = b[2];
    const b10 = b[3], b11 = b[4], b12 = b[5];
    const b20 = b[6], b21 = b[7], b22 = b[8];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22;

    out[3] = b10 * a00 + b11 * a10 + b12 * a20;
    out[4] = b10 * a01 + b11 * a11 + b12 * a21;
    out[5] = b10 * a02 + b11 * a12 + b12 * a22;

    out[6] = b20 * a00 + b21 * a10 + b22 * a20;
    out[7] = b20 * a01 + b21 * a11 + b22 * a21;
    out[8] = b20 * a02 + b21 * a12 + b22 * a22;

    return out;
  }

  /**
   * 행렬 src의 값을 dest로 복사합니다.
   */
  static copy(dest, src) {
    dest[0] = src[0]; dest[1] = src[1]; dest[2] = src[2];
    dest[3] = src[3]; dest[4] = src[4]; dest[5] = src[5];
    dest[6] = src[6]; dest[7] = src[7]; dest[8] = src[8];
    return dest;
  }

  /**
   * 행렬에 이동(Translation) 변환을 적용합니다.
   */
  static translate(out, mat, x, y) {
    out[0] = mat[0]; out[1] = mat[1]; out[2] = mat[2];
    out[3] = mat[3]; out[4] = mat[4]; out[5] = mat[5];
    out[6] = mat[0] * x + mat[3] * y + mat[6];
    out[7] = mat[1] * x + mat[4] * y + mat[7];
    out[8] = mat[2] * x + mat[5] * y + mat[8];
    return out;
  }

  /**
   * 행렬에 회전(Rotation) 변환을 적용합니다. (각도는 라디안 단위)
   */
  static rotate(out, mat, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);

    const m00 = mat[0], m01 = mat[1], m02 = mat[2];
    const m10 = mat[3], m11 = mat[4], m12 = mat[5];

    out[0] = m00 * c + m10 * s;
    out[1] = m01 * c + m11 * s;
    out[2] = m02 * c + m12 * s;

    out[3] = m10 * c - m00 * s;
    out[4] = m11 * c - m01 * s;
    out[5] = m12 * c - m02 * s;

    out[6] = mat[6]; out[7] = mat[7]; out[8] = mat[8];
    return out;
  }

  /**
   * 행렬에 크기(Scale) 변환을 적용합니다.
   */
  static scale(out, mat, sx, sy) {
    out[0] = mat[0] * sx; out[1] = mat[1] * sx; out[2] = mat[2] * sx;
    out[3] = mat[3] * sy; out[4] = mat[4] * sy; out[5] = mat[5] * sy;
    out[6] = mat[6]; out[7] = mat[7]; out[8] = mat[8];
    return out;
  }

  /**
   * 행렬로부터 아핀 변환(SRT)을 1단계로 합성합니다.
   * 복합 계산 순서: Translation -> Rotation -> Scale
   */
  static fromSRT(out, x, y, rad, sx, sy) {
    this.identity(out);
    this.translate(out, out, x, y);
    this.rotate(out, out, rad);
    this.scale(out, out, sx, sy);
    return out;
  }

  /**
   * 행렬 m을 가지고 2D 좌표 (x, y)를 변환하여 outVector([x, y])에 대입합니다.
   */
  static transformPoint(outVector, m, x, y) {
    outVector[0] = m[0] * x + m[3] * y + m[6];
    outVector[1] = m[1] * x + m[4] * y + m[7];
    return outVector;
  }
}
