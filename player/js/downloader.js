/**
 * 비동기 다운로드 큐 및 분기형 씬 전환 네트워크 인터럽트(Abort) 처리기
 * 
 * 100MB 한계선 기준 순차 스트리밍 vs 일괄 다운로드 판별,
 * 유저 조작에 의한 씬 점프 시 기존 다운로드 HTTP 요청 Abort 처리,
 * 다운로드 안 된 필수 에셋 발견 시 Suspended 상태 전이 및 로딩 인디케이터 송출을 조율합니다.
 */
export class AssetDownloader {
  constructor() {
    this.loadedAssets = {}; // { [assetId]: HTMLImageElement }
    this.activeRequests = {}; // { [assetId]: AbortController }
    this.downloadQueue = [];
    this.isSuspended = false;
    this.onLoadingProgress = null; // (loaded, total) => {}
    this.onSuspensionChange = null; // (isSuspended) => {}
  }

  /**
   * 에셋 전체 크기를 대략 판별하여 100MB 기준으로 Bulk vs Streaming을 선택 로딩합니다.
   * (여기서는 데모/실무 결합을 위해 src의 길이 또는 Content-Length 메타 수치를 활용합니다.)
   * 
   * @param {Array} sprites - JSON의 library.sprites 배열
   * @param {Array} initialSceneAssetIds - 첫 구동 씬에 필수로 요구되는 에셋 ID 배열
   */
  async loadAssets(sprites, initialSceneAssetIds = []) {
    // 1단계: 총 용량(바이트 수치) 가상 연산
    let estimatedTotalBytes = 0;
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      if (sprite.src.startsWith('data:')) {
        // Base64의 문자열 크기로 바이트 환산
        estimatedTotalBytes += sprite.src.length * 0.75;
      } else {
        // 일반 URL 에셋 (가상 1MB 대입)
        estimatedTotalBytes += 1024 * 1024;
      }
    }

    const ONE_HUNDRED_MB = 100 * 1024 * 1024;
    const isStreamingMode = estimatedTotalBytes >= ONE_HUNDRED_MB;

    console.log(`[AssetDownloader] 총 예측 용량: ${(estimatedTotalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[AssetDownloader] 로딩 모드: ${isStreamingMode ? '실시간 씬 스트리밍' : '일괄 통 다운로드(Bulk)'}`);

