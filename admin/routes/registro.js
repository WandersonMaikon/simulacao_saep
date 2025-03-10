const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // Certifique-se de instalar e importar o bcrypt

// Middleware de autenticação (pode ser reutilizado ou importado de um módulo separado)
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/admin/login");
  }
  next();
};

// Exibe a página de registro
router.get("/admin/registro", (req, res) => {
  const db = req.db; // ou importe o db de outro módulo, se preferir
  // Busca todos os cursos disponíveis
  db.query("SELECT id, nome FROM curso", (err, results) => {
    if (err) {
      console.error("Erro ao buscar cursos:", err);
      return res.render("registro", {
        message: "Erro ao carregar cursos",
        cursos: [],
      });
    }
    res.render("registro", { message: "", cursos: results });
  });
});

// Processa o registro do professor
router.post("/registro", async (req, res) => {
  const db = req.db; // Certifique-se de que o db esteja disponível, via middleware ou importação
  const { nome, matricula, curso, email, password } = req.body;

  try {
    // Verifica se a matrícula é válida
    const [results] = await db
      .promise()
      .query("SELECT * FROM matricula_validada WHERE matricula = ?", [
        matricula,
      ]);

    if (results.length === 0) {
      return res.redirect(
        "/registro?error=Matrícula inválida ou não cadastrada."
      );
    }

    // Verifica se algum curso foi selecionado
    let cursosSelecionados = Array.isArray(curso) ? curso : [curso];

    if (!cursosSelecionados.length || cursosSelecionados[0] === "") {
      return res.redirect(
        "admin/registro?error=Selecione pelo menos um curso."
      );
    }

    // Hash da senha antes de inserir no banco
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insere o professor
    const [professorResult] = await db
      .promise()
      .query(
        "INSERT INTO professor (nome, matricula, email, senha) VALUES (?, ?, ?, ?)",
        [nome, matricula, email, hashedPassword]
      );

    const professorId = professorResult.insertId;

    // Cria os placeholders para inserção múltipla
    let placeholders = cursosSelecionados.map(() => "(?, ?)").join(", ");
    let values = cursosSelecionados.flatMap((c) => [professorId, c]);

    // Insere os cursos na tabela professor_curso
    await db
      .promise()
      .query(
        `INSERT INTO professor_curso (professor_id, curso_id) VALUES ${placeholders}`,
        values
      );

    return res.redirect("admin/registro?success=true");
  } catch (error) {
    console.error("Erro no registro:", error);

    let errorMessage = "Erro ao cadastrar professor.";
    if (error.code === "ER_DUP_ENTRY") {
      errorMessage = "E-mail ou matrícula já cadastrados.";
    }

    return res.redirect(`/registro?error=${encodeURIComponent(errorMessage)}`);
  }
});

module.exports = router;
