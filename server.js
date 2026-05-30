console.log("🔥 SERVER STARTED");

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const app = express();
const PORT = 3000;

// =====================
// IMAGE UPLOAD SETUP
// =====================
const uploadFolder =
path.join(
    __dirname,
    'frontend',
    'uploads'
);

// create uploads folder
if(
    !fs.existsSync(
        uploadFolder
    )
){
    fs.mkdirSync(
        uploadFolder,
        { recursive:true }
    );
}

const storage =
multer.diskStorage({

    destination:
    (req,file,cb)=>{

        cb(
            null,
            uploadFolder
        );
    },

    filename:
    (req,file,cb)=>{

        cb(
            null,
            Date.now()
            + '-'
            + file.originalname
        );
    }
});

const upload =
multer({
    storage
});

// =====================
// MIDDLEWARE
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// STATIC FILES
// =====================

app.use(

express.static(

path.join(
__dirname,
'frontend'
)

));

app.use(

'/uploads',

express.static(

path.join(
__dirname,
'frontend',
'uploads'
)

));

app.use(

'/images',

express.static(

path.join(
__dirname,
'frontend',
'images'
)

));

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
const db = require('./db');
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
// ADMIN MIDDLEWARE
// =====================
function requireAdmin(
req,
res,
next
){

    if(
        !req.session.userId
    ){
        return res.redirect('/');
    }

    db.query(
        `
        SELECT
        is_admin,
        admin_role
        FROM users
        WHERE id = ?
        `,
        [req.session.userId],

        (err,results)=>{

            if(
                err ||
                results.length === 0
            ){
                return res.redirect('/');
            }

            if(
                results[0]
                .is_admin !== 1
            ){
                return res.redirect('/');
            }

            next();
        }
    );
}

// =====================
// SUPER ADMIN ONLY
// =====================
function requireSuperAdmin(
req,
res,
next
){

    if(
        !req.session.userId
    ){
        return res.redirect('/');
    }

    db.query(
        `
        SELECT
        admin_role
        FROM users
        WHERE id = ?
        `,
        [req.session.userId],

        (err,results)=>{

            if(
                err ||
                results.length === 0
            ){
                return res.redirect('/');
            }

            if(
                results[0]
                .admin_role
                !==
                'super_admin'
            ){
                return res
                .status(403)
                .send(
                'Access denied'
                );
            }

            next();
        }
    );
}

