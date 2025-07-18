const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');  // Importar sequelize desde el archivo config/database.js
const User = require('./models/userModel');  // Importar el modelo User
const Product = require('./models/productModel');  // Importar el modelo Product
const app = express();
const port = 3000;

// Configuración de express-session
app.use(session({
  secret: 'secreta_clave_de_sesion',
  resave: false,
  saveUninitialized: true
}));

// Servir archivos estáticos (CSS, imágenes, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para procesar formularios POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuración de multer para manejar la subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const fileName = Date.now() + '-' + file.originalname;
    cb(null, fileName);
  }
});
const upload = multer({ storage: storage });
// Ruta de inicio
app.get('/', (req, res) => {
  res.render('home', { isAdmin: req.session.isAdmin || false });  // Renderiza la vista home.ejs
});


// Ruta de registro (GET)
app.get('/register', (req, res) => {
  res.render('register');  // Renderiza la vista de registro
});

// Ruta para mostrar el formulario de inicio de sesión
app.get('/login', (req, res) => {
  res.render('login');  // Asegúrate de que esta vista esté en la carpeta 'views'
});

// Ruta para procesar el registro
// Ruta para procesar el registro
app.post('/registrarme', async (req, res) => {
  const { username, password, role } = req.body;

  try {
    // Verificar si el nombre de usuario ya está en uso
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).send('El nombre de usuario ya está en uso');
    }

    // Encriptar la contraseña antes de guardarla
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear el nuevo usuario
    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role || 'user',  // Asignar el rol
    });

    res.redirect('/login');  // Redirige a la página de login después de registrar
  } catch (error) {
    res.status(500).send('Error al registrar el usuario');
  }
});
// Ruta para ver todos los productos (libros) en /verLibros
// Ruta para ver todos los productos (libros)
app.get('/verLibros', async (req, res) => {
  try {
    const products = await Product.findAll();  // Obtener los productos desde la base de datos
    res.render('verLibros', { products });  // Renderiza la vista 'verLibros' y pasa los productos
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al cargar los libros');
  }
});

// Ruta para obtener todos los libros en formato JSON
app.get('/api/books', async (req, res) => {
  try {
    const books = await Product.findAll();  // Obtiene los productos (libros) de la base de datos
    res.json(books);  // Devuelve los libros en formato JSON
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al cargar los libros');
  }
});

// Ruta para mostrar los productos disponibles para préstamo
app.get('/prestamo', async (req, res) => {
  try {
    const products = await Product.findAll();  // Obtener todos los productos (libros) desde la base de datos
    res.render('prestamo', { products });  // Renderiza la vista 'prestamo' y pasa los productos
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al cargar los productos');
  }
});



app.post('/', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Buscar al usuario en la base de datos
    const user = await User.findOne({ where: { username } });
    if (user && bcrypt.compareSync(password, user.password)) {
      // Si el usuario existe y la contraseña es correcta, establecer la sesión
      req.session.isAdmin = user.role === 'admin';  // Si el usuario es admin, se establece 'isAdmin'
      res.redirect('/manageProducts');  // Redirigir al área de administración
    } else {
      res.status(400).send('Credenciales incorrectas');
    }
  } catch (error) {
    res.status(500).send('Error al autenticar el usuario');
  }
});



// Ruta para procesar el inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;  // Recibe los datos del formulario
  console.log()

  try {
    // Buscar al usuario en la base de datos
    const user = await User.findOne({ where: { username } });

    if (user) {
      // Comparar la contraseña cifrada con la ingresada por el usuario
      const isMatch = bcrypt.compareSync(password, user.password);  // Comparar la contraseña

      if (isMatch) {
        req.session.isAdmin = user.role === 'admin';  // Si el usuario es admin, se establece 'isAdmin'
        req.session.username = username;  // Guardar el nombre de usuario en la sesión

        // Redirigir dependiendo del rol del usuario
        if (user.role === 'admin') {
          return res.redirect('/manageProducts');  // Redirigir a la página de administración si es admin
        } else {
          return res.redirect('/bienvenido');  // Redirigir a la página de bienvenida si no es admin
        }
      } else {
        return res.status(400).send('Credenciales incorrectas');  // Contraseña incorrecta
      }
    } else {
      return res.status(400).send('Credenciales incorrectas');  // Usuario no encontrado
    }
  } catch (error) {
    return res.status(500).send('Error al autenticar el usuario');
  }
});


// Ruta para la página de bienvenida
app.get('/bienvenido', (req, res) => {
  if (req.session.username) {  // Verificar si el usuario está logueado
    res.render('bienvenido', { username: req.session.username });  // Pasar el nombre de usuario a la vista
  } else {
    res.redirect('/login');  // Si no está logueado, redirigir al login
  }
});





// Ruta de logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Ruta para gestionar productos (solo para administradores)
app.get('/manageProducts', async (req, res) => {
  if (req.session.isAdmin) {  // Verificar si el usuario es admin
    const products = await Product.findAll();  // Obtener productos de la base de datos
    res.render('manageProducts', { products, isAdmin: req.session.isAdmin });  // Renderizar la vista de administración
  } else {
    res.redirect('/login');  // Si no es admin, redirigir a login
  }
});


// Ruta para agregar un nuevo producto (POST)
app.post('/addProduct', upload.single('image'), async (req, res) => {
  const { name, description, price } = req.body;
  const image = req.file ? req.file.filename : null;

  try {
    await Product.create({
      name,
      description,
      price,
      image,
    });
    res.redirect('/manageProducts');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al agregar el producto');
  }
});
// Ruta para mostrar el formulario de edición de un producto
// Ruta para editar un producto
app.get('/editProduct/:id', async (req, res) => {
  if (req.session.isAdmin) {  // Verificar si el usuario es admin
    const product = await Product.findByPk(req.params.id);  // Obtener el producto por su ID
    res.render('editProduct', { product, isAdmin: req.session.isAdmin });  // Pasar 'product' y 'isAdmin' a la vista
  } else {
    res.redirect('/login');  // Si no es admin, redirigir a login
  }
});


// Ruta para actualizar un producto
app.post('/editProduct/:id', upload.single('image'), async (req, res) => {
  const { name, description, price } = req.body;
  const productId = req.params.id;
  const image = req.file ? req.file.filename : null;  // Si se sube una imagen, la obtenemos

  try {
    const product = await Product.findByPk(productId);  // Buscar el producto por su ID
    if (!product) {
      return res.status(404).send('Producto no encontrado');
    }

    // Actualizar los datos del producto
    product.name = name;
    product.description = description;
    product.price = price;
    if (image) {
      product.image = image;  // Si hay una nueva imagen, la actualizamos
    }

    await product.save();  // Guardamos los cambios
    res.redirect('/manageProducts');  // Redirigir a la lista de productos
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al actualizar el producto');
  }
});
// Ruta para eliminar un producto
app.get('/deleteProduct/:id', async (req, res) => {
  const productId = req.params.id;  // Obtener el ID del producto desde la URL

  try {
    // Buscar el producto por su ID
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).send('Producto no encontrado');  // Si el producto no existe, enviar error
    }

    // Eliminar el producto
    await product.destroy();
    res.redirect('/manageProducts');  // Redirigir a la lista de productos después de eliminarlo
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al eliminar el producto');
  }
});
// Ruta para cerrar sesión
app.get('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('No se pudo cerrar sesión');
    }
    res.redirect('/login');  // Redirige al login después de cerrar sesión
  });
});



// Ruta para mostrar el formulario de registro
app.get('/registrarme', (req, res) => {
  res.render('register');  // Renderizar la vista de registro
});


// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
