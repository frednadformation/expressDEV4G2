//imports libraries
var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended : false }));

// var path = require('path');
require('dotenv').config();

//Ce qui permet d'envoyer et de recuperer des données
var cors = require('cors');
app.use(cors({credentials: true, origin: process.env.FRONTEND_URL}));


var mongoose = require('mongoose');

const url = process.env.DATABASE_URL;

mongoose.connect(url)
.then(console.log("Mongodb connected"))
.catch(err => console.log(err));

app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));

const methodOverride = require('method-override');
app.use(methodOverride("_method"));

const bcrypt = require('bcrypt');

const cookieParser = require('cookie-parser');

app.use(cookieParser());

const {createTokens, validateToken} = require('./JWT');

const { jwtDecode } = require('jwt-decode');

//Partie Sécurité

const toobusy = require('toobusy-js');//Attaque Deni de service

app.use(function(req, res, next) {
    if(toobusy()){
        res.status(503).send("Server too busy");
    }
    else{
        next();
    }
});

const session = require('express-session');
const svgcaptcha = require('svg-captcha');

app.use(
    session({
        secret : "my-secret-key",
        resave: false,
        saveUninitialized : true
    })
)

app.get('/captcha', (req, res) =>{
    const options = {
        size: 5
    }
    const captcha = svgcaptcha.create(options);

    req.session.captcha = captcha.text;

    res.type('svg');
    res.status(200).send(captcha.data);

})

app.post('/verify', (req, res) =>{
    const {userInput} = req.body.captcha;

    if(userInput === req.session.captcha){
        res.status(200).send("Captcha is valid");
    }
    else{
        res.status(400).send("Captcha is invalid");
    }
})

//Injection parametre http
const hpp = require('hpp');

app.use(hpp());

//entete sécurisée
const helmet = require("helmet");

app.use(helmet());

//Cache control
const nocache = require('nocache');

app.use(nocache());

//models
//Partie Contact
var Contact = require('./models/Contact');



app.get('/',validateToken, function(req, res) {
    Contact.find().then( data => {
        console.log(data);
        // res.render('Home', {data: data});
        res.json(data);
    }).catch(err => console.log(err));
})

app.get('/formulaire', function(req, res) {
    res.render('Formulaire');
});

app.post('/submit-form-data', function(req, res) {
    const Data = new Contact({
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        email : req.body.email,
        message : req.body.message
    })
    Data.save()
    .then(() =>{
        console.log("Data saved !");
        res.redirect(process.env.FRONTEND_URL);
    })
    .catch(err => console.log(err));
});

app.get('/formulaire/:id', function(req, res){
    //affiche une donnée en fonction de l'id en parametre
    Contact.findOne({
        _id : req.params.id
    }).then(data =>{
        // res.render('Edit', {data:data})
        res.json(data);
    })
    .catch(err => console.log(err));
})

//Mise a jour de ma donnée : Edit
app.put('/edit/:id', function(req, res){
    const Data = {
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        email : req.body.email,
        message : req.body.message
    }
    Contact.updateOne({_id : req.params.id}, {$set:Data})
    .then(data =>{
        console.log("Donnée mise à jour :");
        console.log(data);
        res.redirect(process.env.FRONTEND_URL +'/allcontacts/');
    })
    .catch(err =>{console.log(err);})
});

//Suppression d'un contact avec l'id
app.delete('/delete/:id', function(req, res) {
    Contact.findOneAndDelete({_id:req.params.id})
    .then(() =>{
        console.log("Donnée supprimée.");
        res.redirect(process.env.FRONTEND_URL +'/allcontacts/');
    })
    .catch(err =>{console.log(err);});
});

//Partie Blog

var Post = require('./models/Post');
//Read (Lire toutes les posts)
app.get('/allposts', function(req, res) {
    Post.find().then(data =>{
        console.log(data);
        // res.render('AllPosts' , {data: data});
        res.json(data);
    })
    .catch(err =>{console.log(err)});
});

app.get('/formulairepost', function(req, res) {
    res.render('FormulairePost');
});

app.get('/post/:id', function(req, res) {
    Post.findOne({_id: req.params.id})
    .then(data =>{
        res.render('EditPost', {data: data});
    })
    .catch (err =>{console.log(err)});
});

//Create (Créer un post)
app.post('/nouveaupost', function(req, res) {
    const Data = new Post({
        titre : req.body.titre,
        auteur : req.body.auteur,
        description : req.body.description
    })
    Data.save()
    .then(() =>{
        console.log("Post saved");
        res.redirect('/allposts')
    })
    .catch(err => {console.log(err);})
});

//Update (Mise à jour d'un post)
app.put('/editPost/:id', function(req, res) {
    const Data = 
    {
        title : req.body.title,
        auteur : req.body.auteur,
        description : req.body.description
    }
    Post.updateOne({_id : req.params.id}, {$set: Data})
    .then(() => {
        console.log("Post updated successfully");
        res.redirect('/allposts');
    })
    .catch((err) => {console.log(err);});
});

//delete (Suppression d'un post)
app.delete('/deletePost/:id', function(req, res) {
    Post.findOneAndDelete({_id : req.params.id})
    .then(()=>{
        console.log("Post deleted successfully");
        res.redirect('/allposts');
    })
    .catch((err) => {console.log(err);});
});

//Partie User

var User = require('./models/User');

app.post('/api/inscription', function(req, res) {

    var mdpLength = Object.keys(req.body.password).length

    // if(mdpLength < 12){
    //     return res.status(404).send("Password too short")
    // }
    
    const Data = new User({
        username : req.body.username,
        email : req.body.email,
        password : bcrypt.hashSync(req.body.password, 10),
        admin : req.body.admin
    })
    Data.save()
    .then(()=>{
        console.log("User saved");
        res.redirect(process.env.FRONTEND_URL+'/connexion/');
    })
    .catch((err) => {console.log(err);});
});

app.get('/forminscription', function(req, res) {
    res.render('Inscription');
});

app.get('/connexion', function(req, res) {
    res.render('Connexion');
});

app.post('/api/connexion', function(req, res) {
    User.findOne({
        username : req.body.username
    })
    .then(user =>{
        if(!user){
            return res.status('404').send('No user found');
        }

        console.log(user);
        if(!bcrypt.compareSync(req.body.password, user.password)){
            return res.status('404').send('Invalid password !!');
        }

        const accessToken = createTokens(user);
        res.cookie("accessToken", accessToken,{
            maxAge: 1000 * 60 * 60 * 24 * 30, //30 jours
            httpOnly: true
        })

        res.json('LOGGED IN');
        // res.render('UserPage', {data : user});
    })
    .catch(err => console.log(err));
});

//Deconnexion
app.get('/logout', (req, res) => {
    res.clearCookie("accessToken");
    res.redirect(process.env.FRONTEND_URL);
});

//Get JWT : mettre a disposition le JWT  a mon client

app.get('/getJWT', (req, res) => {
    res.json(jwtDecode(req.cookies.accessToken))
});





var server = app.listen(5000, function () {
    console.log("Node server is listening on port 5000");
});
