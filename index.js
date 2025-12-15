const express = require("express")
const app = express()
const cors = require("cors")
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const PORT=3000;
app.use(express.json())
app.use(cors())


const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FireBase_Token, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const stripe = require('stripe')(process.env.Stipe_Key);
 const YOUR_DOMAIN="http://localhost:5173";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ae.lom2zra.mongodb.net/?appName=aE`;


const verifyFireToken = async (req,res,next)=>{

 const authorization = req.headers.authorization
  if(!authorization){
  return  res.status(403).send({message:"unauthorized access"})
  }
const token = authorization.split(' ')[1]
   if(!token){
    return res.status(403).send({message:"unauthorized access"})
  }
  
    try{
   const decoded = await admin.auth().verifyIdToken(token)
     req.token_email = decoded.email
          next()
    }catch(error){
             console.error("Firebase Token Verification Error:", error.code, error.message);
        return res.status(401).send({ 
            message: "Unauthorized: Invalid or expired token.",
            error_code: error.code 
        });
        }



 }

 
 const verifyRole = (role) => {
  return async (req, res, next) => {

    const db = req.app.locals.db;
    const email = req.token_email;

    const user = await db.collection("users").findOne({ email });

    if (!user || user.role !== role) {
      return res.status(403).send({ error: "Forbidden access" });
    }

    next();
  };
};


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
     
     app.locals.db = client.db("Club");

     app.listen(PORT ,()=>{
        
        console.log(`Express Server is running on http://localhost:${PORT}`);

     })

 app.get("/users", async(req,res)=>{
      
          const db =  client.db("Club")
       
   const userCollection = db.collection("users")
     
   const result = await userCollection.find({}).toArray()
   res.send(result)

     })
  
      app.get("/admin/clubs", verifyFireToken, verifyRole("admin"), async (req, res) => {
  const db = client.db("Club");
  const clubCollection = db.collection("clubs");

  const allClubs = await clubCollection.find({}).toArray(); 
  res.send(allClubs);
});


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

    let query = {status: "approved" };

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
        const db =  client.db("Club")
    const memberShipCollection = db.collection("memberships")
              const clubCollection = db.collection("clubs")

              const memberShip= req.body

           
              
     if (club.membershipFee === 0) {
    await clubCollection.updateOne(
      { _id: club._id },
      { $inc: { memberCount: 1 } }
    );
  }
   
  
   
   
    res.send(result)

     })

    }catch(error){
       console.log(error)
    }
    
 app.get("/memberships", async(req,res)=>{
      
  const userEmail = req.query.email
    const db =  client.db("Club")
  const memberships = await db.collection("memberships").find({userEmail}).toArray();
  const clubs = await db.collection("clubs").find().toArray();

    const result = memberships.map((m) => {
    const club = clubs.find((c) => c._id.toString() === m.clubId);

    return {
      ...m,
      clubName: club?.clubName || "Unknown",
      location: club?.location || "Unknown",
    };
  });
    res.send(result)

     })

  app.post('/create-checkout-session', verifyFireToken, async (req, res) => {
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
  const paymentRecord = db.collection("payments")
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
   
 const payment = {
 userEmail: session.customer_email,
 amount: session.amount_total / 100,
 type: "membership",
 clubId: session.metadata.clubId,
 status: "paid",
 createdAt: new Date(),
  transactionId: session.payment_intent,
}
  await db.collection("clubs").updateOne(
  { _id: new ObjectId(session.metadata.clubId) },
  { $inc: { memberCount: 1 } } 
);
  const record = await paymentRecord.insertOne(payment)
  const paid = await memberShipCollection.insertOne(paidMemberShip)
  res.send(paid,record);
 
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

 app.get("/manager/events", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const { managerEmail } = req.query;

    const db =  client.db("Club")
     const clubs = await db.collection("clubs").find({ managerEmail }).toArray();
     const clubIds = clubs.map(c => c._id.toString());

   
 
   const events = await db.collection("events").find({clubId: { $in: clubIds }}).toArray();

  const result = events.map(event => ({
    ...event,
    clubName: clubs.find(c => c._id.toString() === event.clubId)?.clubName || "Unknown"
  }));

  res.send(result);
});

  app.get("/events/:id", async(req,res)=>{
        
       const id =req.params.id

       const db =  client.db("Club")
    const eventsCollection = db.collection("events")
    const result = await eventsCollection.findOne({_id:new ObjectId(id)})
    res.send(result)

     })

     app.post('/event/create-checkout-session', verifyFireToken, async (req, res) => {
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
       eventId:eventInfo.eventId,
       clubId:eventInfo.clubId,
    },
    customer_email:eventInfo.email,
    mode: 'payment',
  success_url: `${YOUR_DOMAIN}/event/payment-success?session_id={CHECKOUT_SESSION_ID}`,
  });

   res.send({ url :session.url})
});
 
