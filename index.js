require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();

// Configuração do banco de dados MySQL
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

// Configuração do middleware
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

// Middleware de autenticação
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Rota para exibir a página de login
app.get("/login", (req, res) => {
  res.render("login", { message: "" });
});

// Rota para processar o login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM professor WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Erro na consulta SQL:", err);
        return res.render("login", { message: "Erro no sistema" });
      }

      if (results.length === 0) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }

      const user = results[0];
      const passwordMatch = await bcrypt.compare(password, user.senha);

      if (!passwordMatch) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }

      req.session.user = user;
      res.redirect("/dashboard");
    }
  );
});

// Rota para exibir a página de registro com cursos dinâmicos
app.get("/registro", (req, res) => {
  db.query("SELECT id, nome FROM curso", (err, results) => {
    if (err) {
      console.error("Erro ao buscar cursos:", err);
      return res.render("registro", {
        message: "Erro ao carregar cursos",
        cursos: [],
      });
    }

    // Certifique-se de que os dados retornados são um array válido
    console.log("Cursos carregados:", results);

    res.render("registro", { message: "", cursos: results });
  });
});

// Rota para processar o registro de usuário
// Rota para processar o registro de usuário
app.post("/registro", async (request, response) => {
  const { nome, matricula, curso, email, password } = request.body;

  // Verifica se a matrícula existe na tabela de matrículas válidas
  db.query(
    "SELECT * FROM matricula_validada WHERE matricula = ?",
    [matricula],
    async (error, results) => {
      if (error) {
        console.error("Erro ao verificar matrícula:", error);
        return response.render("registro", {
          message: "Matricula inexistente ou alguma informação incorreta.",
        });
      }

      if (results.length === 0) {
        return response.render("registro", {
          message: "Matricula inexistente ou alguma informação incorreta.",
        });
      }

      // Se a matrícula for válida, insere o professor no banco de dados
      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO professor (nome, matricula, email, senha) VALUES (?, ?, ?, ?)",
        [nome, matricula, curso, email, hashedPassword],
        (error) => {
          if (error) {
            console.error("Erro ao inserir usuário:", error);
            return response.render("registro", {
              message: "Erro ao criar usuário.",
            });
          }
          return response.render("registro", {
            message: "Cadastro de professor feito com sucesso!",
          });
        }
      );
    }
  );
});

// Rota para exibir o dashboard (protegida)
app.get("/dashboard", verificarAutenticacao, (req, res) => {
  res.render("dashboard", { username: req.session.user.nome });
});

// Rota para logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
