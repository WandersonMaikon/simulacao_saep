const express = require("express");
const router = express.Router();

// Middleware de autenticação para professores (ajuste conforme sua implementação)
const verificarAutenticacaoProfessor = (req, res, next) => {
  if (!req.session.professor) {
    return res.redirect("/aluno/login");
  }
  next();
};

router.get(
  "/professor/historico-simulado/:id",
  verificarAutenticacaoProfessor,
  (req, res) => {
    const db = req.db;
    const simuladoId = req.params.id;

    // Consulta para obter as informações históricas de todas as tentativas do simulado
    const query = `
    SELECT 
      a.id AS aluno_id,
      a.nome AS aluno_nome,
      ts.id AS tentativa_id,
      ts.nota,
      ts.data_tentativa,
      (
        SELECT COUNT(DISTINCT ra.questao_id)
        FROM resposta_aluno ra
        WHERE ra.tentativa_id = ts.id
      ) AS respostas_fornecidas,
      (
        SELECT COUNT(*)
        FROM (
          SELECT ra.questao_id, MAX(ra.correta) AS maxCorreta
          FROM resposta_aluno ra
          WHERE ra.tentativa_id = ts.id
          GROUP BY ra.questao_id
        ) AS sub
        WHERE sub.maxCorreta = 1
      ) AS acertos,
      (
        SELECT COUNT(*) 
        FROM simulado_questao sq
        WHERE sq.simulado_id = ts.simulado_id
      ) AS total_questoes
    FROM tentativa_simulado ts
    JOIN aluno a ON ts.aluno_id = a.id
    WHERE ts.simulado_id = ?
    ORDER BY ts.data_tentativa DESC
  `;

    db.query(query, [simuladoId], (err, results) => {
      if (err) {
        console.error("Erro ao buscar histórico:", err);
        return res.status(500).send("Erro ao buscar histórico");
      }

      // Para cada tentativa, calculamos erros e questões em branco
      const historico = results.map((row) => {
        const answeredCount = row.respostas_fornecidas;
        const acertos = row.acertos;
        const totalQuestoes = row.total_questoes;
        const wrongAnswers = answeredCount - acertos;
        const blank = totalQuestoes - answeredCount;
        return {
          aluno_id: row.aluno_id,
          aluno_nome: row.aluno_nome,
          tentativa_id: row.tentativa_id,
          nota: row.nota,
          data_tentativa: row.data_tentativa,
          total_questoes: totalQuestoes,
          acertos: acertos,
          wrongAnswers: wrongAnswers,
          blank: blank,
        };
      });

      // Renderiza a view "historico-simulado" passando os dados do histórico e o ID do simulado
      res.render("historico-simulado", { historico, simuladoId });
    });
  }
);

module.exports = router;
