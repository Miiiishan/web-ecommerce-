async function registerUser() {
    try {
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        alert(data.message);

    } catch (error) {
        console.log(error);
        alert("Error connecting to server");
    }
}


// =======================
// LOGIN
// =======================
async function loginUser() {
    try {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        alert(data.message);

        if (data.message === "Login successful") {
            window.location.href = "/";
        }

    } catch (err) {
        console.log(err);
        alert("Login failed");
    }
}


// =======================
// CHECK LOGIN STATUS (NAVBAR)
// =======================
async function loginUser() {

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    const res = await fetch('/login', {
        method: 'POST',

        credentials: 'include',

        headers: {
            'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
            email,
            password
        })
    });

    const data = await res.json();

    alert(data.message);

    if (
        data.message ===
        "Login successful"
    ) {
        window.location.href = "/";
    }
}

// =======================
// LOGOUT
// =======================
async function logout() {
    await fetch('/logout', { credentials: 'include' });
    location.reload();
}


// =======================
// BLOCK LOGIN PAGE IF ALREADY LOGGED IN
// =======================
async function checkIfAlreadyLoggedIn() {
    try {
        const res = await fetch('/me', {
            credentials: 'include'
        });

        const data = await res.json();

        if (data.loggedIn) {
            window.location.href = "/";
        }

    } catch (err) {
        console.log(err);
    }
}

async function loadOrders() {

    const res = await fetch('/orders', {
        credentials: 'include'
    });

    const orders = await res.json();

    const container = document.getElementById("orderHistory");

    if (!orders || orders.length === 0) {
        container.innerHTML = "<p class='empty'>No purchases yet.</p>";
        return;
    }

    container.innerHTML = orders.map(order => {

        let itemsHTML = "";

        if (order.items && order.items.length > 0) {
            itemsHTML = order.items.map(i => `
                <li>${i.name} x${i.quantity} - ₱${i.price}</li>
            `).join("");
        }

        return `
            <div class="cart-item">
                <h4>Order #${order.id}</h4>
                <p>Total: ₱${order.total}</p>
                <p>Status: ${order.status || "pending"}</p>
                <p>Date: ${order.created_at}</p>

                <ul>${itemsHTML}</ul>
            </div>
        `;
    }).join("");
}

// =======================
// AUTO RUN (IMPORTANT)
// =======================

// Only run login check if navbar exists (homepage)
document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
    checkIfAlreadyLoggedIn();
});

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
});