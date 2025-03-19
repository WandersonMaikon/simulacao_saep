const express = require("express");
const router = express.Router();

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
  // Renderiza a view "aluno-login.ejs" que deve estar em aluno/views/
  res.render("aluno-login", { message });
});

// Rota POST para processar o login de aluno usando comparação direta de senhas
router.post("/aluno/login", (req, res) => {
  const { usuario, senha } = req.body;

  // Verifica se os campos obrigatórios foram enviados
  if (!usuario || !senha) {
    return res.render("aluno-login", {
      message: "Usuário e senha são obrigatórios.",
    });
  }

  const db = req.db;
  // Consulta a tabela "aluno" utilizando o campo "usuario"
  db.query(
    "SELECT * FROM aluno WHERE usuario = ?",
    [usuario],
    (err, results) => {
      if (err) {
        console.error("Erro na consulta SQL:", err);
        return res.render("aluno-login", { message: "Erro no sistema" });
      }
      if (results.length === 0) {
        return res.render("aluno-login", {
          message: "Usuário ou senha inválidos",
        });
      }
      const user = results[0];
      // Se as senhas estiverem armazenadas em texto plano, faça comparação direta:
      if (senha !== user.senha) {
        return res.render("aluno-login", {
          message: "Usuário ou senha inválidos",
        });
      }
      req.session.user = user;
      req.session.successMessage = "Logado com sucesso!";
      // Redireciona para a rota /aluno/simulado após o login
      res.redirect("/aluno/simulado");
    }
  );
});

// Rota GET para o dashboard do aluno (rota protegida)
router.get("/aluno/dashboard", verificarAutenticacao, (req, res) => {
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;
  res.render("aluno-dashboard", {
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
