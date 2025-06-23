function getLinksFromContentScript(callback, errorCallback) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      errorCallback('タブ情報が取得できません');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_DOWNLOAD_LINKS'}, function(response) {
      if (chrome.runtime.lastError) {
        errorCallback('ページを再読み込みしてください。');
        return;
      }
      callback(response && response.links ? response.links : []);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isLibrary = tabs[0] && tabs[0].url && tabs[0].url.startsWith('https://accounts.booth.pm/library');
    if (isLibrary) {
      // データを取得ボタンのみ生成
      const getDataBtn = document.createElement('button');
      getDataBtn.id = 'getData';
      getDataBtn.textContent = 'データを取得';
      document.body.appendChild(getDataBtn);

      getDataBtn.addEventListener('click', async function() {
        getDataBtn.disabled = true;
        getDataBtn.textContent = 'データ取得中...';
        // 進捗表示用の要素を追加
        let progressElem = document.getElementById('progressInfo');
        if (!progressElem) {
          progressElem = document.createElement('div');
          progressElem.id = 'progressInfo';
          progressElem.style.margin = '12px 0';
          progressElem.style.fontSize = '0.95em';
          document.body.appendChild(progressElem);
        }
        getLinksFromContentScript(async function(links) {
          if (!Array.isArray(links) || links.length === 0) {
            alert('商品情報が取得できませんでした。ページを再読み込みしてください。');
            getDataBtn.disabled = false;
            getDataBtn.textContent = 'データを取得';
            if (progressElem) progressElem.textContent = '';
            return;
          }
          // itemUrlごとにjsonを取得し、flatListを作成
          const flatList = [];
          for (let i = 0; i < links.length; i++) {
            const item = links[i];
            if (!item.itemUrl) continue;
            // 進捗表示
            progressElem.textContent = `データ取得中... (${i + 1} / ${links.length})`;
            // 0.1秒待機
            await new Promise(resolve => setTimeout(resolve, 100));
            // content script経由でitemUrl.jsonを取得
            const getItemJson = () => new Promise(resolve => {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {type: 'FETCH_ITEM_JSON', itemUrl: item.itemUrl}, function(response) {
                  resolve(response);
                });
              });
            });
            let response = await getItemJson();
            let itemInfo = { itemName: '', authorName: '', imageUrl: '' };
            if (response && response.success && response.json) {
              const json = response.json;
              itemInfo.itemName = json.name || '';
              itemInfo.authorName = (json.shop && json.shop.name) ? json.shop.name : '';
              itemInfo.imageUrl = (json.images && json.images[0] && json.images[0].original) ? json.images[0].original : '';
            }
            for (const file of item.files) {
              flatList.push({
                itemName: itemInfo.itemName,
                authorName: itemInfo.authorName,
                itemUrl: item.itemUrl,
                imageUrl: itemInfo.imageUrl,
                fileName: file.fileName,
                downloadUrl: file.downloadUrl
              });
            }
          }
          // 進捗クリア
          progressElem.textContent = '';
          // JSONダウンロード
          const json = JSON.stringify(flatList, null, 2);
          const blob = new Blob([json], {type: 'application/json'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'AMU_BoothItem.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          getDataBtn.textContent = 'データを取得';
        }, function(errorMsg) {
          alert(errorMsg || 'ページを再読み込みしてください。');
          getDataBtn.disabled = false;
          getDataBtn.textContent = 'データを取得';
        });
      });
    } else {
      // ライブラリを開くボタンのみ生成
      const openLibraryBtn = document.createElement('button');
      openLibraryBtn.id = 'openLibrary';
      openLibraryBtn.textContent = 'BOOTHライブラリを開く';
      openLibraryBtn.style.width = '100%';
      openLibraryBtn.style.fontSize = '1.1em';
      openLibraryBtn.style.padding = '12px 0';
      openLibraryBtn.style.marginTop = '16px';
      document.body.appendChild(openLibraryBtn);
      openLibraryBtn.addEventListener('click', function() {
        chrome.tabs.create({url: 'https://accounts.booth.pm/library'});
      });
    }
  });
});
