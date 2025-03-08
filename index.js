require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const mysql = require("mysql2");
const app = express();

// Configuração do banco de dados
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.connect((error) => {
  if (error) {
    console.error("Erro ao conectar ao banco de dados:", error);
  } else {
    console.log("Conectado ao MySQL com sucesso");
  }
});

// Middlewares
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Disponibilizando a conexão do banco para as rotas (opcional)
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Importando as rotas
const authRoutes = require("./routes/auth");
const registroRoutes = require("./routes/registro");
const turmasRoutes = require("./routes/turmas");
const materiasRoutes = require("./routes/materias");
const alunoRoutes = require("./routes/aluno");
const questaoRoutes = require("./routes/questao");
const simuladoRoutes = require("./routes/simulado");

// Usando as rotas
app.use(authRoutes);
app.use(registroRoutes);
app.use(turmasRoutes);
app.use(materiasRoutes);
app.use(alunoRoutes);
app.use(questaoRoutes);
app.use(simuladoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
