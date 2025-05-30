(function() {
  // ページ内のリンク情報を抽出する関数
  function extractLinksFromDocument(doc) {
    const links = Array.from(doc.querySelectorAll('a[href^="https://booth.pm/downloadables/"]'));
    return links.map(a => {
      let fileName = '';
      let packageName = '';
      let author = '';
      let titleDiv = a.closest('.mb-16')?.querySelector('.font-bold.typography-16');
      if (titleDiv) {
        packageName = titleDiv.textContent.trim();
      }
      let fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
      if (fileDiv) {
        fileName = fileDiv.textContent.trim();
      }
      let mb16 = a.closest('.mb-16');
      if (mb16) {
        let authorDiv = mb16.querySelector('.text-text-gray600.typography-14');
        if (authorDiv) {
          author = authorDiv.textContent.trim();
        }
      }
      let itemUrl = '';
      if (mb16) {
        let itemLink = mb16.querySelector('a[href*="/items/"]');
        if (itemLink) {
          itemUrl = itemLink.href;
        }
      }
      return { downloadLink: a.href, fileName, packageName, author, itemUrl };
    });
  }

  // 最終ページ番号を取得
  function getLastPageNumber() {
    const lastPageA = document.querySelector('a.nav-item.last-page');
    if (!lastPageA) return 1;
    const href = lastPageA.getAttribute('href');
    const match = href.match(/page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  // 指定ページのHTMLを取得し、Documentに変換
  async function fetchDocument(url) {
    const res = await fetch(url);
    const text = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/html');
  }

  // 全ページのリンク情報を集める
  async function collectAllPagesLinks() {
    const baseUrl = location.origin + location.pathname;
    const lastPage = getLastPageNumber();
    let allRawLinks = [];
    for (let page = 1; page <= lastPage; page++) {
      const url = `${baseUrl}?page=${page}`;
      let doc;
      if (page === 1) {
        doc = document;
      } else {
        doc = await fetchDocument(url);
      }
      allRawLinks = allRawLinks.concat(extractLinksFromDocument(doc));
    }
    return allRawLinks;
  }

  (async () => {
    const rawLinks = await collectAllPagesLinks();

    const grouped = {};
    rawLinks.forEach(item => {
      if (!item.packageName) return;
      if (!grouped[item.packageName]) grouped[item.packageName] = { author: item.author, itemUrl: item.itemUrl, files: [] };
      grouped[item.packageName].files.push({
        fileName: item.fileName,
        downloadLink: item.downloadLink
      });
    });

    // 商品画像URLを取得
    async function fetchImageUrls(downloadLinks) {
      const results = await Promise.all(downloadLinks.map(async (entry) => {
        let imageUrl = '';
        if (entry.itemUrl) {
          try {
            const res = await fetch(entry.itemUrl + '.json');
            if (res.ok) {
              const json = await res.json();
              if (json.images && json.images.length > 0 && json.images[0].original) {
                imageUrl = json.images[0].original;
              }
            }
          } catch (e) {
            // 失敗時は空のまま
          }
        }
        // imageUrlをfilesの前に配置
        return {
          packageName: entry.packageName,
          author: entry.author,
          itemUrl: entry.itemUrl,
          imageUrl: imageUrl,
          files: entry.files
        };
      }));
      return results;
    }

    const downloadLinks = Object.entries(grouped).map(([packageName, data]) => ({
      packageName,
      author: data.author,
      itemUrl: data.itemUrl,
      files: data.files
    }));

    // 画像URLの取得を必ず待つ
    const linksWithImages = await fetchImageUrls(downloadLinks);
    window.BOOTH_DOWNLOAD_LINKS = linksWithImages;

    // メッセージ受信時に画像URLも含めて返す
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'GET_DOWNLOAD_LINKS') {
        // 必ず画像URL付きで返す
        sendResponse({links: window.BOOTH_DOWNLOAD_LINKS});
      }
    });
  })();
})();
