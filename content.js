(function() {
  const links = Array.from(document.querySelectorAll('a[href^="https://booth.pm/downloadables/"]'));
  // まず各リンクから情報を抽出
  const rawLinks = links.map(a => {
    let fileName = '';
    let packageName = '';
    // 商品タイトルは、aタグの祖先にある「font-bold」かつ「typography-16」なdivのテキスト
    let titleDiv = a.closest('.mb-16')?.querySelector('.font-bold.typography-16');
    if (titleDiv) {
      packageName = titleDiv.textContent.trim();
    }
    // ファイル名は、aタグの祖先にある「typography-14」なdivのテキスト
    let fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
    if (fileDiv) {
      fileName = fileDiv.textContent.trim();
    }
    return { downloadLink: a.href, fileName, packageName };
  });

  const grouped = {};
  rawLinks.forEach(item => {
    if (!item.packageName) return;
    if (!grouped[item.packageName]) grouped[item.packageName] = [];
    grouped[item.packageName].push({
      fileName: item.fileName,
      downloadLink: item.downloadLink
    });
  });

  const downloadLinks = Object.entries(grouped).map(([packageName, files]) => ({
    packageName,
    files
  }));
  window.BOOTH_DOWNLOAD_LINKS = downloadLinks;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_DOWNLOAD_LINKS') {
      sendResponse({links: downloadLinks});
    }
  });
})();
