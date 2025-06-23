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
  const textarea = document.getElementById('links');
  const status = document.getElementById('status');
  const saveBtn = document.getElementById('save');

  const openLibraryBtn = document.createElement('button');
  openLibraryBtn.id = 'openLibrary';
  openLibraryBtn.textContent = 'ライブラリを開く';
  openLibraryBtn.style.marginRight = '8px';

  const getDataBtn = document.createElement('button');
  getDataBtn.id = 'getData';
  getDataBtn.textContent = 'データを取得';
  getDataBtn.style.marginRight = '8px';

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isLibrary = tabs[0] && /^https:\/\/accounts\.booth\.pm\/library/.test(tabs[0].url);
    if (!isLibrary) {
      saveBtn.parentNode.insertBefore(openLibraryBtn, saveBtn);
      textarea.style.display = 'none';
      saveBtn.style.display = 'none';
      status.style.display = 'none';
    } else {
      saveBtn.parentNode.insertBefore(getDataBtn, saveBtn);
      textarea.style.display = 'none';
      saveBtn.style.display = 'none';
      status.textContent = 'データを取得ボタンを押してください。';
    }
  });

  openLibraryBtn.addEventListener('click', function() {
    chrome.tabs.create({url: 'https://accounts.booth.pm/library'});
  });

  function fetchData() {
    status.textContent = 'データを取得中...';
    getDataBtn.disabled = true;
    getLinksFromContentScript(async function(links) {
      console.log('受信links:', links);
      if (!Array.isArray(links) || links.length === 0) {
        textarea.value = '';
        status.textContent = '商品情報が取得できませんでした。ページを再読み込みしてください。';
        saveBtn.disabled = true;
        textarea.style.display = 'none';
        saveBtn.style.display = 'none';
        getDataBtn.disabled = false;
        return;
      }
      // itemUrlごとにjsonを取得し、flatListを作成
      const flatList = [];
      for (const item of links) {
        console.log('itemUrl:', item.itemUrl);
        let itemInfo = { itemName: '', authorName: '', imageUrl: '' };
        if (!item.itemUrl) {
          console.warn('itemUrlが空です', item);
          continue;
        }
        // content script経由でitemUrl.jsonを取得
        const getItemJson = () => new Promise(resolve => {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {type: 'FETCH_ITEM_JSON', itemUrl: item.itemUrl}, function(response) {
              resolve(response);
            });
          });
        });
        let response = await getItemJson();
        if (response && response.success && response.json) {
          const json = response.json;
          itemInfo.itemName = json.name || '';
          itemInfo.authorName = (json.shop && json.shop.name) ? json.shop.name : '';
          itemInfo.imageUrl = (json.images && json.images[0] && json.images[0].original) ? json.images[0].original : '';
        } else {
          console.error('content script fetch失敗:', response && response.error, item.itemUrl + '.json');
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
      const exportObj = flatList;
      textarea.value = JSON.stringify(exportObj, null, 2);
      status.textContent = '';
      saveBtn.disabled = false;
      textarea.style.display = '';
      saveBtn.style.display = '';
      getDataBtn.disabled = false;
    }, function(errorMsg) {
      textarea.value = '';
      status.textContent = 'ページを再読み込みしてください。';
      saveBtn.disabled = true;
      textarea.style.display = 'none';
      saveBtn.style.display = 'none';
      getDataBtn.disabled = false;
    });
  }

  getDataBtn.addEventListener('click', fetchData);

  // 保存日時表示用の要素を追加
  let lastSaved = localStorage.getItem('bpm_save_datetime');
  let lastSavedDiv = document.getElementById('lastSaved');
  if (!lastSavedDiv) {
    lastSavedDiv = document.createElement('div');
    lastSavedDiv.id = 'lastSaved';
    status.parentNode.insertBefore(lastSavedDiv, status.nextSibling);
  }
  function updateLastSaved() {
    lastSaved = localStorage.getItem('bpm_save_datetime');
    lastSavedDiv.textContent = lastSaved ? `最終保存: ${lastSaved}` : '';
  }
  updateLastSaved();

  saveBtn.addEventListener('click', function() {
    const json = textarea.value;
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AMU_BoothItem.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // 保存日時を記録
    const now = new Date();
    const dateStr = now.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    localStorage.setItem('bpm_save_datetime', dateStr);
    updateLastSaved();
  });
  // 保存日時があれば表示
  const lastSavedTime = localStorage.getItem('bpm_save_datetime');
  if (lastSavedTime) {
    status.textContent = `前回保存: ${lastSavedTime}`;
  }
});
