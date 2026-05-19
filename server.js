console.log("🔥 SERVER STARTED");

const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = 3000;

// =====================
// MIDDLEWARE
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "fbc_secret_key",
    resave: false,
    saveUninitialized: false,

    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true
    }
}));

// =====================
// FRONTEND
// =====================
app.use(express.static(
    path.join(__dirname, 'frontend')
));

// =====================
// DATABASE
// =====================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fbc_marketplace'
});

db.connect(err => {
    if (err) {
        console.log("❌ DB CONNECTION FAILED");
        console.log(err);
    } else {
        console.log("✅ Connected to MySQL");
    }
});

// =====================
// ADMIN MIDDLEWARE
// =====================
function requireAdmin(req, res, next) {

    if (!req.session.userId) {
        return res.redirect('/');
    }

    db.query(
        "SELECT is_admin FROM users WHERE id = ?",
        [req.session.userId],
        (err, results) => {

            if (err || results.length === 0) {
                return res.redirect('/');
            }

            if (results[0].is_admin !== 1) {
                return res.redirect('/');
            }

            next();
        }
    );
}

// =====================
// LOGIN STATUS
// =====================
app.get('/me', (req, res) => {

    if (!req.session.userId) {
        return res.json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        id: req.session.userId,
        name: req.session.userName
    });
});

