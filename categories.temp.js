(async function() {
  // Check for initialization
  if (window.categoriesInitialized) {
    return;
  }
  window.categoriesInitialized = true;

  // Main initialization code
  async function initCategories() {
    try {
      const categoriesGrid = document.querySelector('.categories-grid');
      if (!categoriesGrid) return;

      // Initialize categories display
      await renderCategoryList(fixedCategories);
      
      // Load initial products
      await renderProductGrid();
    } catch (error) {
      console.error('[categories] Initialization error:', error);
    }
  }

  // Start initialization
  await initCategories();
})();