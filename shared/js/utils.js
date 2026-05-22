/**
 * 2D Skeletal Animation Shared Utilities
 * 
 * SOLID/DRY 원칙에 따라 중복 로직을 제거하고,
 * 에셋이 부재할 때도 뼈대와 슬롯 관절들이 예쁜 도형으로 시각화될 수 있게
 * SVG Data URI를 즉석 동적 생성하는 가상 에셋 생성 유틸리티를 제공합니다.
 */

export class ImageLoader {
  /**
   * 이미지 URL을 HTMLImageElement로 비동기 로드합니다.
   * @param {string} src - 이미지 소스 (URL 또는 Data URI)
   * @returns {Promise<HTMLImageElement>}
   */
  static load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`이미지 로드 실패: ${src}`));
      img.src = src;
    });
  }
}

export class VirtualAssetGenerator {
  /**
   * 뼈대 구조를 확인하기 위해 예쁜 사이버펑크 스타일 그라데이션 SVG 이미지를 동적 빌드하여 반환합니다.
   * @param {string} type - 에셋 종류 ('img_arm_upper', 'img_arm_lower', 'img_sword', 'img_shield', 'body', 'head' 등)
   * @returns {string} SVG Data URI
   */
  static generateSVG(type) {
    let svgContent = '';
    
    switch (type) {
      case 'img_arm_upper':
        // 둥글고 예쁜 Indigo 그라데이션 상완 (100x40)
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
            <defs>
              <linearGradient id="g_upper" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#6366f1" />
                <stop offset="100%" stop-color="#4f46e5" />
              </linearGradient>
            </defs>
            <rect x="5" y="5" width="110" height="30" rx="15" fill="url(#g_upper)" stroke="#818cf8" stroke-width="2" />
            <circle cx="20" cy="20" r="6" fill="#ffffff" opacity="0.8" />
            <circle cx="100" cy="20" r="4" fill="#ffffff" opacity="0.6" />
          </svg>
        `;
        break;
      case 'img_arm_lower':
        // Y축 팽창 시 안전한 둥근 Purple 그라데이션 하완 (100x30)
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="30" viewBox="0 0 100 30">
            <defs>
              <linearGradient id="g_lower" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#7c3aed" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="92" height="22" rx="11" fill="url(#g_lower)" stroke="#c084fc" stroke-width="2" />
            <circle cx="15" cy="15" r="5" fill="#ffffff" opacity="0.8" />
            <circle cx="85" cy="15" r="3" fill="#ffffff" opacity="0.6" />
          </svg>
        `;
        break;
      case 'img_sword':
        // 날카로운 네온 Cyan 그라데이션 장검 (180x40)
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="180" height="40" viewBox="0 0 180 40">
            <defs>
              <linearGradient id="g_sword" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stop-color="#06b6d4" />
                <stop offset="80%" stop-color="#0891b2" />
                <stop offset="100%" stop-color="#ffffff" />
              </linearGradient>
            </defs>
            <!-- 힐트/손잡이 -->
            <rect x="0" y="15" width="30" height="10" rx="3" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
            <rect x="25" y="5" width="8" height="30" rx="2" fill="#475569" />
            <!-- 검날 -->
            <path d="M 33 10 L 160 10 L 180 20 L 160 30 L 33 30 Z" fill="url(#g_sword)" stroke="#22d3ee" stroke-width="2" />
            <line x1="33" y1="20" x2="165" y2="20" stroke="#ffffff" stroke-width="1" opacity="0.7" />
          </svg>
        `;
        break;
      case 'img_shield':
        // 프리미엄 네온 Rose 그라데이션 방패 (100x100)
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="g_shield" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f43f5e" />
                <stop offset="100%" stop-color="#be123c" />
              </linearGradient>
            </defs>
            <path d="M 10 10 L 90 10 C 90 60, 50 95, 50 95 C 50 95, 10 60, 10 10 Z" fill="url(#g_shield)" stroke="#fb7185" stroke-width="3" />
            <path d="M 20 20 L 80 20 C 80 50, 50 80, 50 80 C 50 80, 20 50, 20 20 Z" fill="none" stroke="#ffe4e6" stroke-width="1.5" opacity="0.4" />
          </svg>
        `;
        break;
      default:
        // 일반 관절 블록 (100x100 둥근 사각형)
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect x="5" y="5" width="90" height="90" rx="20" fill="#1e293b" stroke="#475569" stroke-width="3" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5 5" />
            <text x="50" y="55" fill="#94a3b8" font-size="12" font-family="sans-serif" text-anchor="middle">${type.substring(0, 8)}</text>
          </svg>
        `;
    }
    
    // 안전한 미니멀 인코딩
    const cleanSvg = svgContent.replace(/\s+/g, ' ').trim();
    return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
  }
}