// =====================
// LOGIN STATUS
// =====================
app.get(
'/me',
(req,res)=>{

    if(
        !req.session.userId
    ){
        return res.json({
            loggedIn:false
        });
    }

    db.query(
        `
        SELECT
        id,
        name,
        email,
        is_admin,
        admin_role
        FROM users
        WHERE id = ?
        `,
        [req.session.userId],

        (err,results)=>{

            if(
                err ||
                results.length === 0
            ){
                return res.json({
                    loggedIn:false
                });
            }

            const user =
                results[0];

            res.json({

                loggedIn:true,

                id:user.id,
                name:user.name,
                email:user.email,

                is_admin:
                user.is_admin,

                admin_role:
                user.admin_role
            });
        }
    );
});

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
app.post(
'/register',
async (req,res)=>{

    try{

        console.log(
        req.body
        );

        const {

            name,
            email,
            password,
            student_id,
            user_type,
            job_title

        } = req.body;

        if(
            !name ||
            !email ||
            !password
        ){
            return res.json({
                message:
                'Please fill all required fields.'
            });
        }

        const hashedPassword =
        await bcrypt.hash(
            password,
            10
        );

        db.query(
        `
        INSERT INTO users
        (
            name,
            email,
            password,
            student_id,
            user_type,
            job_title
        )
        VALUES
        (?, ?, ?, ?, ?, ?)
        `,
        [
            name,
            email,
            hashedPassword,
            student_id || null,
            user_type || 'student',
            job_title || null
        ],
        (err)=>{

            if(err){

                console.log(
                err
                );

                return res.json({
                    message:
                    'Registration failed'
                });
            }

            res.json({
                message:
                'Registered successfully'
            });
        });

    }
    catch(err){

        console.log(err);

        res.json({
            message:
            'Server error'
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

// =====================
// ADD PRODUCT
// =====================
app.post(
'/admin/add-product',
upload.single('image'),
(req,res)=>{

    const {
        name,
        stock,
        description,
        price,
        category,
        size,
        gender,
        department
    } = req.body;

    const image =
        req.file
        ?
        '/uploads/' +
        req.file.filename
        :
        null;

    const sql = `
        INSERT INTO products
        (
            name,
            stock,
            description,
            price,
            category,
            size,
            gender,
            department,
            image
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            name,
            stock,
            description,
            price,
            category,
            size,
            gender,
            department,
            image
        ],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Add failed'
                });
            }

            res.json({
                message:
                'Product added'
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
// UPDATE PRODUCT
// =====================
app.put(
'/admin/update-product/:id',
upload.single('image'),
(req,res)=>{

    const id =
        req.params.id;

    const {
        name,
        description,
        price,
        category,
        stock
    } = req.body;

    let sql;
    let values;

    // if admin uploads new image
    if(req.file){

        const image =
            '/uploads/' +
            req.file.filename;

        sql = `
            UPDATE products
            SET
                name=?,
                description=?,
                price=?,
                category=?,
                stock=?,
                image=?
            WHERE id=?
        `;

        values = [
            name,
            description,
            price,
            category,
            stock,
            image,
            id
        ];

    }else{

        // keep old image
        sql = `
            UPDATE products
            SET
                name=?,
                description=?,
                price=?,
                category=?,
                stock=?
            WHERE id=?
        `;

        values = [
            name,
            description,
            price,
            category,
            stock,
            id
        ];
    }

    db.query(
        sql,
        values,
        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Update failed'
                });
            }

            res.json({
                message:
                'Product updated'
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
app.post('/cart/add', (req, res) => {

    if (!req.session.userId) {
        return res.json({
            message:
            "Please login first"
        });
    }

    const { product_id } =
        req.body;

    db.query(
        "SELECT stock FROM products WHERE id=?",
        [product_id],
        (err, result) => {

            if (err || result.length === 0) {
                return res.json({
                    message:
                    "Product not found"
                });
            }

            const stock =
                result[0].stock;

            if (stock <= 0) {
                return res.json({
                    message:
                    "Out of stock"
                });
            }

            const sql = `
                INSERT INTO cart
                (
                    user_id,
                    product_id,
                    quantity
                )
                VALUES (?, ?, 1)
            `;

            db.query(
                sql,
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
app.post(
'/checkout',
upload.single(
'payment_proof'
),
(req, res) => {

    if (!req.session.userId) {

        return res.json({
            message:
            "Please login first"
        });
    }

    const userId =
    req.session.userId;

    const paymentMethod =
    req.body.payment_method
    ||
    'Cash on Pickup';

    let paymentProof =
    null;

    if(req.file){

        paymentProof =
        '/uploads/'
        +
        req.file.filename;
    }

    // get cart items
    const cartSQL = `

        SELECT
            c.product_id,
            c.quantity,
            p.price,
            p.stock

        FROM cart c

        JOIN products p
        ON c.product_id = p.id

        WHERE c.user_id = ?
    `;

    db.query(
        cartSQL,
        [userId],

        (err, cartItems) => {

            if (
                err ||
                cartItems.length === 0
            ) {

                return res.json({
                    message:
                    "Cart is empty"
                });
            }

            let total = 0;

            // stock check
            for (let item of cartItems) {

                if (
                    item.quantity >
                    item.stock
                ) {

                    return res.json({
                        message:
                        "Not enough stock"
                    });
                }

                total +=
                item.price *
                item.quantity;
            }

const orderStatus =

paymentMethod
===
'GCash'

?

'Waiting for Approval'

:

'Pending';

            // create order
            db.query(

                `
                INSERT INTO orders
                (
                    user_id,
                    total,
                    status,
                    payment_method,
                    payment_proof
                )
                VALUES (?, ?, ?, ?, ?)
                `,

                [
                    userId,
                    total,
                    orderStatus,
                    paymentMethod,
                    paymentProof
                ],

                (err, orderResult) => {

                    if (err) {

                        console.log(err);

                        return res.json({
                            message:
                            "Checkout failed"
                        });
                    }

                    const orderId =
                    orderResult.insertId;

                    let itemsDone = 0;

                    cartItems.forEach(item => {

                        // save items
                        db.query(

                            `
                            INSERT INTO
                            order_items
                            (
                                order_id,
                                product_id,
                                quantity,
                                price
                            )
                            VALUES (?, ?, ?, ?)
                            `,

                            [
                                orderId,
                                item.product_id,
                                item.quantity,
                                item.price
                            ]
                        );

                        // reduce stock
                        db.query(

                            `
                            UPDATE products
                            SET stock =
                            stock - ?

                            WHERE id = ?
                            `,

                            [
                                item.quantity,
                                item.product_id
                            ]
                        );

                        itemsDone++;

                        // finish
                        if (
                            itemsDone ===
                            cartItems.length
                        ) {

                            db.query(

                                `
                                DELETE FROM cart
                                WHERE user_id = ?
                                `,

                                [userId]
                            );

                            res.json({

                                message:

                                paymentMethod
                                ===
                                'GCash'

                                ?

                                'Order placed! Waiting payment approval.'

                                :

                                'Checkout successful!'
                            });
                        }
                    });
                }
            );
        }
    );
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
        SELECT
        o.*,

        GROUP_CONCAT(

            CONCAT(
                p.name,
                ' ×',
                oi.quantity
            )

            SEPARATOR '|||'

        ) AS items

        FROM orders o

        LEFT JOIN order_items oi
        ON o.id = oi.order_id

        LEFT JOIN products p
        ON oi.product_id = p.id

        WHERE o.user_id = ?

        GROUP BY o.id

        ORDER BY o.created_at DESC
        `,

        [req.session.userId],

        (err, results) => {

            if (err) {

                console.log(err);

                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// ADMIN UPDATE ORDER
// =====================
app.put(
'/admin/order/:id',
requireAdmin,
(req, res) => {

    const {
        status
    } = req.body;

    const orderId =
        req.params.id;

    // if declining
    if (status === 'Declined') {

        db.query(
            `
            SELECT *
            FROM order_items
            WHERE order_id = ?
            `,
            [orderId],
            (err, items) => {

                if (err) {
                    return res.json({
                        message:
                        "Error"
                    });
                }

                // restore stock
                items.forEach(item => {

                    db.query(
                        `
                        UPDATE products
                        SET stock =
                        stock + ?
                        WHERE id = ?
                        `,
                        [
                            item.quantity,
                            item.product_id
                        ]
                    );
                });

                db.query(
                    `
                    UPDATE orders
                    SET status = ?
                    WHERE id = ?
                    `,
                    [
                        status,
                        orderId
                    ],
                    () => {

                        res.json({
                            message:
                            "Order declined"
                        });
                    }
                );
            }
        );

    } else {

        // approve
        db.query(
            `
            UPDATE orders
            SET status = ?
            WHERE id = ?
            `,
            [
                status,
                orderId
            ],
            () => {

                res.json({
                    message:
                    "Order updated"
                });
            }
        );
    }
});

// =====================
// ACCOUNT USER
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
            email,
            is_admin
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
// INCREASE CART
// =====================
app.put(
'/cart/increase/:id',
(req,res)=>{

    db.query(
        `
        UPDATE cart
        SET quantity =
        quantity + 1
        WHERE id = ?
        `,
        [req.params.id],
        ()=>{

            res.json({
                message:
                "Updated"
            });
        }
    );
});


// =====================
// DECREASE CART
// =====================
app.put(
'/cart/decrease/:id',
(req,res)=>{

    db.query(
        `
        SELECT quantity
        FROM cart
        WHERE id = ?
        `,
        [req.params.id],

        (err,result)=>{

            if(
                err ||
                result.length === 0
            ){
                return res.json({
                    message:
                    "Error"
                });
            }

            const qty =
                result[0].quantity;

            if(qty <= 1){

                db.query(
                    `
                    DELETE FROM cart
                    WHERE id = ?
                    `,
                    [req.params.id]
                );

                return res.json({
                    message:
                    "Removed"
                });
            }

            db.query(
                `
                UPDATE cart
                SET quantity =
                quantity - 1
                WHERE id = ?
                `,
                [req.params.id],
                ()=>{

                    res.json({
                        message:
                        "Updated"
                    });
                }
            );
        }
    );
});

// =====================
// ADMIN GET ORDERS
// =====================
app.get(
'/admin/orders',
requireAdmin,
(req, res) => {

    const sql = `
        SELECT
            o.id,
            o.total,
            o.status,
            o.created_at,
            u.name AS customer_name
        FROM orders o
        JOIN users u
        ON o.user_id = u.id
        ORDER BY o.created_at DESC
    `;

    db.query(
        sql,
        (err, results) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// ADMIN ORDER DETAILS
// =====================
app.get(
'/admin/order-details/:id',
requireAdmin,
(req,res)=>{

    const orderId =
        req.params.id;

    const sql = `
        SELECT
            p.name,
            oi.quantity,
            oi.price
        FROM order_items oi
        JOIN products p
        ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `;

    db.query(
        sql,
        [orderId],
        (err,results)=>{

            if(err){
                console.log(err);

                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// ADMIN UPDATE ORDER
// =====================
app.put(
'/admin/order/:id',
requireAdmin,
(req, res) => {

    const {
        status
    } = req.body;

    const orderId =
        req.params.id;

    // DECLINE ORDER
    if (status === 'Declined') {

        db.query(
            `
            SELECT *
            FROM order_items
            WHERE order_id = ?
            `,
            [orderId],
            (err, items) => {

                if (err) {
                    return res.json({
                        message:
                        "Error"
                    });
                }

                // restore stock
                items.forEach(item => {

                    db.query(
                        `
                        UPDATE products
                        SET stock =
                        stock + ?
                        WHERE id = ?
                        `,
                        [
                            item.quantity,
                            item.product_id
                        ]
                    );
                });

                db.query(
                    `
                    UPDATE orders
                    SET status = ?
                    WHERE id = ?
                    `,
                    [
                        status,
                        orderId
                    ],
                    () => {

                        res.json({
                            message:
                            "Order declined"
                        });
                    }
                );
            }
        );

    } else {

        // APPROVE
        db.query(
            `
            UPDATE orders
            SET status = ?
            WHERE id = ?
            `,
            [
                status,
                orderId
            ],
            () => {

                res.json({
                    message:
                    "Order updated"
                });
            }
        );
    }
});

// =====================
// ADMIN ORDERS PAGE
// =====================
app.get(
'/admin-orders',
requireAdmin,
(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            'frontend',
            'admin-orders.html'
        )
    );
});

// =====================
// ADMIN USERS PAGE
// =====================
app.get(
'/admin-users',
requireAdmin,
(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            'frontend',
            'admin-users.html'
        )
    );
});

// =====================
// GET ALL ORDERS
// =====================
app.get(
'/admin/all-orders',
requireAdmin,
(req,res)=>{

    const sql = `
        SELECT
            orders.*,
            users.name
        FROM orders
        JOIN users
        ON orders.user_id =
        users.id
        ORDER BY
        orders.created_at
        DESC
    `;

    db.query(
        sql,
        (err,results)=>{

            if(err){

                console.log(err);

                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// APPROVE ORDER
// =====================
app.put(
'/admin/approve-order/:id',
requireAdmin,
(req,res)=>{

    const orderId =
        req.params.id;

    const orNumber =
        'OR-' +
        Date.now();

    db.query(
        `
        UPDATE orders
        SET
        status='Approved',
        or_number=?
        WHERE id=?
        `,
        [
            orNumber,
            orderId
        ],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Approval failed'
                });
            }

            res.json({
                message:
                'Order approved'
            });
        }
    );
});

// =====================
// DECLINE ORDER
// =====================
app.put(
'/admin/decline-order/:id',
requireAdmin,
(req,res)=>{

    const orderId =
        req.params.id;

    // restore stocks first
    db.query(
        `
        SELECT
            product_id,
            quantity
        FROM order_items
        WHERE order_id = ?
        `,
        [orderId],

        (err,items)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Error'
                });
            }

            // restore stock
            items.forEach(item=>{

                db.query(
                    `
                    UPDATE products
                    SET stock =
                    stock + ?
                    WHERE id = ?
                    `,
                    [
                        item.quantity,
                        item.product_id
                    ]
                );
            });

            // decline order
            db.query(
                `
                UPDATE orders
                SET status =
                'Declined'
                WHERE id = ?
                `,
                [orderId],

                ()=>{

                    res.json({
                        message:
                        'Order Declined'
                    });
                }
            );
        }
    );
});

// =====================
// MAKE ADMIN
// =====================
app.put(
'/admin/make-admin/:id',
requireAdmin,
(req,res)=>{

    db.query(
        `
        UPDATE users
        SET is_admin = 1
        WHERE id = ?
        `,
        [req.params.id],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Failed to make admin'
                });
            }

            res.json({
                message:
                'User is now admin'
            });
        }
    );
});

// =====================
// REMOVE ADMIN
// =====================
app.put(
'/admin/remove-admin/:id',
requireAdmin,
(req,res)=>{

    db.query(
        `
        UPDATE users
        SET is_admin = 0
        WHERE id = ?
        `,
        [req.params.id],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Failed to remove admin'
                });
            }

            res.json({
                message:
                'Admin removed'
            });
        }
    );
});

// =====================
// DELETE USER
// =====================
app.delete(
'/admin/delete-user/:id',
requireAdmin,
(req,res)=>{

    db.query(
        `
        DELETE FROM users
        WHERE id = ?
        `,
        [req.params.id],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    message:
                    'Delete failed'
                });
            }

            res.json({
                message:
                'User deleted'
            });
        }
    );
});
// =====================
// ADMIN USERS PAGE
// =====================
app.get(
'/admin-users',
requireAdmin,
(req, res) => {

    console.log("USERS PAGE HIT");

    res.sendFile(
        path.join(
            __dirname,
            'frontend',
            'admin-users.html'
        )
    );
});

