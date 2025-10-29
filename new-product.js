(function(){
  'use strict';
  const placeholder = 'https://placehold.co/600x600?text=Image+not+available';
  const imgEl = document.getElementById('npImage');
  const titleEl = document.getElementById('npTitle');
  const descEl = document.getElementById('npDescription');
  const shareInput = document.getElementById('npShareInput');
  const copyBtn = document.getElementById('npCopyBtn');
  const nativeBtn = document.getElementById('npNativeShare');
  const imageUrlInput = document.getElementById('npImageUrl');
  const loadImageBtn = document.getElementById('npLoadImageBtn');
  const imageLinkEl = document.getElementById('npImageLink');

  function buildShareUrl(imageUrl){
    const base = window.location.origin + window.location.pathname;
    if (!imageUrl) return base + '?utm_source=newproduct&utm_campaign=20percent';
    return base + '?image_url=' + encodeURIComponent(imageUrl) + '&utm_source=newproduct&utm_campaign=20percent';
  }

  async function setImageFromCandidate(candidate){
    // Normalize and try several likely keys. Returns the URL actually used.
    const finalCandidate = (candidate || '').toString().trim();
    if (!imgEl) return finalCandidate || placeholder;
    let final = finalCandidate || '';
    // try to normalize relative URLs to absolute and sanitize common issues
    if (final) {
      try {
        // If missing a scheme but looks like a host/path, add https://
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(final) && (final.indexOf('.') !== -1 || final[0] === '/')) {
          final = (final.startsWith('http') ? final : ('https://' + final.replace(/^\/*/, '')));
        }
        // Create a URL to canonicalize; if it fails we'll fallback to encoder below
        final = new URL(final, window.location.href).href;
      } catch(e) {
        try {
          // Try to at least encode unsafe characters (spaces etc.)
          final = encodeURI(final.replace(/\s+/g, '+'));
        } catch (e2) {
          /* leave as-is */
        }
      }
      // strip stray trailing colon-number artifacts like ":1" which sometimes get appended
      final = final.replace(/:\d+$/,'');
    }
    if (!final) final = placeholder;
    return new Promise(resolve => {
      const tester = new Image();
      let tried = 0;
      function attemptLoad(url) {
        tried++;
        console.debug('new-product: attempting image load', {attempt: tried, url});
        tester.onload = function(){ try { imgEl.src = tester.src; imgEl.alt = titleEl ? (titleEl.textContent || 'Product image') : 'Product image'; } catch(e){} resolve(tester.src); };
        tester.onerror = function(){
          console.debug('new-product: failed to load image', {attempt: tried, url});
          if (tried === 1) {
            // first fallback: try replacing spaces with +
            try { attemptLoad(url.replace(/\s+/g, '+')); return; } catch(e){}
          }
          if (tried === 2) {
            // second fallback: try encodeURI
            try { attemptLoad(encodeURI(final)); return; } catch(e){}
          }
          // give up, use placeholder
          try { imgEl.src = placeholder; imgEl.alt = 'Image not available'; } catch(e){}
          resolve(placeholder);
        };
        try { tester.src = url; } catch(e) { console.debug('new-product: image assignment threw', e); if (tried >= 3) { try { imgEl.src = placeholder; } catch(e2){} resolve(placeholder); } }
      }
      try { attemptLoad(final); } catch(e) { console.debug('new-product: image load setup failed', e); try { imgEl.src = placeholder; } catch(e){} resolve(placeholder); }
    });
  }

  async function init(){
    try {
  const params = new URLSearchParams(window.location.search);
  // accept multiple param names
  const paramImg = params.get('image_url') || params.get('image') || params.get('img') || params.get('url');
  const paramName = params.get('name') || params.get('title');
  const paramDesc = params.get('desc') || params.get('description');

  const stored = sessionStorage.getItem('selectedProductImageUrl') || sessionStorage.getItem('selectedProductImage') || sessionStorage.getItem('selectedProductImageUrl');
  const storedName = sessionStorage.getItem('selectedProductName') || sessionStorage.getItem('selectedProductTitle');
  const candidate = paramImg || stored || '';
  // set title/description from params or sessionStorage if present
  try { if (titleEl && (paramName || storedName)) titleEl.textContent = paramName || storedName; } catch(e){}
  try { if (descEl && paramDesc) descEl.textContent = paramDesc; } catch(e){}

  console.debug('new-product init', { paramImg, stored, paramName, paramDesc });

  const used = await setImageFromCandidate(candidate);
  let currentImage = (used && used !== placeholder) ? used : '';
  const shareUrl = buildShareUrl(currentImage);
  if (shareInput) shareInput.value = shareUrl;
  // show clickable image url if available
  try { if (imageLinkEl) { if (currentImage) { imageLinkEl.href = currentImage; imageLinkEl.textContent = currentImage; } else { imageLinkEl.href = '#'; imageLinkEl.textContent = 'Image URL'; } } } catch(e){}
  // prefill the image URL input so the user can see/change it
  try { if (imageUrlInput) imageUrlInput.value = currentImage || ''; } catch(e){}
  // make the preview image clickable to open the actual image in a new tab (if available)
  try {
    if (imgEl) {
      imgEl.style.cursor = 'pointer';
      imgEl.addEventListener('click', function(){ if (currentImage) { window.open(currentImage, '_blank', 'noopener'); } });
    }
  } catch(e){}

      // copy handler — compute share URL at click time so it always matches the active image
      if (copyBtn) copyBtn.addEventListener('click', async function(){
        const shareNow = buildShareUrl(currentImage);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareNow);
            copyBtn.textContent = 'Copied';
            setTimeout(()=> copyBtn.textContent = 'Copy Link', 1400);
          } else {
            throw new Error('clipboard-not-available');
          }
        } catch(e){
          // fallback: show alert with link
          try { alert('Copy this link: ' + shareNow); } catch(e2){}
        }
        if (shareInput) shareInput.value = shareNow;
      });

      // native share — include the currently selected image URL in the shared text and url
      if (nativeBtn) nativeBtn.addEventListener('click', async function(){
        const shareNow = buildShareUrl(currentImage);
        const shareText = currentImage ? ('Check out this product image: ' + currentImage + ' — get 20% off') : 'Share this link to get 20% off';
        if (navigator.share) {
          try { await navigator.share({ title: document.title, text: shareText, url: shareNow }); } catch(e){}
        } else {
          try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(shareNow); alert('Link copied to clipboard'); } else { throw new Error('clipboard-not-available'); } } catch(e){ alert('Copy this link: ' + shareNow); }
        }
        if (shareInput) shareInput.value = shareNow;
      });

      // wire input/button to allow entering any image URL
      if (loadImageBtn && imageUrlInput) {
        const applyUrl = async function(url) {
          if (!url) return;
          try {
            // save to sessionStorage for redirect/persistence
            sessionStorage.setItem('selectedProductImageUrl', url);
          } catch(e){}
          const usedNow = await setImageFromCandidate(url);
          currentImage = (usedNow && usedNow !== placeholder) ? usedNow : '';
          const newShare = buildShareUrl(currentImage);
          if (shareInput) shareInput.value = newShare;
            try { if (imageLinkEl) { imageLinkEl.href = currentImage || '#'; imageLinkEl.textContent = currentImage || 'Image URL'; } } catch(e){}
            try { if (imageUrlInput) imageUrlInput.value = currentImage || url || ''; } catch(e){}
        };

        loadImageBtn.addEventListener('click', function(e){ e.preventDefault(); const v = (imageUrlInput.value || '').trim(); if (v) applyUrl(v); });
        // also support pressing Enter in the input
        imageUrlInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); const v = (imageUrlInput.value || '').trim(); if (v) applyUrl(v); } });
      }

    } catch (e) { console.warn('new-product error', e); }
  }

  // run init
  init();

})();
