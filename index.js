require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const app = express();
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

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

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Rota para exibir a página de login
app.get("/login", (request, response) => {
  response.render("login", { message: "" });
});

// Rota para processar o login
app.post("/login", (request, response) => {
  const { usuario, password } = request.body;
  console.log("Dados recebidos:", request.body);

  db.query(
    "SELECT * FROM usuario WHERE usuario = ?",
    [usuario],
    async (error, results) => {
      if (error) {
        console.error("Erro na consulta SQL:", error);
        return response.render("login", { message: "Erro no sistema" });
      }
      if (results.length === 0) {
        console.log("Usuário não encontrado:", usuario);
        return response.render("login", {
          message: "Usuário ou senha inválidos",
        });
      }

      const user = results[0];
      console.log("Usuário encontrado:", user);

      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log("Resultado da comparação de senha:", passwordMatch);

      if (!passwordMatch) {
        console.log("Senha incorreta para o usuário:", usuario);
        return response.render("login", {
          message: "Usuário ou senha inválidos",
        });
      }

      request.session.user = user;
      response.redirect("/dashboard");
    }
  );
});
// Rota para processar o registro de usuário com verificação de matrícula
app.post("/registro", async (request, response) => {
  const { username, matricula, cursos, email, password } = request.body;

  // Verifica se a matrícula está cadastrada na tabela de professores permitidos
  db.query(
    "SELECT * FROM professores_permitidos WHERE matricula = ?",
    [matricula],
    async (error, results) => {
      if (error) {
        console.error("Erro ao verificar matrícula:", error);
        return response.render("registro", {
          message: "Erro no sistema ao verificar matrícula",
        });
      }

      if (results.length === 0) {
        return response.render("registro", {
          message: "Não permitido o cadastro do professor, entrar em contato",
        });
      }

      // Matrícula válida, procede com o cadastro
      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO usuario (usuario, matricula, cursos, email, password) VALUES (?, ?, ?, ?, ?)",
        [username, matricula, cursos, email, hashedPassword],
        (error) => {
          if (error) {
            console.error("Erro ao cadastrar usuário:", error);
            return response.render("registro", {
              message: "Erro ao criar usuário",
            });
          }
          response.redirect("/login");
        }
      );
    }
  );
});

// Rota para exibir a página do dashboard
app.get("/dashboard", (request, response) => {
  if (!request.session.user) {
    return response.redirect("/login");
  }
  response.render("dashboard", { username: request.session.user.usuario });
});

app.use("/assets", express.static(path.join(__dirname, "views/assets")));

// Rota para logout
app.get("/logout", (request, response) => {
  request.session.destroy();
  response.redirect("/login");
});

// Rota para exibir a página de registro
app.get("/registro", (request, response) => {
  response.render("registro", { message: "" });
});

// Rota para processar o registro de usuário
app.post("/registro", async (request, response) => {
  const { username, password, email } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Senha hash gerada:", hashedPassword);

  db.query(
    "INSERT INTO usuario (usuario, password, email) VALUES (?, ?, ?)",
    [username, hashedPassword, email],
    (error) => {
      if (error) {
        console.error("Erro ao inserir usuário:", error);
        return response.render("registro", {
          message: "Erro ao criar usuário",
        });
      }
      response.redirect("/login");
    }
  );
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