// =====================
// GET USERS
// =====================
app.get(
'/admin/users',
requireAdmin,
(req, res) => {

    console.log(
    "GET USERS HIT"
    );

    db.query(
        `
        SELECT
            id,
            name,
            email,
            student_id,
            user_type,
            job_title,
            is_admin,
            admin_role
        FROM users
        `,
        (err, results) => {

            if(err){

                console.log(
                err
                );

                return res.json(
                []
                );
            }

            console.log(
            results
            );

            res.json(
            results
            );
        }
    );
});
// =====================
// RECEIPT PAGE
// =====================
app.get(
'/receipt/:id',
(req,res)=>{

    const orderId =
        req.params.id;

    const orderSQL = `
        SELECT
        o.*,
        u.name
        FROM orders o
        JOIN users u
        ON o.user_id = u.id
        WHERE o.id = ?
    `;

    db.query(
        orderSQL,
        [orderId],

        (err,orderResults)=>{

            if(
                err ||
                orderResults.length === 0
            ){
                return res.send(
                "Receipt not found"
                );
            }

            const order =
                orderResults[0];

            const itemsSQL = `
                SELECT
                oi.quantity,
                p.name,
                p.price
                FROM order_items oi
                JOIN products p
                ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `;

            db.query(
                itemsSQL,
                [orderId],

                (err,itemResults)=>{

                    if(err){
                        console.log(err);

                        return res.send(
                        "Failed to load receipt items"
                        );
                    }

                    let itemsHTML =
                        '';

                    itemResults.forEach(
                    item=>{

                        itemsHTML += `
                            <tr>
                                <td>
                                ${item.name}
                                </td>

                                <td>
                                ${item.quantity}
                                </td>

                                <td>
                                ₱${item.price}
                                </td>

                                <td>
                                ₱${
                                    item.price *
                                    item.quantity
                                }
                                </td>
                            </tr>
                        `;
                    });

                    res.send(`
                        <html>

                        <head>
                        <title>
                        Official Receipt
                        </title>

                        <style>

                        body{
                            font-family:
                            Arial;
                            background:
                            #f5f5f5;
                            padding:40px;
                        }

                        .receipt{
                            background:
                            white;

                            max-width:
                            800px;

                            margin:auto;

                            padding:40px;

                            border-radius:
                            20px;

                            box-shadow:
                            0 4px 20px
                            rgba(0,0,0,.1);
                        }

                        h1,h2{
                            color:
                            #6d0f1d;
                        }

                        table{
                            width:100%;
                            border-collapse:
                            collapse;
                            margin-top:20px;
                        }

                        table th,
                        table td{
                            border:
                            1px solid #ddd;

                            padding:
                            12px;

                            text-align:left;
                        }

                        .print-btn{
                            background:
                            #6d0f1d;

                            color:white;

                            border:none;

                            padding:
                            12px 20px;

                            border-radius:
                            10px;

                            cursor:pointer;

                            margin-top:
                            20px;
                        }

                        </style>
                        </head>

                        <body>

                        <div class="receipt">

                            <h1>
                            FBC MARKETPLACE
                            </h1>

                            <h2>
                            OFFICIAL RECEIPT
                            </h2>

                            <hr>

                            <p>
                            <b>OR Number:</b>
                            ${order.or_number}
                            </p>

                            <p>
                            <b>Order ID:</b>
                            #${order.id}
                            </p>

                            <p>
                            <b>Customer:</b>
                            ${order.name}
                            </p>

                            <p>
                            <b>Status:</b>
                            ${order.status}
                            </p>

                            <p>
                            <b>Date:</b>
                            ${
                            new Date(
                            order.created_at
                            ).toLocaleString()
                            }
                            </p>

                            <h3>
                            Items Purchased
                            </h3>

                            <table>

                                <tr>
                                    <th>
                                    Product
                                    </th>

                                    <th>
                                    Qty
                                    </th>

                                    <th>
                                    Price
                                    </th>

                                    <th>
                                    Subtotal
                                    </th>
                                </tr>

                                ${itemsHTML}

                            </table>

                            <h2>
                            Total:
                            ₱${order.total}
                            </h2>

                            <button
                            class="print-btn"
                            onclick="
                            window.print()
                            ">

                            🖨 Print Receipt

                            </button>

                        </div>

                        </body>
                        </html>
                    `);
                }
            );
        }
    );
});

