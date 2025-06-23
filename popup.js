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
        getLinksFromContentScript(async function(links) {
          if (!Array.isArray(links) || links.length === 0) {
            alert('商品情報が取得できませんでした。ページを再読み込みしてください。');
            getDataBtn.disabled = false;
            getDataBtn.textContent = 'データを取得';
            return;
          }
          // itemUrlごとにjsonを取得し、flatListを作成
          const flatList = [];
          for (const item of links) {
            if (!item.itemUrl) continue;
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
          // 保存日時をlocalStorageに記録
          const now = new Date();
          const dateStr = now.toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
          localStorage.setItem('bpm_save_datetime', dateStr);
          getDataBtn.disabled = false;
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
