// Update cart badge count from localStorage
function updateCartBadge() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = cartItems.length;
    }
}

// Update notification badge count from localStorage
function updateNotificationBadge() {
    const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = notifications.filter(n => !n.read).length;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    updateNotificationBadge();
    
    // Add hover effects for brand cards if needed
    const brandCards = document.querySelectorAll('.brand-card');
    brandCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
});