// ======================
// SEND MESSAGE
// ======================

app.post(
'/send-message',
(req,res)=>{

    const {

        product_id,
        message

    } = req.body;

    const user_id =
    req.session.userId;

    if(!user_id){

        return res.json({
            success:false,
            message:'Login first'
        });
    }

    if(!message){

        return res.json({
            success:false,
            message:'Empty message'
        });
    }

    db.query(
    `
    INSERT INTO messages
    (
        user_id,
        product_id,
        message
    )
    VALUES (?, ?, ?)
    `,
    [
        user_id,
        product_id || 1,
        message
    ],
    (err)=>{

        if(err){

            console.log(err);

            return res.json({
                success:false
            });
        }

        res.json({
            success:true,
            message:
            'Message sent'
        });
    });
});

// ======================
// GET CUSTOMER MESSAGES
// ======================

app.get(
'/messages',
(req,res)=>{

    const userId =
    req.session.userId;

    if(!userId){

        return res.json([]);
    }

    db.query(
    `
    SELECT

        messages.*,

        users.name
        AS sender_name,

        products.name
        AS product_name

    FROM messages

    LEFT JOIN users
    ON users.id =
    messages.user_id

    LEFT JOIN products
    ON products.id =
    messages.product_id

    WHERE

    messages.user_id = ?

    ORDER BY
    messages.created_at ASC
    `,
    [userId],
    (err,results)=>{

        if(err){

            console.log(err);

            return res.json([]);
        }

        res.json(results);
    });
});

