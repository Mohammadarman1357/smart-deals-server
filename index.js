const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;


const serviceAccount = require("./smart-deals-firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

// const logger = (req, res, next) => {
//     console.log('logging info')
//     next();
// }

const verifyFirebaseToken = async (req, res, next) => {
    
    const authorization = req.headers.authorization;
    if (!authorization) {
        // do not allow to go
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log('after token validation', decoded)
        req.token_email = decoded.email;
        next();
    }
    catch {
        console.log('invalid token');
        return res.status(401).send({ message: 'unauthorized access' })
    }
    // verify token
    //

}

// user and Password

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@gampi.pfydvdc.mongodb.net/?appName=Gampi`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('Smart Server is running');
})

async function run() {
    try {
        await client.connect()

        const db = client.db("smart_db");
        const productsCollection = db.collection('products');

        const bidsCollection = db.collection('bids');
        const usersCollection = db.collection('users');

        // users api
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = { email: email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'user already exists. do not need to insert again' });
            }
            else {
                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            }
        })

        // products apis
        app.get('/products', async (req, res) => {
            // const projectFields = { title: 1, price_min: 1, price_max: 1, image: 1 };
            // const cursor = productsCollection.find().sort({ price_min: 1 }).skip(2).limit(2).project(projectFields);

            console.log(req.query)
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }

            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/latest-products', async (req, res) => {
            const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            const result = await productsCollection.findOne(query);
            res.send(result);
        })

        app.post('/products', async (req, res) => {
            const newsProduct = req.body;
            const result = await productsCollection.insertOne(newsProduct);
            res.send(result);
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const query = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    name: updatedProduct.name,
                    price: updatedProduct.price
                }
            }
            const result = await productsCollection.updateOne(query, update);
            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        //bids related apis
        app.get('/bids', verifyFirebaseToken, async (req, res) => {
            console.log('headers', req.headers)

            const email = req.query.email;
            const query = {};
            if (email) {
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'Forbidden access' })
                }
                query.buyer_email = email;
            }

            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // app.get('/bids', async (req, res) => {

        //     const query = {};
        //     if (query.email) {
        //         query.buyer_email = email;
        //     }

        //     const cursor = bidsCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

        app.get('/products/bids/:productId', verifyFirebaseToken, async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId };
            const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
            const result = await cursor.toArray();
            res.send(result);
        })



        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid);
            res.send(result);
        })

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir)

app.listen(port, () => {
    console.log(`Smart server is running on port : ${port}`);
})



// client.connect()
//     .then(() => {

//     })
//     .catch(console.dir)