document.addEventListener('DOMContentLoaded', () => {
    const categoryCards = document.querySelectorAll('.category-card');

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            switch(category) {
                case 'phones':
                    window.location.href = 'phone.html';
                    break;
                case 'laptops':
                    window.location.href = 'laptop.html';
                    break;
                case 'tablets':
                    window.location.href = 'tablet.html';
                    break;
                case 'accessories':
                    window.location.href = 'accessories.html';
                    break;
                case 'tvs':
                    window.location.href = 'tv.html';
                    break;
            }
        });
    });
});