// ======================
// MESSAGE PAGE
// ======================

app.get(
'/messages-page',
(req,res)=>{

    res.sendFile(
    path.join(
        __dirname,
        'frontend',
        'messages.html'
    ));
});

// ======================
// ADMIN CONVERSATIONS
// ======================

app.get(
'/admin/conversations',
requireAdmin,
(req,res)=>{

    db.query(
    `
    SELECT DISTINCT

        users.id,
        users.name,
        users.email

    FROM messages

    JOIN users
    ON users.id =
    messages.user_id

    ORDER BY
    users.name ASC
    `,
    (err,results)=>{

        if(err){

            console.log(err);

            return res.json([]);
        }

        res.json(results);
    });
});


// ======================
// GET CUSTOMER CHAT
// ======================

app.get(
'/admin/messages/:userId',
requireAdmin,
(req,res)=>{

    const userId =
    req.params.userId;

    db.query(
    `
    SELECT

        messages.*,

        users.name
        AS sender_name,

        products.name
        AS product_name

    FROM messages

    LEFT JOIN users
    ON users.id =
    messages.user_id

    LEFT JOIN products
    ON products.id =
    messages.product_id

    WHERE
    messages.user_id = ?

    ORDER BY
    messages.created_at ASC
    `,
    [userId],
    (err,results)=>{

        if(err){

            console.log(err);

            return res.json([]);
        }

        res.json(results);
    });
});