// =====================
// ADMIN STATS
// =====================
app.get('/admin/stats',
requireAdmin,
(req, res) => {

    const stats = {};

    db.query(
        "SELECT COUNT(*) AS total FROM users",
        (err, usersResult) => {

            stats.users =
                usersResult[0].total;

            db.query(
                "SELECT COUNT(*) AS total FROM products",
                (err, productsResult) => {

                    stats.products =
                        productsResult[0].total;

                    db.query(
                        "SELECT COUNT(*) AS total FROM orders",
                        (err, ordersResult) => {

                            stats.orders =
                                ordersResult[0].total;

                            db.query(
                                "SELECT SUM(total) AS revenue FROM orders",
                                (err, revenueResult) => {

                                    stats.revenue =
                                        revenueResult[0]
                                        .revenue || 0;

                                    res.json(stats);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// =====================
// REGISTER
// =====================
app.post('/register',
async (req, res) => {

    const {
        name,
        email,
        password
    } = req.body;

    try {

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        db.query(
            `
            INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)
            `,
            [
                name,
                email,
                hashedPassword
            ],
            (err) => {

                if (err) {
                    return res.json({
                        message:
                        "Register error"
                    });
                }

                res.json({
                    message:
                    "User registered"
                });
            }
        );

    } catch {
        res.json({
            message:
            "Server error"
        });
    }
});

// =====================
// LOGIN
// =====================
app.post('/login',
(req, res) => {

    const {
        email,
        password
    } = req.body;

    db.query(
        `
        SELECT *
        FROM users
        WHERE email = ?
        `,
        [email],

        async (err, results) => {

            if (
                err ||
                results.length === 0
            ) {
                return res.json({
                    message:
                    "User not found"
                });
            }

            const user =
                results[0];

            const match =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!match) {
                return res.json({
                    message:
                    "Wrong password"
                });
            }

            req.session.userId =
                user.id;

            req.session.userName =
                user.name;

            res.json({
                message:
                "Login successful"
            });
        }
    );
});

// =====================
// LOGOUT
// =====================
app.post('/logout',
(req, res) => {

    req.session.destroy(() => {

        res.json({
            message:
            "Logged out"
        });
    });
});

// =====================
// ADMIN PRODUCTS
// =====================

// GET ALL PRODUCTS
app.get('/admin/products', (req, res) => {

    db.query(
        "SELECT * FROM products",
        (err, results) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(results);
        }
    );
});

// ADD PRODUCT
app.post('/admin/add-product', (req, res) => {

    const {
        name,
        description,
        price,
        category,
        size,
        gender,
        department
    } = req.body;

    const sql = `
        INSERT INTO products
        (
            name,
            description,
            price,
            category,
            size,
            gender,
            department
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            name,
            description,
            price,
            category,
            size,
            gender,
            department
        ],
        (err) => {

            if (err) {
                console.log(err);

                return res.json({
                    message:
                    "Error adding product"
                });
            }

            res.json({
                message:
                "Product added successfully"
            });
        }
    );
});

// DELETE PRODUCT
app.delete(
'/admin/delete-product/:id',
(req, res) => {

    db.query(
        "DELETE FROM products WHERE id=?",
        [req.params.id],
        (err) => {

            if (err) {
                return res.json({
                    message:
                    "Delete failed"
                });
            }

            res.json({
                message:
                "Product deleted"
            });
        }
    );
});

// =====================
// PRODUCTS
// =====================
app.get('/products',
(req, res) => {

    db.query(
        "SELECT * FROM products",
        (err, results) => {

            if (err) {
                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// CART
// =====================
app.post('/cart/add',
(req, res) => {

    if (!req.session.userId) {
        return res.json({
            message:
            "Login first"
        });
    }

    const {
        product_id
    } = req.body;

    db.query(
        `
        INSERT INTO cart
        (user_id, product_id, quantity)
        VALUES (?, ?, 1)
        `,
        [
            req.session.userId,
            product_id
        ],
        () => {

            res.json({
                message:
                "Added to cart"
            });
        }
    );
});

// =====================
// GET CART
// =====================
app.get('/cart',
(req, res) => {

    if (!req.session.userId) {
        return res.json([]);
    }

    const sql = `
        SELECT
        c.id,
        p.name,
        p.price,
        c.quantity
        FROM cart c
        JOIN products p
        ON c.product_id = p.id
        WHERE c.user_id = ?
    `;

    db.query(
        sql,
        [req.session.userId],
        (err, results) => {

            if (err) {
                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// REMOVE CART
// =====================
app.post('/cart/remove',
(req, res) => {

    const {
        cart_id
    } = req.body;

    db.query(
        `
        DELETE FROM cart
        WHERE id = ?
        `,
        [cart_id],
        () => {

            res.json({
                message:
                "Removed"
            });
        }
    );
});

// =====================
// CHECKOUT
// =====================
app.post('/checkout',
(req, res) => {

    res.json({
        message:
        "Checkout successful!"
    });
});

// =====================
// USER ORDERS
// =====================
app.get('/orders',
(req, res) => {

    if (!req.session.userId) {
        return res.json([]);
    }

    db.query(
        `
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
        `,
        [req.session.userId],
        (err, results) => {

            if (err) {
                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// ACCOUNT
// =====================
app.get('/account/user',
(req, res) => {

    if (!req.session.userId) {
        return res.json({
            loggedIn: false
        });
    }

    db.query(
        `
        SELECT
        id,
        name,
        email
        FROM users
        WHERE id = ?
        `,
        [req.session.userId],
        (err, results) => {

            if (
                err ||
                results.length === 0
            ) {
                return res.json({
                    loggedIn:false
                });
            }

            res.json({
                loggedIn:true,
                user:results[0]
            });
        }
    );
});

// =====================
// ADMIN PAGE
// =====================
app.get('/admin', (req, res) => {

    console.log("SESSION:", req.session);

    if (!req.session.userId) {
        return res.send("NOT LOGGED IN");
    }

    db.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [req.session.userId],
        (err, results) => {

            if (err) {
                console.log(err);
                return res.send("DATABASE ERROR");
            }

            if (results.length === 0) {
                return res.send("USER NOT FOUND");
            }

            const user = results[0];

            console.log(user);

            // allow admin
            if (user.is_admin == 1) {

                return res.sendFile(
                    path.join(
                        __dirname,
                        'frontend',
                        'admin.html'
                    )
                );
            }

            // block non-admin
            res.send("ACCESS DENIED");
        }
    );
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {

    console.log(
        `🚀 Running on http://localhost:${PORT}`
    );
});