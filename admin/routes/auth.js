const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

// Middleware de autenticação para rotas protegidas
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    // Redirecionamento com barra no início
    return res.redirect("/admin/login");
  }
  next();
};

router.get("/admin/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = "";
  // Como a view está em admin/views e é "login.ejs", renderize como "login"
  res.render("login", { message });
});

// Processa o login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const db = req.db;
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
      req.session.successMessage = "Logado com sucesso!";
      res.redirect("/admin/dashboard");
    }
  );
});

// Dashboard (rota protegida)
router.get("/admin/dashboard", verificarAutenticacao, (req, res) => {
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;
  res.render("dashboard", {
    username: req.session.user.nome,
    message: successMessage,
  });
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

module.exports = router;