// ======================
// ADMIN MESSAGE PAGE
// ======================

app.get(
'/admin-messages',
requireAdmin,
(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            'frontend',
            'admin-messages.html'
        )
    );
});

app.get(
'/current-user',
(req,res)=>{

    if(!req.session.userId){

        return res.json(null);
    }

    db.query(
    `
    SELECT *
    FROM users
    WHERE id = ?
    `,
    [
        req.session.userId
    ],
    (err,result)=>{

        if(err){

            return res.json(null);
        }

        res.json(
            result[0]
        );
    });
});

app.post(
'/reply-message',
requireAdmin,
(req,res)=>{

    const {

        userId,
        productId,
        reply

    } = req.body;

    db.query(
    `
    INSERT INTO messages
    (

        user_id,
        product_id,
        message,
        is_admin_reply

    )

    VALUES
    (?, ?, ?, TRUE)
    `,
    [
        userId,
        productId,
        reply
    ],
    (err)=>{

        if(err){

            console.log(err);

            return res.json({
                success:false
            });
        }

        res.json({
            success:true
        });
    });
});

// =====================
// GET CATEGORIES
// =====================
app.get(
'/categories',
(req,res)=>{

    db.query(
        `
        SELECT *
        FROM categories
        ORDER BY
        name ASC
        `,
        (err,results)=>{

            if(err){

                console.log(err);

                return res.json([]);
            }

            res.json(results);
        }
    );
});

