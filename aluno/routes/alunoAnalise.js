const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

router.get("/aluno/analise/:id", verificarAutenticacaoAluno, (req, res) => {
  const db = req.db;
  const simuladoId = req.params.id;
  const alunoId = req.session.user.id;

  // Verifica se o aluno já finalizou o simulado
  const checkQuery =
    "SELECT finalizado FROM simulado_aluno WHERE simulado_id = ? AND aluno_id = ?";
  db.query(checkQuery, [simuladoId, alunoId], (err, result) => {
    if (err) {
      console.error("Erro ao verificar finalização do simulado:", err);
      return res.status(500).send("Erro ao verificar finalização do simulado");
    }
    if (result.length === 0 || result[0].finalizado != 1) {
      return res.redirect("/aluno/responder-simulado/" + simuladoId);
    }

    // Busca a última tentativa do aluno para esse simulado
    const tentativaQuery = `
      SELECT id, nota, data_tentativa 
      FROM tentativa_simulado 
      WHERE simulado_id = ? AND aluno_id = ? 
      ORDER BY data_tentativa DESC 
      LIMIT 1
    `;
    db.query(tentativaQuery, [simuladoId, alunoId], (err, tentativas) => {
      if (err) {
        console.error("Erro ao buscar tentativa:", err);
        return res.status(500).send("Erro ao buscar tentativa");
      }
      if (tentativas.length === 0) {
        return res
          .status(404)
          .send("Nenhuma tentativa encontrada para esse simulado");
      }
      const tentativa = tentativas[0];

      // Consulta o total de questões do simulado
      const totalQuery =
        "SELECT COUNT(*) AS total FROM simulado_questao WHERE simulado_id = ?";
      db.query(totalQuery, [simuladoId], (err, totalResult) => {
        if (err) {
          console.error("Erro ao buscar total de questões:", err);
          return res.status(500).send("Erro ao buscar total de questões");
        }
        const totalQuestions = totalResult[0].total;

        // Consulta o total de respostas fornecidas (agrupando por questão)
        const answeredQuery = `
          SELECT COUNT(*) AS answeredCount 
          FROM (
            SELECT questao_id 
            FROM resposta_aluno 
            WHERE tentativa_id = ? 
            GROUP BY questao_id
          ) AS sub
        `;
        db.query(answeredQuery, [tentativa.id], (err, answeredResult) => {
          if (err) {
            console.error("Erro ao buscar respostas fornecidas:", err);
            return res.status(500).send("Erro ao buscar respostas fornecidas");
          }
          const answeredCount = answeredResult[0].answeredCount;

          // Consulta a quantidade de respostas corretas (agrupando por questão e considerando correta se houver pelo menos um registro com correta = 1)
          const correctQuery = `
            SELECT COUNT(*) AS correctCount 
            FROM (
              SELECT questao_id, MAX(correta) AS maxCorreta 
              FROM resposta_aluno 
              WHERE tentativa_id = ? 
              GROUP BY questao_id
            ) AS sub
            WHERE maxCorreta = 1
          `;
          db.query(correctQuery, [tentativa.id], (err, correctResult) => {
            if (err) {
              console.error("Erro ao buscar respostas corretas:", err);
              return res.status(500).send("Erro ao buscar respostas corretas");
            }
            const correctCount = correctResult[0].correctCount;

            const wrongAnswers = answeredCount - correctCount;
            const blank = totalQuestions - answeredCount;
            const nota = parseFloat(tentativa.nota) || 0;

            return res.render("aluno-analise", {
              nota: nota.toFixed(2),
              correctCount,
              wrongAnswers,
              blank,
              totalQuestions,
            });
          });
        });
      });
    });
  });
});

module.exports = router;
