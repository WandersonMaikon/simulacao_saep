const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota GET para exibir o simulado ativo para o aluno
router.get("/aluno/simulado", verificarAutenticacaoAluno, (req, res) => {
  const db = req.db;
  // Supondo que o usuário do aluno tem um campo "turma_id"
  const turmaId = req.session.user.turma_id;

  // Query para buscar o simulado ativo para a turma do aluno
  const query = `
    SELECT s.id, s.titulo, s.descricao,
           DATE_FORMAT(s.tempo_prova, '%H:%i:%s') AS tempo_prova,
           s.ativa
    FROM simulado s
    WHERE s.ativa = 1 AND s.turma_id = ?
    ORDER BY s.data_criacao DESC
    LIMIT 1
  `;

  db.query(query, [turmaId], (err, results) => {
    if (err) {
      console.error("Erro ao buscar simulado ativo:", err);
      return res.render("aluno-simulados", {
        message: "Erro ao buscar simulado.",
        simulado: null,
      });
    }
    const simulado = results[0] || null;
    res.render("aluno-simulado", {
      message: "",
      simulado,
    });
  });
});

module.exports = router;
