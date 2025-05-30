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
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isLibrary = tabs[0] && /^https:\/\/accounts\.booth\.pm\/library/.test(tabs[0].url);
    if (!isLibrary) {
      saveBtn.parentNode.insertBefore(openLibraryBtn, saveBtn);
      textarea.style.display = 'none';
      saveBtn.style.display = 'none';
      status.style.display = 'none';
    } else {
      textarea.style.display = '';
      saveBtn.style.display = '';
      status.style.display = '';
    }
  });
  openLibraryBtn.addEventListener('click', function() {
    chrome.tabs.create({url: 'https://accounts.booth.pm/library'});
  });

  getLinksFromContentScript(function(links) {
    if (!Array.isArray(links) || links.length === 0) {
      textarea.value = '';
      status.textContent = '商品情報が取得できませんでした。ページを再読み込みしてください。';
      saveBtn.disabled = true;
      textarea.style.display = 'none';
      saveBtn.style.display = 'none';
      return;
    }
    textarea.value = JSON.stringify(links, null, 2);
    status.textContent = '';
    saveBtn.disabled = false;
    textarea.style.display = '';
    saveBtn.style.display = '';
  }, function(errorMsg) {
    textarea.value = '';
    status.textContent = 'ページを再読み込みしてください。';
    saveBtn.disabled = true;
    textarea.style.display = 'none';
    saveBtn.style.display = 'none';
  });

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
    a.download = 'BPMlibrary.json';
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
