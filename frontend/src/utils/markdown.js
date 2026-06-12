import { marked } from 'marked';
import hljs from 'highlight.js';

// Define global copy function
if (typeof window !== 'undefined') {
  window.__copyCode = function (btn) {
    const wrapper = btn.closest('.code-wrapper');
    if (!wrapper) return;
    const codeBlock = wrapper.querySelector('code');
    if (!codeBlock) return;

    const text = codeBlock.innerText || codeBlock.textContent;

    navigator.clipboard.writeText(text).then(() => {
      // Store original content if not already stored
      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }

      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      btn.classList.add('copied');

      setTimeout(() => {
        btn.innerHTML = btn.dataset.originalHtml;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };
}

const renderer = {
  code({ text, lang }) {
    if (lang === 'mermaid') {
      return `<div class="mermaid">${text}</div>`;
    }
    const language = lang || 'plaintext';
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(text, { language: validLanguage }).value;

    return `
      <div class="code-wrapper">
        <div class="code-header">
          <span class="code-lang">${validLanguage}</span>
          <button class="copy-btn" onclick="window.__copyCode(this)" title="Copy code">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
      </div>
    `;
  },

  image({ href, title, text }) {
    // Check if it's a base64 string or url
    const isBase64 = href.startsWith('data:');

    // Clean up title
    const titleAttr = title ? `title="${title}"` : '';

    return `
      <div class="image-wrapper">
        <img 
          src="${href}" 
          alt="${text}" 
          ${titleAttr}
          class="markdown-image" 
          loading="lazy"
          onclick="window.__previewImage && window.__previewImage('${href}')"
        />
        ${title ? `<span class="image-caption">${title}</span>` : ''}
      </div>
    `;
  },

  link({ href, title, text }) {
    const titleAttr = title ? `title="${title}"` : '';
    return `<a href="${href}" ${titleAttr} target="_blank" rel="noopener noreferrer" class="markdown-link">${text}</a>`;
  }
};

marked.use({
  renderer,
  breaks: true,
  gfm: true
});

export { marked };