    if (isStreamingMode) {
      // 씬 스트리밍 모드: 초기 필수 에셋만 고속 우선 로드하고 나머지는 대기
      await this.queueSceneAssets(sprites, initialSceneAssetIds, true);
      // 백그라운드에서 백그라운드 큐 조용히 구동
      this.backgroundPreloadRemaining(sprites, initialSceneAssetIds);
    } else {
      // 일괄 통 다운로드 모드: 전체 에셋 일괄 동시 요청
      const allAssetIds = sprites.map(s => s.id);
      await this.queueSceneAssets(sprites, allAssetIds, false);
    }
  }

  /**
   * 특정 씬에 필요한 에셋 리스트를 최상위 우선순위(High-Priority)로 큐에 올리고 로딩을 집행합니다.
   */
  async queueSceneAssets(sprites, assetIds, isStreaming = false) {
    // 중복 제거 및 가용 에셋 필터링
    const targetAssetIds = [...new Set(assetIds)];
    const promises = [];

    // 로딩 인디케이터 가동을 위한 Suspended 진입
    this.setSuspended(true);

    const spriteMap = {};
    for (let i = 0; i < sprites.length; i++) {
      spriteMap[sprites[i].id] = sprites[i];
    }

    let loadedCount = 0;
    const totalCount = targetAssetIds.length;

    for (let i = 0; i < targetAssetIds.length; i++) {
      const id = targetAssetIds[i];
      
      // 이미 VRAM/메모리에 올라간 에셋은 재활용 프로세스로 즉시 바이패스(Bypass)
      if (this.loadedAssets[id]) {
        loadedCount++;
        if (this.onLoadingProgress) this.onLoadingProgress(loadedCount, totalCount);
        continue;
      }

      const sprite = spriteMap[id];
      if (!sprite) continue;

      // 다운로드 약속 생성
      const promise = this.fetchSingleAsset(sprite)
        .then(img => {
          this.loadedAssets[id] = img;
          loadedCount++;
          if (this.onLoadingProgress) this.onLoadingProgress(loadedCount, totalCount);
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            console.log(`[AssetDownloader] 에셋 "${id}" 다운로드 취소(Abort) 완료.`);
          } else {
            console.error(`[AssetDownloader] 에셋 "${id}" 로드 실패:`, err);
          }
        });

      promises.push(promise);
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // 로딩이 무사 완료되었거나 바이패스되었을 시 서스펜드 해제
    this.setSuspended(false);
  }

  /**
   * 유저 상호작용으로 분기 씬 전환(예: 씬1 -> 씬5) 발생 시의 네트워크 인터럽트 연산 집행
   * 
   * @param {Array} sprites - 전체 스프라이트 배열
   * @param {Array} targetSceneAssetIds - 이동하려는 대상 씬의 필수 에셋 ID 배열
   */
  async interruptAndJump(sprites, targetSceneAssetIds) {
    console.warn('[AssetDownloader] 네트워크 인터럽트 감지! 분기 씬 에셋 큐 재정렬 개시.');

    // 1단계: 현재 전송 중인 모든 요청 중, 대상 씬에 "불필요한" 에셋들의 HTTP Fetch 요청 즉시 Abort
    const targetSet = new Set(targetSceneAssetIds);
    
    for (const id in this.activeRequests) {
      if (!targetSet.has(id)) {
        // 타깃 씬에 필요하지 않으므로 전송 중단 집행
        const controller = this.activeRequests[id];
        controller.abort();
        delete this.activeRequests[id];
      }
    }

    // 2단계: 대상 씬 에셋 중 VRAM 적재 검증 후, 미획보 에셋 우선 다운로드 집행
    await this.queueSceneAssets(sprites, targetSceneAssetIds, true);
  }

  /**
   * AbortController를 이용해 단일 에셋을 비동기 Abortable Fetch 로딩합니다.
   */
  fetchSingleAsset(sprite) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const signal = controller.signal;
      this.activeRequests[sprite.id] = controller;

      if (sprite.src.startsWith('data:')) {
        // Base64 타입 에셋
        const img = new Image();
        img.onload = () => {
          delete this.activeRequests[sprite.id];
          resolve(img);
        };
        img.onerror = (e) => {
          delete this.activeRequests[sprite.id];
          reject(e);
        };
        img.src = sprite.src;

        // Base64의 경우 취소 신호가 도달하면 강제로 핸들러 제거
        signal.addEventListener('abort', () => {
          img.src = ''; // 메모리 적재 중단
          reject(new DOMException('Aborted Base64 asset load', 'AbortError'));
        });
      } else {
        // 일반 URL HTTP Fetch 에셋
        fetch(sprite.src, { signal })
          .then(response => response.blob())
          .then(blob => {
            const img = new Image();
            img.onload = () => {
              delete this.activeRequests[sprite.id];
              resolve(img);
            };
            img.src = URL.createObjectURL(blob);
          })
          .catch(err => {
            delete this.activeRequests[sprite.id];
            reject(err);
          });
      }
    });
  }

  /**
   * 백그라운드 유휴 전력을 사용하여 나머지 에셋들을 로드합니다.
   */
  backgroundPreloadRemaining(sprites, excludedIds) {
    const excludedSet = new Set(excludedIds);
    const remaining = sprites.filter(s => !excludedSet.has(s.id));
    
    // 순차적으로 백그라운드 비동기 적재
    let p = Promise.resolve();
    for (let i = 0; i < remaining.length; i++) {
      const sprite = remaining[i];
      p = p.then(() => {
        if (this.loadedAssets[sprite.id]) return;
        return this.fetchSingleAsset(sprite)
          .then(img => {
            this.loadedAssets[sprite.id] = img;
          })
          .catch(() => {}); // 백그라운드 에러는 사일런트 무시
      });
    }
  }

  setSuspended(state) {
    this.isSuspended = state;
    if (this.onSuspensionChange) {
      this.onSuspensionChange(state);
    }
  }
}
