// admin/routes/resetarSenha.js
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// 1) GET /recuperar-senha → exibe o formulário de matrícula
router.get("/recuperar-senha", (req, res) => {
  console.log("[resetarSenha] GET /recuperar-senha");
  res.render("recuperar-senha", {
    message: req.flash("error")[0] || "",
  });
});

// 2) POST /recuperar-senha → valida matrícula e redireciona
router.post("/recuperar-senha", async (req, res) => {
  const matricula = (req.body.matricula || "").trim();
  console.log("[resetarSenha] POST /recuperar-senha, matrícula:", matricula);

  if (!matricula) {
    req.flash("error", "Informe a matrícula.");
    return res.redirect("/recuperar-senha");
  }

  try {
    const [rows] = await req.dbPromise.execute(
      "SELECT id FROM professor WHERE matricula = ? LIMIT 1",
      [matricula]
    );
    console.log("[resetarSenha] linhas encontradas:", rows);

    if (rows.length === 0) {
      req.flash("error", "Matrícula não encontrada.");
      return res.redirect("/recuperar-senha");
    }

    // matrícula válida
    req.session.matriculaReset = matricula;
    console.log("[resetarSenha] redirecionando para /recuperar-senha/confirma");
    return res.redirect("/recuperar-senha/confirma");
  } catch (err) {
    console.error("[resetarSenha] erro no BD:", err);
    req.flash("error", "Erro no servidor. Tente novamente.");
    return res.redirect("/recuperar-senha");
  }
});

// 3) GET /recuperar-senha/confirma → exibe o formulário de nova senha
router.get("/recuperar-senha/confirma", (req, res) => {
  console.log("[resetarSenha] GET /recuperar-senha/confirma");
  if (!req.session.matriculaReset) {
    return res.redirect("/recuperar-senha");
  }
  res.render("confirma-senha", {
    message: "",
    success: false,
  });
});

// 4) POST /recuperar-senha/confirma → grava a nova senha
router.post("/recuperar-senha/confirma", async (req, res) => {
  const matricula = req.session.matriculaReset;
  const { newPassword, confirmPassword } = req.body;
  console.log("[resetarSenha] POST /confirma para:", matricula);

  if (!newPassword || newPassword !== confirmPassword) {
    return res.render("confirma-senha", {
      message: "As senhas não coincidem.",
      success: false,
    });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await req.dbPromise.execute(
      "UPDATE professor SET senha = ? WHERE matricula = ?",
      [hash, matricula]
    );
    req.session.matriculaReset = null;
    return res.render("confirma-senha", {
      message: "",
      success: true,
    });
  } catch (err) {
    console.error("[resetarSenha] erro ao atualizar senha:", err);
    return res.render("confirma-senha", {
      message: "Não foi possível alterar a senha. Tente novamente.",
      success: false,
    });
  }
});

module.exports = router;
