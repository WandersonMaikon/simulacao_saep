const express = require("express");
const router = express.Router();

// GET: exibe o formulário de recuperação
router.get("/recuperar-senha", (req, res) => {
  // res.locals.message vem do middleware em index.js
  res.render("recuperar-senha", { message: res.locals.message || "" });
});

// POST: recebe matrícula e verifica no banco
router.post("/recuperar-senha", async (req, res) => {
  const { matricula } = req.body;
  try {
    const [rows] = await req.db.execute(
      "SELECT id FROM professor WHERE matricula = ? LIMIT 1",
      [matricula]
    );

    if (rows.length > 0) {
      req.session.matriculaReset = matricula;
      return res.redirect("/recuperar-senha/confirma");
    }

    // matrícula não encontrada → flash de erro
    req.flash("error", "Matrícula não encontrada.");
    return res.redirect("/recuperar-senha");
  } catch (err) {
    console.error(err);
    req.flash("error", "Ocorreu um erro. Tente novamente.");
    return res.redirect("/recuperar-senha");
  }
});

module.exports = router;
