if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
  }
  
const Listing = require("../Models/Listings");
const initData = require("../init/data");
const mongoose = require("mongoose");
let DB_Url = process.env.ATLAS_DB_URL;

main()
  .then(() => {
    console.log("connection succesfull");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(DB_Url);
}

async function initDB() {
    let data = initData.data;
    try {
        // Optionally delete existing documents
       await Listing.deleteMany({});

        // Bulk insert documents
        const result = await Listing.insertMany(data);
        console.log(result);

        console.log("Data insertion complete.");
    } catch (err) {
        console.error("Error during data insertion:", err);
    }
}


initDB();