// =====================
// ADD CATEGORY
// =====================
app.post(
'/categories/add',

upload.single(
'image'
),

(req,res)=>{

    console.log(req.body);
    console.log(req.file);

    const name =
    req.body?.name ||
    '';

    const description =
    req.body?.description ||
    '';

    const featured =
    req.body?.featured ===
    'true'
    ? 1
    : 0;

    const hidden =
    req.body?.hidden ===
    'true'
    ? 1
    : 0;

    let image =
    null;

    if(req.file){

        image =
        '/uploads/'
        +
        req.file.filename;
    }

    db.query(
        `
        INSERT INTO
        categories
        (

            name,
            description,
            image,
            featured,
            hidden

        )

        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?
        )
        `,
        [

            name,
            description,
            image,
            featured,
            hidden

        ],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    success:false
                });
            }

            res.json({
                success:true
            });
        }
    );
});

// =====================
// DELETE CATEGORY
// =====================
app.delete(
'/categories/:id',
(req,res)=>{

    db.query(
        `
        DELETE FROM
        categories
        WHERE id = ?
        `,
        [req.params.id],
        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    success:false
                });
            }

            res.json({
                success:true
            });
        }
    );
});

// =====================
// CATEGORY PAGE
// =====================
app.get(
'/categories-page',
(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            'frontend',
            'categories.html'
        )
    );
});

