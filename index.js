const express = require("express");
const session = require("express-session");
const path = require("path");
const mysql = require("mysql2");
require("dotenv").config();

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

// Configuração do view engine com múltiplos diretórios de views
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "admin", "views"),
  path.join(__dirname, "aluno", "views"),
]);

// Middlewares
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

// Variáveis locais para as views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Importando as rotas admin
const authRoutes = require("./admin/routes/auth");
const registroRoutes = require("./admin/routes/registro");
const turmasRoutes = require("./admin/routes/turmas");
const materiasRoutes = require("./admin/routes/materias");
const alunoRoutes = require("./admin/routes/aluno");
const questaoRoutes = require("./admin/routes/questao");
const simuladoRoutes = require("./admin/routes/simulado");

app.use(authRoutes);
app.use(registroRoutes);
app.use(turmasRoutes);
app.use(materiasRoutes);
app.use(alunoRoutes);
app.use(questaoRoutes);
app.use(simuladoRoutes);

// Importando as rotas alunos
const alunoAuthRoutes = require("./aluno/routes/alunoAuth");
const alunoSimuladoRoutes = require("./aluno/routes/alunoSimulado");

app.use(alunoAuthRoutes);
app.use(alunoSimuladoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
