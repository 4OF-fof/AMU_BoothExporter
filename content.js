(function() {
  function extractLinksFromDocument(doc) {
    const links = Array.from(doc.querySelectorAll('a[href^="https://booth.pm/downloadables/"]'));
    return links.map(a => {
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
  }

  function getLastPageNumber(doc) {
    const lastPageA = doc.querySelector('a.nav-item.last-page');
    if (!lastPageA) return 1;
    const href = lastPageA.getAttribute('href');
    const match = href.match(/page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  async function fetchDocument(url) {
    const res = await fetch(url);
    const text = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/html');
  }

  async function collectAllPagesLinks() {
    const baseUrl = location.origin + location.pathname;
    let allRawLinks = [];
    let firstDoc = document;
    let lastPage = getLastPageNumber(firstDoc);
    for (let page = 1; page <= lastPage; page++) {
      const url = `${baseUrl}?page=${page}`;
      let doc;
      if (page === 1) {
        doc = firstDoc;
      } else {
        doc = await fetchDocument(url);
      }
      allRawLinks = allRawLinks.concat(extractLinksFromDocument(doc));
    }
    return allRawLinks;
  }

  async function collectAllPagesLinksForPath(path) {
    const baseUrl = location.origin + path;
    let allRawLinks = [];
    let firstDoc;
    if (location.pathname === path) {
      firstDoc = document;
    } else {
      firstDoc = await fetchDocument(baseUrl);
    }
    let lastPage = getLastPageNumber(firstDoc);
    for (let page = 1; page <= lastPage; page++) {
      const url = `${baseUrl}?page=${page}`;
      let doc;
      if (page === 1) {
        doc = firstDoc;
      } else {
        doc = await fetchDocument(url);
      }
      allRawLinks = allRawLinks.concat(extractLinksFromDocument(doc));
    }
    return allRawLinks;
  }

  (async () => {
    const [libraryLinks, giftsLinks] = await Promise.all([
      collectAllPagesLinksForPath('/library'),
      collectAllPagesLinksForPath('/library/gifts')
    ]);
    const rawLinks = libraryLinks.concat(giftsLinks);

    const grouped = {};
    rawLinks.forEach(item => {
      if (!item.packageName) return;
      if (!grouped[item.packageName]) grouped[item.packageName] = { author: item.author, itemUrl: item.itemUrl, files: [] };
      grouped[item.packageName].files.push({
        fileName: item.fileName,
        downloadLink: item.downloadLink
      });
    });

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
          }
        }
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

    const linksWithImages = await fetchImageUrls(downloadLinks);
    window.BOOTH_DOWNLOAD_LINKS = linksWithImages;

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'GET_DOWNLOAD_LINKS') {
        sendResponse({links: window.BOOTH_DOWNLOAD_LINKS});
      }
    });
  })();
})();
