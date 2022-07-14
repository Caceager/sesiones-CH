const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const { faker } = require('@faker-js/faker');
const { mensajes: Mensajes} = require('./mensajes.js');
const { container: Container} = require('./productos.js');
const mongoose = require("mongoose");
const session = require ('express-session');
const { engine } = require('express-handlebars');
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");

function crearProductoFake(){
    return{
        title: faker.commerce.productName(),
        price: faker.commerce.price(100, 2000),
        url: faker.image.technics(50, 50,  true),
    }
}

function crearProductos(){
    const productos = [];
    for(let i = 0; i <5; i++){
        productos.push(crearProductoFake())
    }
    return productos;
}

async function ConectarMongo() {
    console.log('Iniciando conexion a mongodb');
    try{
        await mongoose.connect('mongodb://localhost:27017/entregables', {
            useNewUrlParser: true
        });
        console.log('Conexion a mongodb completada.');
    }
    catch(err){
        console.log(err);
    }
}
ConectarMongo();

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const server = http.createServer(app);
const io = socketio(server);



const container = new Container();
const mensajes = new Mensajes();

app.use(cookieParser());
app.use(express.static('public'));

const advancedOptions = {useNewUrlParser: true, useUnifiedTopology: true};
app.use(session({
    store: MongoStore.create({
        mongoUrl: "mongodb+srv://agustinMongoCH:mongoCH@cluster0.fwdkeuy.mongodb.net/?retryWrites=true&w=majority",
        mongoOptions: advancedOptions,
    }),
    secret: 'secreto',
    resave: true,
    cookie: {maxAge: 600000}, //Expira en 10 minutos
    saveUninitialized: true
}));

const port = 8081;

io.on('connection', (socket) =>{
    console.log('conexion');

    container.cargar_productos().then( (prods) =>{
        io.sockets.emit('productos', prods);
    })

    mensajes.cargar_mensajes().then((mensaje) => {
        io.sockets.emit('mensajes', mensaje);
    });

    socket.on('nuevo producto', (producto) =>{
        container.guardar_producto(producto).then( ()=>{
           container.cargar_productos().then( (prods) =>{
             io.sockets.emit('productos', prods);
           })
        });
    })

    socket.on('cargarMensajes', ()=>{
        mensajes.cargar_mensajes().then((mensaje) => {
            io.sockets.emit('mensajes', mensaje);
        });
    })

    socket.on('nuevo mensaje', (mensaje) =>{
        mensajes.guardar_mensajes(mensaje).then(() =>{
            mensajes.cargar_mensajes().then((mens)=>{
                io.sockets.emit('mensajes', mens);
            });
        });
    });
});

app.get("/api/productos-test", (req, res)=>{
   res.send(crearProductos());
});

app.get("/", (req, res)=>{
    if(req.session.nombre){
        console.log("Se ha conectado "+req.session.nombre);
        res.render("main", {name: req.session.nombre});
    }
    else{
        res.redirect("/login");
    }
});

app.engine(
    "hbs",
    engine({
        extname: ".hbs",
        layoutsDir: __dirname+"/views",
    })
);

app.set("view engine", "hbs");
app.set("views", "./views");


app.get("/login", (req, res) =>{
    if(!req.session.nombre){
        res.sendFile(__dirname+"/public/login.html");
    }
    else{
        res.redirect("/");
    }

});

app.post("/logout", (req, res) =>{
    res.redirect("/logout");
});

app.get("/logout", (req, res) => {
    res.render("logout.hbs", {name: req.session.nombre, layout: false});
    req.session.destroy();
});


app.post("/login", (req, res) =>{
    req.session.nombre = req.body.nombre;
    res.redirect("/");
});

server.listen(port, ()=>{
    console.log(`Server started on port ${port}`);
});