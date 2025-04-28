const express = require("express");
const session = require("express-session");
const flash = require("connect-flash"); // <<< adiciona connect-flash
const path = require("path");
const mysql = require("mysql2");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
require("./admin/routes/cronFinalizarSimulados");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {});
app.set("io", io);

// --- parsers e uploads ---
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

// --- banco de dados ---
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
db.connect((err) => {
  if (err) console.error("Erro ao conectar ao DB:", err);
  else console.log("Conectado ao MySQL com sucesso");
});

// --- view engine EJS em múltiplas pastas ---
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "admin", "views"),
  path.join(__dirname, "aluno", "views"),
]);

// --- arquivos estáticos ---
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

// --- sessão e flash ---
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(flash()); // <<< monta o middleware de flash

// --- torna a mensagem de flash disponível em todas as views ---
app.use((req, res, next) => {
  res.locals.message = req.flash("error");
  next();
});

// --- disponibiliza o db nas rotas ---
app.use((req, res, next) => {
  req.db = db;
  next();
});

// --- res.locals para usuário logado ---
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// --- rotas admin ---
const authRoutes = require("./admin/routes/auth");
const registroRoutes = require("./admin/routes/registro");
const turmasRoutes = require("./admin/routes/turmas");
const materiasRoutes = require("./admin/routes/materias");
const alunoRoutes = require("./admin/routes/aluno");
const questaoRoutes = require("./admin/routes/questao");
const simuladoRoutes = require("./admin/routes/simulado");
const importarRoutes = require("./admin/routes/importar");
const resetarSenhaRoutes = require("./admin/routes/resetarSenha");

app.use(authRoutes);
app.use(registroRoutes);
app.use(turmasRoutes);
app.use(materiasRoutes);
app.use(alunoRoutes);
app.use(questaoRoutes);
app.use(simuladoRoutes);
app.use(importarRoutes);
app.use(resetarSenhaRoutes);

// --- rotas aluno ---
const alunoAuthRoutes = require("./aluno/routes/alunoAuth");
const alunoSimuladoRoutes = require("./aluno/routes/alunoSimulado");
const alunoResponderRoutes = require("./aluno/routes/alunoResponder");
const alunoEncerrarSimuladoRoutes = require("./aluno/routes/alunoEncerrarSimulado");
const alunoAnaliseRoutes = require("./aluno/routes/alunoAnalise");
const alunoSimuladoConcluidoRoutes = require("./aluno/routes/alunoSimuladoConcluido");

app.use(alunoAuthRoutes);
app.use(alunoSimuladoRoutes);
app.use(alunoResponderRoutes);
app.use(alunoEncerrarSimuladoRoutes);
app.use(alunoAnaliseRoutes);
app.use(alunoSimuladoConcluidoRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).render("404", { url: req.url });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
