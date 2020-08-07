//jshint esversion:6
//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
//const encrypt = require('mongoose-encryption');    for level 2 .env encryption
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const emailExistence = require("email-existence");
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate=require('mongoose-findorcreate')
const app = express();
//const md5 = require ("md5");
const bcrypt= require ("bcrypt");
const saltRounds=10;
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(session({   //saves user login sessions
  secret: "Out secret file",
  resave : false,
  saveUninitialized: false
}))
var temp=[];
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser: true});

mongoose.set("useCreateIndex",true); // to use any third part package like passport
const userSchema=new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});
const dataSchema=new mongoose.Schema({
  email: String
})
console.log(process.env.API_KEY);//our key
//userSchema.plugin(encrypt,{secret:process.env.SECRET,encryptedFields:["password"]});
//plugin for level 2 security .env file

//passport plugins
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const Data= new mongoose.model("Data",dataSchema);
const User = new mongoose.model("User",userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {  // serialise or desralise not just for local but for all type of requests
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"//to prevent form google+ deprecation
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);//we recieve back the profile
    User.findOrCreate({ googleId: profile.id }, function (err, user) { // find in db or create new
      return cb(err, user);
    });
  }
));
app.get("/",function(req,res){
  res.render("home");
})

app.get("/auth/google",

    passport.authenticate("google", {scope:['profile']}) // use passport to requst google to authentcate and return the profile of that individual

)
app.get('/auth/google/secrets',  //once authenticated google sends back data
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });
app.get("/login",function(req,res){
  res.render("login");
})
app.get("/register",function(req,res){
  res.render("register");
})
app.get("/secrets",function(req,res){
  console.log(temp[0]);
  var neww= temp[0];
  if(req.isAuthenticated()){
    res.render('secrets',{foundornot:temp,newt: neww});
  }
  else{
    res.redirect('/login');
  }
  temp=[];
})
app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
})
app.get("/submit",function(req,res){
if(req.isAuthenticated()){ // if not logged in
  res.render("submit");
}
else{
  res.redirect("/login");
}

})
app.post("/register",function(req,res){
////////////////////Code with passport////////////////////////////////////
User.register({username: req.body.username},req.body.password,function(err,user){
  if(err){
    console.log(err);
    res.redirect("/register");
  }
  else{
    passport.authenticate("local")(req,res,function(){
      res.redirect("/secrets");
    })
  }
})
  //Code for general level of authentication////////////////////////////////
//  bcrypt.hash(req.body.password,saltRounds,function(err,hash){//for bcrypt and salting for 10 rounds
//    const newUser= new User({
//      email: req.body.username,
    //  password:md5(req.body.password)  //saves hash of the string of password
//      password:hash
//    });
//    newUser.save(function(err)
//    {
//    if(err)
//    {
//      console.log(err);
//    }
//    else{
//      res.render("secrets");
//    }
//    })


//  })

})
app.post("/submit",function(req,res){
  const submittedSecret = req.body.secret;
// we need to find the current user and save the data in his file.
  console.log(req.user.id); // this saves the user details the id in DB
//User.findByID(req.user.id,function(err,foundUser){
//  if(err)
//  {
//    console.log(err);
//  }
//  else{
//    if(foundUser)
//    {
//      foundUser.secret=submittedSecret;
//      foundUser.save(function(){
//        res.redirect("/secrets");
//      })

//    }
//  }
//})
Data.findOne({email:submittedSecret},function(err,foundUser){
   if(err){
     console.log(err);
  }
    else{
      if(foundUser)
      {
           console.log("found");
           temp.push(submittedSecret);
           res.redirect("/secrets");
        }
      else{
          console.log("Lets check");
          emailExistence.check(submittedSecret, function(error, response){
    if(err)
    {
      console.log(err);
    }
    else{
      if(response)
      {
        console.log("Valid");
        const newData= new Data({
          email: submittedSecret,
        });
        temp.push(submittedSecret);
            newData.save(function(err)
            {
            if(err)
            {
        console.log(err);
           }
           else{
             res.redirect("/secrets");
            }
            })
      }
      else{
        console.log('invalid');
        temp.push('Invalid');
        res.redirect("/secrets");
      }

    }
});
      }
      }
})
})
app.post("/login",function(req,res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
      });
    }
  });
})
/////////////////Till hashing and salting//////////////////////////////////////
//  const username=req.body.username;
//  const password  =md5(req.body.password);//hashes the string and later matches the hash
//const password=req.body.password;
//  User.findOne({email:username},function(err,foundUser){
//    if(err){
//      console.log(err);
  //  }
  //  else{
  //    if(foundUser){
  //    //  if(foundUser.password===password){ // general comaparison
//      bcrypt.compare(password,foundUser.password,function(err,result){
//if(result===true){
//    res.render("secrets");
//}
//      })
//      //  }
//      }
//    }
//  })

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
