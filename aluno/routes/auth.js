const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

// Middleware de autenticação para rotas protegidas
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota GET para exibir o formulário de login de aluno
router.get("/aluno/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = "";
  // Procura a view "login.ejs" dentro dos diretórios de views configurados
  res.render("aluno-login", { message });
});

// Rota POST para processar o login de aluno
router.post("/aluno/login", (req, res) => {
  const { email, password } = req.body;
  const db = req.db;
  // Supondo que o login de alunos seja feito na tabela "aluno"
  db.query(
    "SELECT * FROM aluno WHERE email = ?",
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
      req.session.successMessage = "Logado com sucesso!";
      res.redirect("/aluno/dashboard");
    }
  );
});

// Rota GET para o dashboard do aluno (rota protegida)
router.get("/aluno/dashboard", verificarAutenticacao, (req, res) => {
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;
  res.render("dashboard", {
    username: req.session.user.nome,
    message: successMessage,
  });
});

// Rota GET para logout de aluno
router.get("/aluno/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/aluno/login");
});

module.exports = router;
