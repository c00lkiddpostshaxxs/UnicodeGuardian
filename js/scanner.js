class UnicodeScanner {
  static toHex(num, padding) {
    return num.toString(16).toUpperCase().padStart(padding, '0');
  }

  static getUTF8Bytes(char) {
    const bytes = new TextEncoder().encode(char);
    return Array.from(bytes).map(b => '0x' + this.toHex(b, 2)).join(' ');
  }

  static getUTF16(char) {
    let res = [];
    for (let i = 0; i < char.length; i++) {
      res.push('0x' + this.toHex(char.charCodeAt(i), 4));
    }
    return res.join(' ');
  }

  static getCodePointInfo(char) {
    const cp = char.codePointAt(0);
    const hexCP = 'U+' + this.toHex(cp, 4);
    
    if (UNICODE_DB[hexCP]) {
      return { ...UNICODE_DB[hexCP], codePoint: hexCP, isHidden: true };
    }
    
    const isControlOrInvisible = (cp >= 0x2000 && cp <= 0x206F) || cp === 0x00A0 || cp === 0xFEFF;
    return {
      char: char,
      name: `Char ${hexCP}`,
      abbr: char,
      codePoint: hexCP,
      category: isControlOrInvisible ? "Formatting/Invisible" : "Standard",
      isHidden: isControlOrInvisible
    };
  }

  static analyze(text) {
    const chars = Array.from(text);
    const report = {
      total: chars.length,
      visible: 0,
      hidden: 0,
      breakdown: [],
      riskLevel: "🟢 Safe",
      riskReason: "No invisible or BiDi characters detected."
    };

    let hasLow = false, hasMedium = false, hasHigh = false;

    chars.forEach(char => {
      const info = this.getCodePointInfo(char);
      
      const entry = {
        char: char,
        name: info.name,
        abbr: info.abbr,
        codePoint: info.codePoint,
        utf8: this.getUTF8Bytes(char),
        utf16: this.getUTF16(char),
        isHidden: info.isHidden,
        dbRef: UNICODE_DB[info.codePoint] || null
      };

      if (info.isHidden) {
        report.hidden++;
        if (info.risk && info.risk.includes("High")) hasHigh = true;
        else if (info.risk && info.risk.includes("Medium")) hasMedium = true;
        else hasLow = true;
      } else {
        report.visible++;
      }

      report.breakdown.push(entry);
    });

    if (hasHigh) {
      report.riskLevel = "🔴 High risk";
      report.riskReason = "Contains BiDi Overrides (e.g., RLO/LRO) which can spoof file extensions or URLs.";
    } else if (hasMedium) {
      report.riskLevel = "🟠 Medium risk";
      report.riskReason = "Contains BiDi controls which alter reading order but don't force strict overrides.";
    } else if (hasLow) {
      report.riskLevel = "🟡 Low risk";
      report.riskReason = "Contains invisible formatting characters (e.g., zero-width spaces).";
    }

    return report;
  }

  static revealFormatting(text, style) {
    let result = '';
    const chars = Array.from(text);
    
    chars.forEach(char => {
      const info = this.getCodePointInfo(char);
      if (info.isHidden && info.abbr !== char) {
        if (style === 'bracket') result += `<span class="ug-badge" data-cp="${info.codePoint}">[${info.abbr}]</span>`;
        else result += `<span class="ug-badge" data-cp="${info.codePoint}">⟦${info.abbr}⟧</span>`;
      } else {
        // Escape HTML
        const div = document.createElement('div');
        div.innerText = char;
        result += div.innerHTML;
      }
    });
    return result;
  }
}
