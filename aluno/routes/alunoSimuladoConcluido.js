const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

router.get(
  "/aluno/simulados-concluidos",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const alunoId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    /* 
    A query agora retorna:
    - s.descricao AS descricao: a descrição do simulado
    - ts.nota, a data (formatada), a duração, acertos e total de questões
  */
    const simuladosQuery = `
    SELECT
      s.id AS id, 
      s.descricao AS descricao, 
      ts.nota, 
      DATE_FORMAT(ts.data_tentativa, '%d/%m/%Y') AS data,
      COALESCE(TIMEDIFF(ts.data_tentativa, s.inicio_prova), '00:00:00') AS duracao,
      COALESCE((
        SELECT COUNT(*) 
        FROM (
          SELECT questao_id, MAX(correta) AS maxCorreta
          FROM resposta_aluno 
          WHERE tentativa_id = ts.id
          GROUP BY questao_id
        ) AS sub
        WHERE maxCorreta = 1
      ), 0) AS acertos,
      (SELECT COUNT(*) FROM simulado_questao WHERE simulado_id = s.id) AS totalQuestoes
    FROM simulado_aluno sa
    JOIN simulado s ON s.id = sa.simulado_id
    LEFT JOIN (
      SELECT ts1.*
      FROM tentativa_simulado ts1
      WHERE ts1.aluno_id = ?
        AND ts1.data_tentativa = (
          SELECT MAX(ts2.data_tentativa)
          FROM tentativa_simulado ts2
          WHERE ts2.simulado_id = ts1.simulado_id 
            AND ts2.aluno_id = ts1.aluno_id
        )
    ) ts ON ts.simulado_id = s.id
    WHERE sa.aluno_id = ? AND sa.finalizado = 1
    ORDER BY s.id DESC, ts.data_tentativa DESC
    LIMIT ?, ?
  `;

    db.query(
      simuladosQuery,
      [alunoId, alunoId, offset, limit],
      (err, simuladosResults) => {
        if (err) {
          console.error("Erro ao buscar simulados concluídos:", err);
          return res.status(500).send("Erro ao buscar simulados concluídos");
        }

        // Contagem simples a partir da tabela simulado_aluno
        const countQuery = `
      SELECT COUNT(*) AS total
      FROM simulado_aluno
      WHERE aluno_id = ? AND finalizado = 1
    `;
        db.query(countQuery, [alunoId], (err, countResults) => {
          if (err) {
            console.error("Erro ao contar simulados concluídos:", err);
            return res.status(500).send("Erro ao contar simulados concluídos");
          }
          const totalSimulados = countResults[0].total;
          const totalPages = Math.ceil(totalSimulados / limit);

          res.render("aluno-simuladoConcluido", {
            simulados: simuladosResults,
            totalSimulados,
            currentPage: page,
            totalPages,
          });
        });
      }
    );
  }
);

module.exports = router;
