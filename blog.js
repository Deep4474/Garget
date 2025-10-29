// Blog page functionality
document.addEventListener('DOMContentLoaded', function() {
  // Handle read more clicks
  document.querySelectorAll('.read-more').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      // TODO: Implement full blog post view
      const article = this.closest('.blog-card');
      const title = article.querySelector('.blog-title').textContent;
      alert('Full article for "' + title + '" coming soon!');
    });
  });

  // Add lazy loading to images
  document.querySelectorAll('.blog-image img').forEach(img => {
    img.loading = 'lazy';
  });
});
