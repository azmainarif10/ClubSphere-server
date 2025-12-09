const express = require("express")
const app = express()
const cors = require("cors")
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const PORT=3000;
app.use(express.json())
app.use(cors())


const stripe = require('stripe')(process.env.Stipe_Key);
 const YOUR_DOMAIN="http://localhost:5173";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ae.lom2zra.mongodb.net/?appName=aE`;




 

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


 async function run(){


    try{

          // await client.connect()
          // await client.db("billdb").command({ping:1})
     console.log("Pinged your deployment. You successfully connected to MongoDB!");
     
     
     app.listen(PORT ,()=>{
        
        console.log(`Express Server is running on http://localhost:${PORT}`);

     })

     app.post("/users", async(req,res)=>{
        const user = req.body
        user.role ="member"
        user.createdAt = new Date()
          const db =  client.db("Club")
       
   const userCollection = db.collection("users")
      const exists = await userCollection.findOne({ email: user.email });

     if (exists) {
        return res.send({ inserted: false });  
    }
   const result = await userCollection.insertOne(user)
   res.send(result)

     })

      app.get("/clubs", async(req,res)=>{
        
        const { search = "", category = "" } = req.query;

    let query = {};

    if (search) {
      query.clubName = { $regex: search, $options: "i" }; 
    }

    if (category) {
      query.category = category;
    }



          const db =  client.db("Club")
          const clubCollection = db.collection("clubs")
    const result = await clubCollection.find(query).toArray()
    res.send(result)

     })
     app.get("/clubs/:id", async(req,res)=>{
        
       const id =req.params.id

    const db =  client.db("Club")
    const clubCollection = db.collection("clubs")
    const result = await clubCollection.findOne({_id:new ObjectId(id)})
    res.send(result)

     })

      app.post("/memberships", async(req,res)=>{
        
       const memberShip= req.body
       memberShip.joinedAt = new Date()

    const db =  client.db("Club")
    const memberShipCollection = db.collection("memberships")
    const result = await memberShipCollection.insertOne(memberShip)
    res.send(result)

     })

    }catch(error){
       console.log(error)
    }
    
  app.post('/create-checkout-session', async (req, res) => {
    const clubInfo = req.body
     const amount = parseInt(clubInfo.cost *100)
  const session = await stripe.checkout.sessions.create({
   
        line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: clubInfo.clubName,
            }
          },
          quantity: 1   
        }
      ],
   
     metadata:{
       clubId:clubInfo.clubId
    },
    customer_email:clubInfo.email,
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
  });

   res.send({ url :session.url})
});

 app.get("/payment-success",async(req,res)=>{
 const sessionId = req.query.session_id;

  const db = client.db("Club");

  const memberShipCollection = db.collection("memberships")

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return res.status(400).send({ error: "Payment not completed" });
  }

  const existing = await memberShipCollection.findOne({
    clubId: session.metadata.clubId,
    userEmail: session.customer_email
  });
 
  if (existing) {
    return res.status(200).send({ message: "Payment already recorded" });
  }


  const paidMemberShip ={
      userEmail: session.customer_email,
      clubId: session.metadata.clubId,
      status: "active",
    
      joinedAt: new Date(),
      paymentId: session.payment_intent, 
      amount: session.amount_total / 100,     
  }
   
  

  const paid = await memberShipCollection.insertOne(paidMemberShip)
  res.send(paid);
 
  })

 app.get("/events", async (req, res) => {
  const { search, category, sort } = req.query;

    const db =  client.db("Club")
    const eventsCollection = db.collection("events")
  let query = {};

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  if (category) {
    query.category = category;
  }

  let sorting = { createdAt: -1 }; 

  if (sort === "oldest") sorting = { createdAt: 1 };
  if (sort === "date") sorting = { eventDate: 1 };

  const events = await eventsCollection.find(query).sort(sorting).toArray();

  res.send(events);
});

  app.get("/events/:id", async(req,res)=>{
        
       const id =req.params.id

       const db =  client.db("Club")
    const eventsCollection = db.collection("events")
    const result = await eventsCollection.findOne({_id:new ObjectId(id)})
    res.send(result)

     })

     app.post('/event/create-checkout-session', async (req, res) => {
    const eventInfo = req.body
     const amount = parseInt(eventInfo.cost *100)
  const session = await stripe.checkout.sessions.create({
   
        line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: eventInfo.title,}
          },
          quantity: 1   
        }
      ],
   
     metadata:{
       eventId:eventInfo.eventId
    },
    customer_email:eventInfo.email,
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
  });

   res.send({ url :session.url})
});
 
app.get("/event/payment-success",async(req,res)=>{
 const sessionId = req.query.session_id;

  const db = client.db("Club");
  const eventsCollection = db.collection("events");

  const eventRegisterCollection = db.collection("eventRegistrations")

  
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return res.status(400).send({ error: "Payment not completed" });
  }

  const event = await eventsCollection.findOne({
    _id: new ObjectId(session.metadata.eventId)
  });

  if (!event) {
    return res.status(404).send({ error: "Event not found" });
  }
  const existing = await eventRegisterCollection.findOne({
    eventId: session.metadata.eventId,
    userEmail: session.customer_email
  });
 
  if (existing) {
    return res.status(200).send({ message: "Payment already recorded" });
  }


  const paidEventShip ={
      userEmail: session.customer_email,
      eventId: session.metadata.eventId,
    
      clubId: event.clubId,
      status: "registered",
      joinedAt: new Date(),
      eventPaymentId: session.payment_intent, 
      amount: session.amount_total / 100,     
  }
   
  

  const paid = await eventRegisterCollection.insertOne(paidEventShip)
  res.send(paid);
 
  })
 
 }
run().catch(console.dir);