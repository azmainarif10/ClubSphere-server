const express = require("express")
const app = express()
const cors = require("cors")
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const PORT=3000;
app.use(express.json())
app.use(cors())




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

    }catch(error){
       console.log(error)
    }
    







 }
run().catch(console.dir);