document.addEventListener('DOMContentLoaded', function() {
    const ordersList = document.getElementById('adminOrdersList');
    const refreshBtn = document.getElementById('refreshOrders');

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '30px';
        notification.style.right = '30px';
        notification.style.background = '#fff';
        notification.style.border = '1.5px solid #2563eb';
        notification.style.color = '#222';
        notification.style.padding = '1rem 2rem';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        notification.style.zIndex = 9999;
        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), 3000);
    }

    function renderOrders(orders) {
        if (!orders.length) {
            ordersList.innerHTML = '<p>No orders found.</p>';
            return;
        }
        ordersList.innerHTML = orders.map(order => `
            <div class="admin-order">
                <div><b>Order ID:</b> ${order.id}</div>
                <div><b>User:</b> ${order.user}</div>
                <div><b>Method:</b> ${order.method}</div>
                <div><b>Address:</b> ${order.address || '-'}</div>
                <div><b>Status:</b> <span class="order-status">${order.status}</span></div>
                <div><b>Created:</b> ${new Date(order.createdAt).toLocaleString()}</div>
                <div><b>Cart:</b> ${order.cart.map(item => `${item.name} x${item.quantity}`).join(', ')}</div>
                ${order.adminMessage ? `<div><b>Admin Message:</b> <span style='color:#2563eb'>${order.adminMessage}</span></div>` : ''}
                <div class="order-actions">
                    ${order.status === 'pending' ? `
                    <button class="btn btn-success" data-action="confirm" data-id="${order.id}">Confirm</button>
                    <button class="btn btn-danger" data-action="reject" data-id="${order.id}">Reject</button>
                    ` : `<span class="order-status">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>`}
                </div>
            </div>
        `).join('');
        // Add event listeners for confirm/reject
        ordersList.querySelectorAll('.order-actions button').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const action = this.dataset.action;
                const message = prompt(`Enter a message to send to the user for this ${action}:`, '');
                fetch(`http://localhost:5000/api/admin/orders/${id}/${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                })
                    .then(res => res.json())
                    .then(resp => {
                        showNotification(resp.message, resp.success ? 'success' : 'error');
                        loadOrders();
                    });
            });
        });
    }

    function loadOrders() {
        ordersList.innerHTML = 'Loading orders...';
        fetch('http://localhost:5000/api/admin/orders')
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    ordersList.innerHTML = '<p>Failed to load orders.</p>';
                    return;
                }
                renderOrders(data.orders);
            });
    }

    refreshBtn.addEventListener('click', loadOrders);
    loadOrders();
}); 