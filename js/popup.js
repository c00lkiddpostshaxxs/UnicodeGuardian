document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('ug-theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('ug-theme', next);
  });

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      document.getElementById(e.target.dataset.target).classList.add('active');
    });
  });

  // Scanner Logic
  const textInput = document.getElementById('text-input');
  const resultsDiv = document.getElementById('results');
  let currentReport = null;

  function runScan() {
    const text = textInput.value;
    if (!text) {
      resultsDiv.classList.add('hidden');
      return;
    }
    
    currentReport = UnicodeScanner.analyze(text);
    updateUI(currentReport, text);
    resultsDiv.classList.remove('hidden');
  }

  function updateUI(report, rawText) {
    document.getElementById('risk-badge').textContent = report.riskLevel;
    document.getElementById('risk-reason').textContent = report.riskReason;
    document.getElementById('stat-total').textContent = report.total;
    document.getElementById('stat-visible').textContent = report.visible;
    document.getElementById('stat-hidden').textContent = report.hidden;

    const style = document.querySelector('input[name="reveal-style"]:checked').value;
    const revealedDiv = document.getElementById('revealed-output');
    revealedDiv.innerHTML = UnicodeScanner.revealFormatting(rawText, style);

    // Bind modal clicks
    revealedDiv.querySelectorAll('.ug-badge').forEach(badge => {
      badge.addEventListener('click', () => openModal(badge.dataset.cp));
    });

    const tbody = document.getElementById('char-tbody');
    tbody.innerHTML = '';
    
    report.breakdown.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.isHidden ? `<span class="ug-badge" data-cp="${item.codePoint}">${item.abbr}</span>` : item.char}</td>
        <td>${item.name}</td>
        <td>${item.codePoint}</td>
        <td>${item.utf8}</td>
        <td>${item.utf16}</td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.ug-badge').forEach(badge => {
      badge.addEventListener('click', () => openModal(badge.dataset.cp));
    });
  }

  textInput.addEventListener('input', runScan);
  
  // Drag & Drop Support
  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    const text = e.dataTransfer.getData('text');
    if (text) {
      textInput.value = text;
      runScan();
    }
  });

  // Reveal Style Toggle
  document.querySelectorAll('input[name="reveal-style"]').forEach(radio => {
    radio.addEventListener('change', runScan);
  });

  // Exports
  document.getElementById('export-json').addEventListener('click', () => {
    if(!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: 'unicode-report.json' });
  });

  document.getElementById('export-txt').addEventListener('click', () => {
    if(!currentReport) return;
    let txt = `Unicode Guardian Report\nRisk: ${currentReport.riskLevel}\n\nBreakdown:\n`;
    currentReport.breakdown.forEach(c => {
      txt += `[${c.codePoint}] ${c.name} - UTF8:${c.utf8}\n`;
    });
    const blob = new Blob([txt], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: 'unicode-report.txt' });
  });

  document.getElementById('copy-report').addEventListener('click', () => {
    if(!currentReport) return;
    navigator.clipboard.writeText(JSON.stringify(currentReport, null, 2));
    alert('Copied to clipboard!');
  });

  // Library Population
  const libContainer = document.getElementById('library-list');
  function renderLibrary(filter = '') {
    libContainer.innerHTML = '';
    Object.values(UNICODE_DB).forEach(char => {
      const searchStr = `${char.name} ${char.abbr}${char.category}`.toLowerCase();
      if (filter && !searchStr.includes(filter.toLowerCase())) return;

      const div = document.createElement('div');
      div.className = 'lib-item';
      div.innerHTML = `<strong>${char.abbr}</strong> - ${char.name} <span class="text-sm italic">(${char.category})</span>`;
      div.addEventListener('click', () => openModal(Object.keys(UNICODE_DB).find(k => UNICODE_DB[k] === char)));
      libContainer.appendChild(div);
    });
  }
  renderLibrary();
  
  document.getElementById('library-search').addEventListener('input', (e) => {
    renderLibrary(e.target.value);
  });

  // Modal Handling
  const modal = document.getElementById('inspector-modal');
  document.getElementById('close-modal').addEventListener('click', () => modal.close());
  
  function openModal(codePoint) {
    const data = UNICODE_DB[codePoint];
    if (!data) return;
    document.getElementById('modal-title').textContent = data.name;
    document.getElementById('modal-abbr').textContent = data.abbr;
    document.getElementById('modal-cp').textContent = codePoint;
    document.getElementById('modal-cat').textContent = data.category;
    document.getElementById('modal-risk').textContent = data.risk;
    document.getElementById('modal-desc').textContent = data.desc;
    document.getElementById('modal-security').innerHTML = `<strong>Legitimate use:</strong> ${data.use}<br><strong>Misuse:</strong>${data.misuse}`;
    document.getElementById('modal-demo-normal').textContent = data.demoNormal;
    document.getElementById('modal-demo-mod').textContent = data.demoMod;
    document.getElementById('modal-demo-exp').textContent = data.exp;
    modal.showModal();
  }

  // Page Scanner Trigger
  document.getElementById('scan-page-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const status = document.getElementById('page-scan-status');
    status.textContent = "Scanning...";
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['js/unicode-data.js', 'js/content.js']
    }, () => {
      status.textContent = "Scan complete! Check the webpage for highlights.";
    });
  });
});
