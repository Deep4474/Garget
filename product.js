// product.js
// Helpers to extract a usable product image URL from diverse product shapes
// and render it into the DOM. Designed to be small and dependency-free.

(function(window){
  'use strict';

  // Normalize a single candidate value into a plain URL string or null
  function normalizeImageCandidate(u){
    try{
      if (!u && u !== 0) return null;
      // arrays: prefer first element
      if (Array.isArray(u)) u = u[0];
      // objects: pick common fields
      if (typeof u === 'object' && u !== null){
        if (u.url) u = u.url;
        else if (u.src) u = u.src;
        else if (u.image) u = u.image;
        else if (u.path) u = u.path;
        else {
          const vals = Object.values(u);
          u = vals.length ? vals[0] : '';
        }
      }
      if (typeof u !== 'string') u = String(u || '');
      let s = u.trim();
      if (!s) return null;

      // If looks like JSON array/object string, try to parse and extract first url-like
      if (s[0] === '[' || s[0] === '{'){
        try{
          const j = JSON.parse(s);
          if (Array.isArray(j) && j.length) return normalizeImageCandidate(j[0]);
          if (typeof j === 'object' && j !== null) return normalizeImageCandidate(j.url || j.src || j.image || Object.values(j)[0]);
        }catch(e){ /* ignore */ }
      }

      // handle srcset / comma-separated lists: take first url token
      if (s.indexOf(',') > -1){
        const parts = s.split(',');
        if (parts.length) s = parts[0].trim().split(' ')[0].trim();
      }

      // unwrap url("...") wrappers
      const urlMatch = s.match(/^\s*url\((?:['"]?)(.+?)(?:['"]?)\)\s*$/i);
      if (urlMatch && urlMatch[1]) s = urlMatch[1];

      // strip surrounding quotes
      s = s.replace(/^['"]|['"]$/g, '');
      // replace backslashes with forward slashes
      s = s.replace(/\\+/g, '/');
      // protocol-relative
      if (s.indexOf('//') === 0) s = window.location.protocol + s;

      s = s.trim();
      if (!s) return null;

      // Leave relative paths as-is; caller may resolve via new URL(s, base)
      return s;
    }catch(e){ return null; }
  }

  // Attempt to extract an image URL from a product-like object
  function extractProductImage(product){
    if (!product || typeof product !== 'object') return null;
    const tryKeys = [
      'image_url','image','images','image_urls','photos','photo','img','thumbnail','thumb','data_image','data-src','imageUrl'
    ];

    for (const k of tryKeys){
      if (Object.prototype.hasOwnProperty.call(product, k)){
        const cand = product[k];
        const url = normalizeImageCandidate(cand);
        if (url) return url;
      }
    }

    // If there are other keys, scan for any key name containing 'image' or 'img'
    for (const key of Object.keys(product)){
      if (/image|img/i.test(key)){
        const url = normalizeImageCandidate(product[key]);
        if (url) return url;
      }
    }

    // fallback: try top-level values that may contain a URL
    for (const key of Object.keys(product)){
      const val = product[key];
      if (typeof val === 'string' && /https?:\/\//i.test(val)) return normalizeImageCandidate(val);
    }

    return null;
  }

  // Resolve a possibly relative URL to absolute using document.baseURI
  function resolveAbsolute(url){
    try{
      if (!url) return url;
      if (/^(https?:|data:|\/\/) /i.test(url)) return url; // note: intentionally permissive
      // If url starts with '/', new URL handles root-relative
      return new URL(url, document.baseURI).href;
    }catch(e){ return url; }
  }

  // Render product image into a container element. Options: {link:true, size:80, altField:'name'}
  function renderProductImage(product, container, options){
    if (!container) return null;
    const opt = Object.assign({ link: true, size: 80, altField: 'name' }, options || {});
    const imgUrl = extractProductImage(product) || null;
    let src = imgUrl ? resolveAbsolute(imgUrl) : null;

    // fallback placeholder
    if (!src) src = 'https://placehold.co/' + (opt.size||80) + 'x' + (opt.size||80);

    // build image element
    const img = document.createElement('img');
    img.src = src;
    img.alt = (product && product[opt.altField]) ? String(product[opt.altField]) : 'Product image';
    img.width = opt.size; img.height = opt.size;
    img.className = 'product-image';
    img.addEventListener('error', function(){ this.onerror = null; this.src = 'https://placehold.co/' + (opt.size||80) + 'x' + (opt.size||80); });

    // clear container and append
    container.innerHTML = '';

    if (opt.link && imgUrl){
      const a = document.createElement('a');
      a.href = resolveAbsolute(imgUrl);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(img);
      container.appendChild(a);

      // additionally add a small visible link to the raw URL
      const urlNode = document.createElement('div');
      urlNode.className = 'product-image-url';
      urlNode.style.fontSize = '12px';
      urlNode.style.marginTop = '6px';
      const short = imgUrl.length > 80 ? (imgUrl.slice(0,80) + '…') : imgUrl;
      const link = document.createElement('a');
      link.href = resolveAbsolute(imgUrl);
      link.textContent = short;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      urlNode.appendChild(link);
      container.appendChild(urlNode);
    } else {
      container.appendChild(img);
    }

    return { imgElement: img, src: src };
  }

  // Auto-init: find elements with data-product attribute (JSON) or data-product-id and data-image
  function autoInit(){
    try{
      const nodes = document.querySelectorAll('[data-product]');
      nodes.forEach(n => {
        try{
          const json = n.getAttribute('data-product');
          if (!json) return;
          const prod = JSON.parse(json);
          renderProductImage(prod, n, { link: true, size: 120 });
        }catch(e){}
      });

      // fallback: elements with data-image attribute
      const imgNodes = document.querySelectorAll('[data-image]');
      imgNodes.forEach(n => {
        try{
          const raw = n.getAttribute('data-image');
          if (!raw) return;
          const product = { image: raw };
          renderProductImage(product, n, { link: true, size: 120 });
        }catch(e){}
      });
    }catch(e){}
  }

  // Export
  window.productHelpers = window.productHelpers || {};
  window.productHelpers.normalizeImageCandidate = normalizeImageCandidate;
  window.productHelpers.extractProductImage = extractProductImage;
  window.productHelpers.renderProductImage = renderProductImage;
  window.productHelpers.resolveAbsolute = resolveAbsolute;

  // auto-run on DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit); else autoInit();

})(window);
