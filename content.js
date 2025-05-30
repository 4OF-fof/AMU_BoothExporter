(function() {
  // ダウンロードリンクaタグを全て取得
  const links = Array.from(document.querySelectorAll('a[href^="https://booth.pm/downloadables/"]'));
  const rawLinks = links.map(a => {
    let fileName = '';
    let packageName = '';
    let author = '';
    // 商品タイトル: aタグの祖先.mb-16内の .font-bold.typography-16 クラスdivのテキスト
    let titleDiv = a.closest('.mb-16')?.querySelector('.font-bold.typography-16');
    if (titleDiv) {
      packageName = titleDiv.textContent.trim();
    }
    // ファイル名: aタグの祖先.mt-16内の .typography-14 クラスdivのテキスト
    let fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
    if (fileDiv) {
      fileName = fileDiv.textContent.trim();
    }
    // 作者情報: aタグの祖先.mb-16内の .text-text-gray600.typography-14 クラスdivのテキスト
    let mb16 = a.closest('.mb-16');
    if (mb16) {
      let authorDiv = mb16.querySelector('.text-text-gray600.typography-14');
      if (authorDiv) {
        author = authorDiv.textContent.trim();
      }
    }
    // 商品ページURL: aタグの祖先.mb-16内の a[href*="/items/"] のhref属性
    let itemUrl = '';
    if (mb16) {
      let itemLink = mb16.querySelector('a[href*="/items/"]');
      if (itemLink) {
        itemUrl = itemLink.href;
      }
    }
    return { downloadLink: a.href, fileName, packageName, author, itemUrl };
  });

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

  fetchImageUrls(downloadLinks).then((linksWithImages) => {
    window.BOOTH_DOWNLOAD_LINKS = linksWithImages;
  });

  // メッセージ受信時に画像URLも含めて返す
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_DOWNLOAD_LINKS') {
      // 画像URL取得が終わっていればそれを返す
      if (window.BOOTH_DOWNLOAD_LINKS) {
        sendResponse({links: window.BOOTH_DOWNLOAD_LINKS});
      } else {
        // まだなら従来通り返す
        sendResponse({links: downloadLinks});
      }
    }
  });
})();
