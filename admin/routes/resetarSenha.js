// admin/routes/resetarSenha.js
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// 1) GET /recuperar-senha → exibe o formulário de matrícula e renderiza qualquer mensagem de erro
router.get("/recuperar-senha", (req, res) => {
  // res.locals.message foi preenchido pelo middleware global de flash em index.js
  const flashArray = res.locals.message;
  const message =
    Array.isArray(flashArray) && flashArray.length ? flashArray[0] : "";
  res.render("recuperar-senha", { message });
});

// 2) POST /recuperar-senha → valida matrícula e redireciona
router.post("/recuperar-senha", async (req, res) => {
  const matricula = (req.body.matricula || "").trim();

  if (!matricula) {
    req.flash("error", "Informe a matrícula.");
    return res.redirect("/recuperar-senha");
  }

  try {
    const [rows] = await req.dbPromise.execute(
      "SELECT id FROM professor WHERE matricula = ? LIMIT 1",
      [matricula]
    );

    if (rows.length === 0) {
      req.flash(
        "error",
        "Matrícula não encontrada ou professor não cadastrado."
      );
      return res.redirect("/recuperar-senha");
    }

    // matrícula válida → avança para confirmação de senha
    req.session.matriculaReset = matricula;
    return res.redirect("/recuperar-senha/confirma");
  } catch (err) {
    req.flash("error", "Erro no servidor. Tente novamente.");
    return res.redirect("/recuperar-senha");
  }
});

// 3) GET /recuperar-senha/confirma → exibe o formulário de nova senha
router.get("/recuperar-senha/confirma", (req, res) => {
  if (!req.session.matriculaReset) {
    // acesso direto proibido → volta para início
    return res.redirect("/recuperar-senha");
  }
  res.render("confirma-senha", {
    message: "",
    success: false,
  });
});

// 4) POST /recuperar-senha/confirma → valida e grava a nova senha
router.post("/recuperar-senha/confirma", async (req, res) => {
  const matricula = req.session.matriculaReset;
  const { newPassword, confirmPassword } = req.body;

  // valida se as senhas coincidem
  if (!newPassword || newPassword !== confirmPassword) {
    return res.render("confirma-senha", {
      message: "As senhas não coincidem.",
      success: false,
    });
  }

  try {
    // gera hash e atualiza no banco
    const hash = await bcrypt.hash(newPassword, 10);
    await req.dbPromise.execute(
      "UPDATE professor SET senha = ? WHERE matricula = ?",
      [hash, matricula]
    );

    // limpa sessão e renderiza sucesso
    req.session.matriculaReset = null;
    return res.render("confirma-senha", {
      message: "",
      success: true,
    });
  } catch (err) {
    return res.render("confirma-senha", {
      message: "Não foi possível alterar a senha. Tente novamente.",
      success: false,
    });
  }
});

module.exports = router;
