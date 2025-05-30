// popupからcontent scriptにメッセージを送り、ダウンロードリンクを取得
function getLinksFromContentScript(callback, errorCallback) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      errorCallback('タブ情報が取得できません');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_DOWNLOAD_LINKS'}, function(response) {
      if (chrome.runtime.lastError) {
        errorCallback('このページではダウンロードリンクを抽出できません。\nBOOTHの商品ページで実行してください。');
        return;
      }
      callback(response && response.links ? response.links : []);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const textarea = document.getElementById('links');
  const copyBtn = document.getElementById('copy');
  const status = document.getElementById('status');
  const saveBtn = document.getElementById('save');

  getLinksFromContentScript(function(links) {
    // JSON形式で整形して表示
    textarea.value = JSON.stringify(links, null, 2);
  }, function(errorMsg) {
    textarea.value = '';
    status.textContent = errorMsg;
    copyBtn.disabled = true;
  });

  copyBtn.addEventListener('click', function() {
    textarea.select();
    document.execCommand('copy');
    status.textContent = 'コピーしました！';
    setTimeout(() => status.textContent = '', 1500);
  });

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
    status.textContent = '保存しました！';
    setTimeout(() => status.textContent = '', 1500);
  });
});
