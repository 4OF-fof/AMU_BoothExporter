(function() {
  // --- Utility Functions ---
  function extractLinksFromDocument(doc) {
    return Array.from(doc.querySelectorAll('a[href^="https://booth.pm/downloadables/"]')).map(a => {
      // ファイル名取得
      const fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
      const fileName = fileDiv ? fileDiv.textContent.trim() : '';
      // 商品ページURL取得
      let itemUrl = '';
      let packageName = '';
      const mb16 = a.closest('.mb-16');
      if (mb16) {
        const itemLink = mb16.querySelector('a[href*="/items/"]');
        if (itemLink) itemUrl = itemLink.href;
        // 商品タイトル取得
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
    const text = await res.text();
    return new DOMParser().parseFromString(text, 'text/html');
  }

  // ページをまたいでリンクを収集
  async function collectAllPagesLinksForPath(path) {
    const baseUrl = location.origin + path;
    let firstDoc = (location.pathname === path) ? document : await fetchDocument(baseUrl);
    const lastPage = getLastPageNumber(firstDoc);
    let allLinks = [];
    for (let page = 1; page <= lastPage; page++) {
      const url = `${baseUrl}?page=${page}`;
      const doc = (page === 1) ? firstDoc : await fetchDocument(url);
      allLinks = allLinks.concat(extractLinksFromDocument(doc));
    }
    return allLinks;
  }

  // 全リンクをまとめて取得
  async function getAllGroupedLinks() {
    const [libraryLinks, giftsLinks] = await Promise.all([
      collectAllPagesLinksForPath('/library'),
      collectAllPagesLinksForPath('/library/gifts')
    ]);
    const rawLinks = libraryLinks.concat(giftsLinks);
    // itemUrlごとにグループ化
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
  // --- メッセージリスナー ---
  let boothLinksCache = null;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'GET_DOWNLOAD_LINKS':
        (async () => {
          if (!boothLinksCache) {
            boothLinksCache = await getAllGroupedLinks();
            // JSONでタイトル情報を上書き
            for (let item of boothLinksCache) {
              try {
                const res = await fetch(item.itemUrl + '.json');
                if (res.ok) {
                  const json = await res.json();
                  if (json.name) {
                    item.packageName = json.name;
                  }
                }
              } catch (e) {
                // JSON取得に失敗した場合はそのまま
              }
            }
          }
          sendResponse({ links: boothLinksCache });
        })();
        return true; // async response
      case 'FETCH_ITEM_JSON':
        if (msg.itemUrl) {
          (async () => {
            try {
              const res = await fetch(msg.itemUrl + '.json');
              if (res.ok) {
                const json = await res.json();
                sendResponse({ success: true, json });
              } else {
                sendResponse({ success: false, error: 'status:' + res.status });
              }
            } catch (e) {
              sendResponse({ success: false, error: e.toString() });
            }
          })();
          return true;
        }
        break;
      default:
        // 何もしない
        break;
    }
  });
})();
