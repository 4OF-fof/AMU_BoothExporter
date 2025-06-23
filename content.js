(function() {
  function extractLinksFromDocument(doc) {
    const links = Array.from(doc.querySelectorAll('a[href^="https://booth.pm/downloadables/"]'));
    return links.map(a => {
      let fileName = '';
      // ファイル名: aタグの祖先.mt-16内の .typography-14 クラスdivのテキスト
      let fileDiv = a.closest('.mt-16')?.querySelector('.typography-14');
      if (fileDiv) {
        fileName = fileDiv.textContent.trim();
      }
      // 商品ページURL: aタグの祖先.mb-16内の a[href*="/items/"] のhref属性
      let itemUrl = '';
      let mb16 = a.closest('.mb-16');
      if (mb16) {
        let itemLink = mb16.querySelector('a[href*="/items/"]');
        if (itemLink) {
          itemUrl = itemLink.href;
        }
      }
      return { itemUrl, fileName, downloadUrl: a.href };
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
      if (!item.itemUrl) return;
      if (!grouped[item.itemUrl]) grouped[item.itemUrl] = [];
      grouped[item.itemUrl].push({
        fileName: item.fileName,
        downloadUrl: item.downloadUrl
      });
    });
    const links = Object.entries(grouped).map(([itemUrl, files]) => ({
      itemUrl,
      files
    }));
    window.BOOTH_DOWNLOAD_LINKS = links;

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'GET_DOWNLOAD_LINKS') {
        console.log('送信links:', window.BOOTH_DOWNLOAD_LINKS);
        sendResponse({links: window.BOOTH_DOWNLOAD_LINKS});
      }
      if (msg.type === 'FETCH_ITEM_JSON' && msg.itemUrl) {
        (async () => {
          try {
            const res = await fetch(msg.itemUrl + '.json');
            if (res.ok) {
              const json = await res.json();
              sendResponse({success: true, json});
            } else {
              sendResponse({success: false, error: 'status:' + res.status});
            }
          } catch (e) {
            sendResponse({success: false, error: e.toString()});
          }
        })();
        return true; // async response
      }
    });
  })();
})();
