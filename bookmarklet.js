(async function() {
  'use strict';

  // --- UI Functions ---
  let progressOverlay = null;

  function showProgress(message) {
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.style.position = 'fixed';
      progressOverlay.style.top = '10px';
      progressOverlay.style.right = '10px';
      progressOverlay.style.padding = '15px 20px';
      progressOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      progressOverlay.style.color = 'white';
      progressOverlay.style.zIndex = '9999';
      progressOverlay.style.borderRadius = '5px';
      progressOverlay.style.fontFamily = 'sans-serif';
      progressOverlay.style.fontSize = '16px';
      document.body.appendChild(progressOverlay);
    }
    progressOverlay.textContent = message;
  }

  function hideProgress() {
    if (progressOverlay) {
      progressOverlay.remove();
      progressOverlay = null;
    }
  }

  // --- Main Logic from content.js and popup.js ---

  if (!location.hostname.endsWith('booth.pm')) {
    alert('このブックマークレットはBOOTHのページで実行してください。');
    return;
  }

  // --- Utility Functions ---
  function extractLinksFromDocument(doc) {
    return Array.from(doc.querySelectorAll('a[href^="https://booth.pm/downloadables/"]')).map(a => {
      const fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
      const fileName = fileDiv ? fileDiv.textContent.trim() : '';
      let itemUrl = '';
      let packageName = '';
      const mb16 = a.closest('.mb-16');
      if (mb16) {
        const itemLink = mb16.querySelector('a[href*="/items/"]');
        if (itemLink) itemUrl = itemLink.href;
        let titleDiv = mb16.querySelector('.font-bold.typography-16');
        if (titleDiv) {
          packageName = titleDiv.textContent.trim();
        }
      }
      return { itemUrl, fileName, downloadUrl: a.href, packageName };
    });
  }

  function getLastPageNumber(doc) {
    const lastPageA = doc.querySelector('a.nav-item.last-page');
    if (!lastPageA) return 1;
    const match = lastPageA.getAttribute('href')?.match(/page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  async function fetchDocument(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const text = await res.text();
    return new DOMParser().parseFromString(text, 'text/html');
  }

  async function collectAllPagesLinksForPath(path) {
    const baseUrl = location.origin + path;
    // 最初のページは現在のドキュメントかfetchするかを判定
    const isFirstPageActive = location.pathname === path || location.pathname === `${path}/`;
    let firstDoc = isFirstPageActive ? document : await fetchDocument(baseUrl);
    const lastPage = getLastPageNumber(firstDoc);
    let allLinks = [];
    for (let page = 1; page <= lastPage; page++) {
      showProgress(`所有アセットをリストアップ中 (${path})... (${page} / ${lastPage})`);
      const url = `${baseUrl}?page=${page}`;
      // 2ページ目以降、または最初のページがアクティブでない場合にfetch
      const doc = (page === 1 && isFirstPageActive) ? firstDoc : await fetchDocument(url);
      allLinks = allLinks.concat(extractLinksFromDocument(doc));
       await new Promise(resolve => setTimeout(resolve, 50)); // 負荷軽減
    }
    return allLinks;
  }

  async function getAllGroupedLinks() {
    const [libraryLinks, giftsLinks] = await Promise.all([
      collectAllPagesLinksForPath('/library'),
      collectAllPagesLinksForPath('/library/gifts')
    ]);
    const rawLinks = libraryLinks.concat(giftsLinks);
    const grouped = {};
    rawLinks.forEach(item => {
      if (!item.itemUrl) return;
      if (!grouped[item.itemUrl]) {
        grouped[item.itemUrl] = {
          packageName: item.packageName || '',
          files: []
        };
      }
      grouped[item.itemUrl].files.push({ fileName: item.fileName, downloadUrl: item.downloadUrl });
    });
    return Object.entries(grouped).map(([itemUrl, data]) => ({
      itemUrl,
      packageName: data.packageName,
      files: data.files
    }));
  }

  async function fetchItemJson(itemUrl) {
    try {
      const res = await fetch(itemUrl + '.json');
      if (res.ok) {
        return { success: true, json: await res.json() };
      }
      return { success: false, error: 'status:' + res.status };
    } catch (e) {
      return { success: false, error: e.toString() };
    }
  }

  // --- Main Execution ---
  try {
    showProgress('データ取得を開始します...');
    const links = await getAllGroupedLinks();

    if (!Array.isArray(links) || links.length === 0) {
      throw new Error('商品情報が取得できませんでした。');
    }

    const flatList = [];
    for (let i = 0; i < links.length; i++) {
      const item = links[i];
      if (!item.itemUrl) continue;
      
      showProgress(`詳細情報を取得中... (${i + 1} / ${links.length})`);
      await new Promise(resolve => setTimeout(resolve, 100)); // API負荷軽減のためのウェイト

      const response = await fetchItemJson(item.itemUrl);
      let itemInfo = { itemName: '', authorName: '', imageUrl: '', description: '' };

      if (response && response.success && response.json) {
        const json = response.json;
        itemInfo.itemName = json.name || '';
        itemInfo.authorName = (json.shop && json.shop.name) ? json.shop.name : '';
        itemInfo.imageUrl = (json.images && json.images[0] && json.images[0].original) ? json.images[0].original : '';
        itemInfo.description = json.description || '';
      } else {
        itemInfo.itemName = item.packageName || '';
      }

      for (const file of item.files) {
        flatList.push({
          itemName: itemInfo.itemName,
          authorName: itemInfo.authorName,
          itemUrl: item.itemUrl,
          imageUrl: itemInfo.imageUrl,
          description: itemInfo.description,
          fileName: file.fileName,
          downloadUrl: file.downloadUrl
        });
      }
    }

    hideProgress();

    // Download JSON
    const json = JSON.stringify(flatList, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AMU_BoothItem.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('ブックマークレットの実行中にエラーが発生しました:', error);
    showProgress(`エラー: ${error.message} (詳細はコンソールを確認)`);
    setTimeout(hideProgress, 5000);
  }
})();