app.get("/event/payment-success",async(req,res)=>{
 const sessionId = req.query.session_id;

  const db = client.db("Club");
  const eventsCollection = db.collection("events");

  const eventRegisterCollection = db.collection("eventRegistrations")
    const paymentRecord = db.collection("payments")

  
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
    
      clubId:session.metadata.clubId ,
      status: "registered",
      joinedAt: new Date(),
      eventPaymentId: session.payment_intent, 
      amount: session.amount_total / 100,     
  }
   
  const payment = {
 userEmail: session.customer_email,
 amount: session.amount_total / 100,
 type: "event",
 eventId: session.metadata.eventId,
 status: "paid",
 createdAt: new Date(),
  transactionId: session.payment_intent,
}
    const record = await paymentRecord.insertOne(payment)

  const paid = await eventRegisterCollection.insertOne(paidEventShip)
  res.send(paid,record);
 
  })
 
   app.post("/event-registered", async(req,res)=>{
        
       const register= req.body
       register.joinedAt = new Date()
   
     const db =  client.db("Club")
      const eventRegisterCollection = db.collection("eventRegistrations")

    const result = await eventRegisterCollection.insertOne(register)
    res.send(result)

     })

    
    app.get("/user/:email/role",  async(req,res)=>{


  const email = req.params.email ;

   const db = client.db("Club")
  const userCollection = db.collection("users")
 
       const user = await userCollection.findOne({email:email});

   res.send({ role : user?.role || "users"})


  })

 app.patch("/user/update-role/:id",  verifyFireToken, verifyRole("admin"), async(req,res)=>{

  const id = req.params.id
    const { role } = req.body;
  const db = client.db("Club")
 
   const userCollection = db.collection("users")

   
 
  const result = await userCollection.updateOne({_id:new ObjectId(id)},{$set:{role}})
   res.send(result)

  })

  app.patch("/club/update-status/:id", verifyFireToken, verifyRole("admin"), async(req,res)=>{

  const id = req.params.id
    const { status } = req.body;
  const db = client.db("Club")
 
  const clubCollection = db.collection("clubs")
  const result = await clubCollection.updateOne({_id:new ObjectId(id)},{$set:{status}})
   res.send(result)

  })

app.get("/payments", verifyFireToken, verifyRole("admin"), async (req, res) => {
 
  const db = client.db("Club");
     
   const paymentRecord = db.collection("payments")

  const allPayments= await paymentRecord.find({}).toArray()

    res.send(allPayments);
 
});


 app.get("/admin/data", verifyFireToken,verifyRole("admin"), async (req, res) => {
  try {
    const db = client.db("Club");

    const users = await db.collection("users").find().toArray();
    const clubs = await db.collection("clubs").find().toArray();
    const memberships = await db.collection("memberships").find().toArray();
    const events = await db.collection("events").find().toArray();
    const payments = await db.collection("payments").find().toArray();

    res.send({users,clubs,memberships,events,payments});
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Failed to load admin data" });
  }
});

 app.get("/member/my-events", async (req, res) => {
  const userEmail = req.query.email; 
  const db = client.db("Club");

  const eventRegs = await db.collection("eventRegistrations").find({ userEmail }).toArray();

  const clubs = await db.collection("clubs").find().toArray();
  const events = await db.collection("events").find().toArray();

  const result = eventRegs.map((reg) => {
    const event = events.find((e) => e._id.toString() === reg.eventId);
    const club = clubs.find((c) => c._id.toString() === reg.clubId);

    return {
      ...reg,
      eventTitle: event?.title || "Unknown",
      eventDate: event?.eventDate || new Date(),
      clubName: club?.clubName || "Unknown",
    };
  });

  res.send(result);
});

