const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota para listar os simulados concluídos (apenas a tentativa mais recente de cada simulado)
router.get(
  "/aluno/simulados-concluidos",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const alunoId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // Modificação: Seleciona o simulado_id com alias "id" para que o id exibido corresponda ao simulado
    const simuladosQuery = `
    SELECT ts.simulado_id AS id, ts.nota, ts.data_tentativa
    FROM tentativa_simulado ts
    JOIN simulado_aluno sa ON ts.simulado_id = sa.simulado_id
    WHERE ts.aluno_id = ? AND sa.finalizado = 1
      AND ts.data_tentativa = (
        SELECT MAX(ts2.data_tentativa)
        FROM tentativa_simulado ts2
        WHERE ts2.simulado_id = ts.simulado_id AND ts2.aluno_id = ts.aluno_id
      )
    ORDER BY ts.data_tentativa DESC
    LIMIT ?, ?
  `;

    db.query(
      simuladosQuery,
      [alunoId, offset, limit],
      (err, simuladosResults) => {
        if (err) {
          console.error("Erro ao buscar simulados concluídos:", err);
          return res.status(500).send("Erro ao buscar simulados concluídos");
        }

        // Query para contar os simulados concluídos, agrupando pelo simulado_id
        const countQuery = `
      SELECT COUNT(*) AS total FROM (
        SELECT ts.simulado_id
        FROM tentativa_simulado ts
        JOIN simulado_aluno sa ON ts.simulado_id = sa.simulado_id
        WHERE ts.aluno_id = ? AND sa.finalizado = 1
          AND ts.data_tentativa = (
            SELECT MAX(ts2.data_tentativa)
            FROM tentativa_simulado ts2
            WHERE ts2.simulado_id = ts.simulado_id AND ts2.aluno_id = ts.aluno_id
          )
        GROUP BY ts.simulado_id
      ) AS sub
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
