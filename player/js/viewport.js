/**
 * 가용 영역 계산 기반 반응형 WebGL Canvas 뷰포트 설정 모듈
 * 
 * 모바일 및 다양한 기기의 화면 크기에 대응하여 외부 UI(광고, 로고, 대화 텍스트창)의
 * 점유 면적을 선행 계산하고, 남은 "실제 가용 영역" 안에서 최소 축 길이 기준의
 * 고정 종횡비 캔버스를 수직 상단 정렬 배치합니다.
 */
export class ResponsiveViewport {
  /**
   * 반응형 계산을 적용하여 캔버스의 절대 크기를 조절합니다.
   * 
   * @param {HTMLCanvasElement} canvas - 렌더링에 사용될 Canvas 엘리먼트
   * @param {number} aspectWidth - 저작 시 규정된 종횡비 가로 비율 (기본값 1)
   * @param {number} aspectHeight - 저작 시 규정된 종횡비 세로 비율 (기본값 1)
   * @param {Array<string>} excludeSelectors - 제외 계산을 실행할 외부 UI CSS 셀렉터 리스트
   */
  static resize(canvas, aspectWidth = 1, aspectHeight = 1, excludeSelectors = ['.player-header', '.dialog-panel', '.ads-banner']) {
    if (!canvas) return;

    // 1단계: 브라우저 창 전체 가용 폭과 높이 확보
    let totalWidth = window.innerWidth;
    let totalHeight = window.innerHeight;

    // 2단계: 외부 고정 UI 요소들의 높이/너비 점유량 계산
    let excludedHeight = 0;
    let excludedWidth = 0;

    for (let i = 0; i < excludeSelectors.length; i++) {
      const el = document.querySelector(excludeSelectors[i]);
      if (el) {
        const rect = el.getBoundingClientRect();
        // 화면 수직 적층 구조가 기본이므로 높이 차감 위주로 연산
        excludedHeight += rect.height;
      }
    }

    // 3단계: 순수 가용 화면 영역(Actual Available Viewport) 도출
    const availableWidth = Math.max(200, totalWidth - excludedWidth);
    const availableHeight = Math.max(200, totalHeight - excludedHeight);

    // 4단계: 가로/세로 중 종횡비를 보존하여 가용 영역에 꽉 차는 최대 크기 산출
    const targetRatio = aspectWidth / aspectHeight;
    const currentRatio = availableWidth / availableHeight;

    let finalWidth = 0;
    let finalHeight = 0;

    if (currentRatio > targetRatio) {
      // 높이가 제약 축인 경우 (가로가 더 넓음)
      finalHeight = availableHeight;
      finalWidth = availableHeight * targetRatio;
    } else {
      // 가로가 제약 축인 경우 (세로가 더 김)
      finalWidth = availableWidth;
      finalHeight = availableWidth / targetRatio;
    }

    // 5단계: 물리적 캔버스 엘리먼트 크기(CSS) 및 렌더 버퍼 해상도(Device Pixel Ratio 가중치) 갱신
    const dpr = window.devicePixelRatio || 1;
    
    // CSS 픽셀 스타일 크기 강제 매핑 (상단 정렬을 위한 Layout 구조)
    canvas.style.width = `${finalWidth}px`;
    canvas.style.height = `${finalHeight}px`;

    // WebGL 내부 고해상도 백버퍼 크기 갱신 (선명한 텍스처 보장)
    canvas.width = finalWidth * dpr;
    canvas.height = finalHeight * dpr;

    // 가용 크기 정보 반환 (엔진 좌표계 신축 매칭을 위해 사용)
    return {
      width: finalWidth,
      height: finalHeight,
      dpr: dpr
    };
  }
}
