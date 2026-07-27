(function() {
  // Prevent multiple injections
  if (window.ugScannerInjected) return;
  window.ugScannerInjected = true;

  // Inject CSS for highlights and tooltips
  const style = document.createElement('style');
  style.textContent = `
    .ug-page-highlight {
      background-color: #ffc107 !important;
      color: #000 !important;
      border-radius: 3px;
      border: 1px dashed #dc3545;
      padding: 0 2px;
      cursor: help;
      position: relative;
    }
    .ug-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #212529;
      color: #fff;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: sans-serif;
      white-space: nowrap;
      z-index: 999999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .ug-page-highlight:hover .ug-tooltip {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // Define target Unicode range (BiDi, formatting, zero-width)
  const isHiddenChar = (char) => {
    const cp = char.codePointAt(0);
    return (cp >= 0x2000 && cp <= 0x206F) || cp === 0x00A0 || cp === 0xFEFF;
  };

  const toHex = (num) => 'U+' + num.toString(16).toUpperCase().padStart(4, '0');

  // Traverse DOM Text Nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodesToProcess = [];

  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) continue;
    if (node.nodeValue.match(/[\u2000-\u206F\u00A0\uFEFF]/)) {
      nodesToProcess.push(node);
    }
  }

  // Replace and highlight
  nodesToProcess.forEach(textNode => {
    const chars = Array.from(textNode.nodeValue);
    const fragment = document.createDocumentFragment();
    let currentText = '';

    chars.forEach(char => {
      if (isHiddenChar(char)) {
        if (currentText) {
          fragment.appendChild(document.createTextNode(currentText));
          currentText = '';
        }
        
        const cp = toHex(char.codePointAt(0));
        const dbEntry = (window.UNICODE_DB && window.UNICODE_DB[cp]) 
            ? window.UNICODE_DB[cp] 
            : { abbr: 'HIDDEN', name: `Unknown (${cp})` };

        const span = document.createElement('span');
        span.className = 'ug-page-highlight';
        span.textContent = `[${dbEntry.abbr}]`;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'ug-tooltip';
        tooltip.textContent = `${dbEntry.name} (${cp})`;
        span.appendChild(tooltip);

        fragment.appendChild(span);
      } else {
        currentText += char;
      }
    });

    if (currentText) {
      fragment.appendChild(document.createTextNode(currentText));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  });
})();
