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
    return { downloadLink: a.href, fileName, packageName, author };
  });

  const grouped = {};
  rawLinks.forEach(item => {
    if (!item.packageName) return;
    if (!grouped[item.packageName]) grouped[item.packageName] = { author: item.author, files: [] };
    grouped[item.packageName].files.push({
      fileName: item.fileName,
      downloadLink: item.downloadLink
    });
  });

  const downloadLinks = Object.entries(grouped).map(([packageName, data]) => ({
    packageName,
    author: data.author,
    files: data.files
  }));
  window.BOOTH_DOWNLOAD_LINKS = downloadLinks;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_DOWNLOAD_LINKS') {
      sendResponse({links: downloadLinks});
    }
  });
})();
