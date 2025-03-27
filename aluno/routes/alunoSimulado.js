const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

router.get("/aluno/simulado", verificarAutenticacaoAluno, (req, res) => {
  const db = req.db;
  // Supondo que o usuário aluno possui os campos "turma_id" e "id"
  const turmaId = req.session.user.turma_id;
  const alunoId = req.session.user.id;
  // Recupera a mensagem de sucesso, se existir, e em seguida a remove da sessão
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;

  // Query que junta simulado com simulado_aluno e filtra pelos critérios:
  // simulado ativo, da turma do aluno e onde a tentativa não foi finalizada (finalizado = 0)
  const query = `
    SELECT s.id, s.titulo, s.descricao,
           DATE_FORMAT(s.tempo_prova, '%H:%i:%s') AS tempo_prova,
           s.ativa
    FROM simulado s
    INNER JOIN simulado_aluno sa ON s.id = sa.simulado_id
    WHERE s.ativa = 1 AND s.turma_id = ? AND sa.aluno_id = ? AND sa.finalizado = 0
    ORDER BY s.data_criacao DESC
    LIMIT 1
  `;

  db.query(query, [turmaId, alunoId], (err, results) => {
    if (err) {
      console.error("Erro ao buscar simulado ativo:", err);
      return res.render("aluno-simulados", {
        message: "Erro ao buscar simulado.",
        simulado: null,
      });
    }
    const simulado = results[0] || null;
    res.render("aluno-simulado", {
      message: successMessage,
      simulado,
    });
  });
});

module.exports = router;