// =====================
// UPDATE CATEGORY
// =====================
app.put(

'/categories/update/:id',

upload.single(
'image'
),

(req,res)=>{

    const id =
    req.params.id;

    const name =
    req.body.name;

    const description =
    req.body.description;

    const featured =
    req.body.featured ===
    'true'
    ? 1
    : 0;

    const hidden =
    req.body.hidden ===
    'true'
    ? 1
    : 0;

    // if no new image
    if(!req.file){

        db.query(
            `
            UPDATE categories
            SET

            name = ?,
            description = ?,
            featured = ?,
            hidden = ?

            WHERE id = ?
            `,
            [

                name,
                description,
                featured,
                hidden,
                id
            ],

            (err)=>{

                if(err){

                    console.log(err);

                    return res.json({
                        success:false
                    });
                }

                res.json({
                    success:true
                });
            }
        );

    }else{

        const image =
        '/uploads/'
        +
        req.file.filename;

        db.query(
            `
            UPDATE categories
            SET

            name = ?,
            description = ?,
            image = ?,
            featured = ?,
            hidden = ?

            WHERE id = ?
            `,
            [

                name,
                description,
                image,
                featured,
                hidden,
                id
            ],

            (err)=>{

                if(err){

                    console.log(err);

                    return res.json({
                        success:false
                    });
                }

                res.json({
                    success:true
                });
            }
        );
    }
});

// =====================
// LOW STOCK WARNING
// =====================
app.get(
'/admin/low-stock',
(req,res)=>{

    db.query(

        `
        SELECT
        id,
        name,
        stock
        FROM products
        WHERE stock <= 10
        ORDER BY stock ASC
        `,

        (err,results)=>{

            if(err){

                console.log(err);

                return res.json([]);
            }

            res.json(results);
        }
    );
});

app.put(
'/admin/update-order-status/:id',
(req,res)=>{

    const id =
    req.params.id;

    const status =
    req.body.status;

    db.query(

        `
        UPDATE orders
        SET status = ?
        WHERE id = ?
        `,

        [
            status,
            id
        ],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({
                    success:false
                });
            }

            res.json({
                success:true
            });
        }
    );
});

// ======================
// UPLOAD REFUND PROOF
// ======================
app.post(
'/admin/upload-refund/:id',

upload.single(
'refundProof'
),

(req,res)=>{

    const orderId =
    req.params.id;

    if(!req.file){

        return res.json({
            success:false,
            message:
            'No file uploaded'
        });
    }

    const refundProof =

    '/uploads/'
    + req.file.filename;

    db.query(

    `
    UPDATE orders
    SET refund_proof = ?
    WHERE id = ?
    `,

    [
        refundProof,
        orderId
    ],

    (err)=>{

        if(err){

            console.log(err);

            return res.json({
                success:false
            });
        }

        res.json({
            success:true
        });
    });
});

// ======================
// ADMIN DASHBOARD STATS
// ======================
app.get(
'/admin/dashboard-stats',

(req,res)=>{

    const stats = {};

    db.query(

    `
    SELECT COUNT(*) AS total
    FROM products
    `,

    (err,products)=>{

        if(err){

            console.log(err);

            return res.json({});
        }

        stats.products =
        products[0].total;

        db.query(

        `
        SELECT COUNT(*) AS total
        FROM orders
        `,

        (err,orders)=>{

            stats.orders =
            orders[0].total;

            db.query(

            `
            SELECT
            SUM(total)
            AS totalSales
            FROM orders
            WHERE status =
            'Completed'
            `,

            (err,sales)=>{

                stats.sales =

                sales[0]
                .totalSales

                ||

                0;

                db.query(

                `
                SELECT COUNT(*)
                AS total
                FROM users
                `,

                (err,users)=>{

                    stats.customers =
                    users[0].total;

                    db.query(

                    `
                    SELECT COUNT(*)
                    AS lowStock
                    FROM products
                    WHERE stock <= 10
                    `,

                    (err,lowStock)=>{

                        stats.lowStock =

                        lowStock[0]
                        .lowStock;

                        res.json(
                        stats
                        );
                    });
                });
            });
        });
    });
});

app.listen(PORT, () => {

    console.log(
        `🚀 Running on http://localhost:${PORT}`
    );
});
