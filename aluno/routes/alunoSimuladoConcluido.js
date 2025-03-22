const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota para listar os simulados concluídos
router.get(
  "/aluno/simulados-concluidos",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const alunoId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // Consulta para obter os simulados concluídos do aluno.
    // Essa query junta a tabela tentativa_simulado (que armazena as tentativas)
    // com a tabela simulado_aluno (para verificar se o simulado foi finalizado)
    const simuladosQuery = `
    SELECT ts.id, ts.simulado_id, ts.nota, ts.data_tentativa
    FROM tentativa_simulado ts
    JOIN simulado_aluno sa ON ts.simulado_id = sa.simulado_id
    WHERE ts.aluno_id = ? AND sa.finalizado = 1
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

        // Consulta para contar o total de simulados concluídos do aluno
        const countQuery = `
      SELECT COUNT(*) AS total
      FROM tentativa_simulado ts
      JOIN simulado_aluno sa ON ts.simulado_id = sa.simulado_id
      WHERE ts.aluno_id = ? AND sa.finalizado = 1
    `;
        db.query(countQuery, [alunoId], (err, countResults) => {
          if (err) {
            console.error("Erro ao contar simulados concluídos:", err);
            return res.status(500).send("Erro ao contar simulados concluídos");
          }
          const totalSimulados = countResults[0].total;
          const totalPages = Math.ceil(totalSimulados / limit);

          // Renderiza a view 'simulados-concluidos' passando os dados necessários para o layout
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
