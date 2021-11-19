const express = require("express");
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);


  
// doctors - protal - firebase - adminsdk.json  jwt token;

var serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

// database connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qrkkr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req?.headers?.authorization.startsWith("Bearer ")) {
    const token = req?.headers?.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    console.log("database connected successfully");

    // APPOINMENT GET API
    app.get("/appointments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const cursor = appointmentCollection.find(query);
      const appointment = await cursor.toArray();
      res.json(appointment);
    });
    // SINGLE APPOINTMENT API
      app.get("/appointment/:id",async(req,res)=>{
        const id = req.params.id;
        const query = {_id:ObjectId(id)}
        const appointment = await appointmentCollection.findOne(query);
        res.json(appointment)
      })

    // APPOINMENT POST API
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result);
    });
    // APPOINTMENT PUT API FOR UPDATE 
    app.put("/appointment/:id",async(req,res)=>{
      const id = req.params.id;
      const payment = req.body
      const filter = {_id:ObjectId(id)};
      const updateDoc = {$set :{ payment:payment}};
      const result = await appointmentCollection.updateOne(filter,updateDoc)
      res.json(result)
    })

    // USER GET API FOR MAKE ADMIN
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // USER POST API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = usersCollection.insertOne(user);
      res.json(result);
    });
    // Update user
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // Modify the user
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(401)
          .json({ message: "You Don't have access to make admin" });
      }
    });

    app.post("/create-payment-intent",async(req,res)=>{
      const paymentInfo = req.body;
      const amount = paymentInfo.price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency: "usd",
        payment_method_types:["card"]
      })
      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    });



  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// created the server
app.get("/", (req, res) => {
  res.send("Doctors Portal's Server is Running");
});
app.listen(port, () => {
  console.log("Running on port", port);
});
