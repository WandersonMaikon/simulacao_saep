const express = require("express");
const router = express.Router();

// GET: exibe o formulário de recuperação de senha
router.get("/recuperar-senha", (req, res) => {
  // res.locals.message vem do middleware de flash em index.js
  res.render("recuperar-senha", { message: res.locals.message || "" });
});

// POST: recebe matrícula, verifica no BD (promise) e redireciona
router.post("/recuperar-senha", async (req, res) => {
  // 1) Sanitiza a entrada
  const rawMatricula = req.body.matricula || "";
  const matricula = rawMatricula.trim();

  try {
    // 2) Consulta a tabela professor usando o pool promise
    const [rows] = await req.dbPromise.execute(
      "SELECT id FROM professor WHERE matricula = ? LIMIT 1",
      [matricula]
    );

    // 3) Se encontrar, guarda na sessão e segue
    if (rows.length > 0) {
      req.session.matriculaReset = matricula;
      return res.redirect("/recuperar-senha/confirma");
    }

    // 4) Se não encontrar, flash de erro e volta
    req.flash("error", "Matrícula não encontrada.");
    return res.redirect("/recuperar-senha");
  } catch (err) {
    console.error("Erro ao verificar matrícula:", err);
    req.flash("error", "Ocorreu um erro no servidor. Tente novamente.");
    return res.redirect("/recuperar-senha");
  }
});

module.exports = router;
