const cloudinary = require("cloudinary").v2;
const {CloudinaryStorage} = require("multer-storage-cloudinary");

cloudinary.config({
    cloud_name : process.env.CLOUD_NAME,
    api_key : process.env.CLOUD_APK_KEY,
    api_secret : process.env.CLOUD_API_SECRET,
});

console.log(cloudinary.config);

const storage = new CloudinaryStorage({
    cloudinary : cloudinary,
    params : {
        folder : "project",
        allowedFormats :  ["png","jpg","jpeg"]
    }
});


module.exports = {
    cloudinary,
    storage,
}