app.get("/my-payments", async (req, res) => {
  const userEmail = req.query.email; 
  const db = client.db("Club");

  const myPays = await db.collection("payments").find({ userEmail }).toArray();

  const clubs = await db.collection("clubs").find().toArray();
  
  const result = myPays.map((reg) => {
   
    const club = clubs.find((c) => c._id.toString() === reg.clubId);

    return {
      ...reg,
     
      clubName: club?.clubName || "Unknown",
    };
  });

  res.send(result);
});


app.get("/my-clubs", async (req, res) => {
  const email = req.query.email;
  const db = client.db("Club")
  const clubCollection = db.collection("clubs")

  const result = await clubCollection.find({ managerEmail: email }).toArray();
  res.send(result);
});

app.post("/clubs", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const db = client.db("Club")
 const clubCollection = db.collection("clubs") 

   const club = {
    ...req.body,
    memberCount: 0,       
    createdAt: new Date()
  };

  const result = await clubCollection.insertOne(club);
  res.send(result);
});

app.patch("/clubs/:id", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const id = req.params.id;
  console.log(id)
  const db = client.db("Club")
  const update = req.body
  console.log(update)
  const clubCollection = db.collection("clubs")

  const result = await clubCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
  res.send(result);
});

app.delete("/clubs/:id", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const id = req.params.id;
  const db = client.db("Club")
  const clubCollection = db.collection("clubs")

  const result = await clubCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

 app.patch("/manager/events/:id", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const id = req.params.id;
  const db = client.db("Club")
  const update = req.body
     const eventsCollection = db.collection("events")

  const result = await eventsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
  res.send(result);
});

app.delete("/manager/events/:id", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const id = req.params.id;
  const db = client.db("Club")
  const eventsCollection = db.collection("events")

  const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});
 app.get("/manager/club-members",  verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const managerEmail = req.query.email;
  const db = client.db("Club");

  const clubs = await db.collection("clubs").find({ managerEmail }).toArray();
  const clubIds = clubs.map(c => c._id.toString());

  const memberships = await db.collection("memberships").find({ clubId: { $in: clubIds } }).toArray();

 
  const result = memberships.map(m => ({
    _id: m._id,
    memberEmail: m.userEmail,
    clubName: clubs.find(c => c._id.toString() === m.clubId)?.clubName || "Unknown",
    status: m.status,
    joinedAt: m.joinedAt
  }));

  res.send(result);
});

 app.patch("/membership/:id/status", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const db = client.db("Club");

  const result = await db.collection("memberships").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );
  res.send(result);
});


 app.get("/manager/event-registration", verifyFireToken, verifyRole("clubManager"), async(req,res)=>{
      const managerEmail = req.query.email;

    const db =  client.db("Club")
    const clubs = await db.collection("clubs").find({ managerEmail }).toArray();
  const clubIds = clubs.map(c => c._id.toString());

  const events = await db.collection("events").find({ clubId: { $in: clubIds } }).toArray();
  const eventIds = events.map(c => c._id.toString());
   const eventRegister  = await db.collection("eventRegistrations").find({ eventId: { $in: eventIds } }).toArray();
 
   const result = eventRegister.map(m => ({
    _id: m._id,
    memberEmail: m.userEmail,
    clubName: clubs.find(c => c._id.toString() === m.clubId)?.clubName || "Unknown",
    status: m.status,
    joinedAt: m.joinedAt
  }));
  
  res.send(result)
 })

 app.get("/manager/overview", verifyFireToken, verifyRole("clubManager"), async (req, res) => {
  const managerEmail = req.query.email;
  const db = client.db("Club");

  try {
    const clubs = await db
      .collection("clubs")
      .find({ managerEmail })
      .toArray();

    const clubIds = clubs.map(c => c._id.toString());

    const totalMembers = await db.collection("memberships").countDocuments({ clubId: { $in: clubIds } });

    const totalEvents = await db.collection("events").countDocuments({ clubId: { $in: clubIds } });

    const payments = await db.collection("payments").find({ clubId: { $in: clubIds } }).toArray();

    const totalRevenue = payments.reduce( (sum, p) => sum + (p.amount || 0), 0);

    res.send({
      totalClubs: clubs.length,
      totalMembers,
      totalEvents,
      totalRevenue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Server Error" });
  }
});
 
 app.get("/home/clubs/featured", async (req, res) => {
  const db = client.db("Club");

  const clubs = await db.collection("clubs").find({ status: "approved" }).sort({ memberCount: -1 }) .limit(6).toArray();

  res.send(clubs);
});



 }
run().catch(console.dir);