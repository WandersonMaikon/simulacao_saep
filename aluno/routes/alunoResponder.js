const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota para exibir a tela de resposta do simulado
router.get(
  "/aluno/responder-simulado/:id",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const simuladoId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // número de questões por página
    const offset = (page - 1) * limit;

    // Busca os dados do simulado
    db.query(
      "SELECT * FROM simulado WHERE id = ?",
      [simuladoId],
      (err, simuladoResult) => {
        if (err) {
          console.error("Erro ao buscar simulado:", err);
          return res.status(500).send("Erro ao buscar simulado");
        }
        if (simuladoResult.length === 0) {
          // Se não houver simulado, renderiza a view informando que não há simulado ativo.
          return res.render("aluno-responder-simulado", { simulado: null });
        }
        const simulado = simuladoResult[0];

        // Conta o total de questões associadas a esse simulado.
        db.query(
          "SELECT COUNT(*) AS count FROM simulado_questao sq JOIN questao q ON sq.questao_id = q.id WHERE sq.simulado_id = ?",
          [simuladoId],
          (err, countResult) => {
            if (err) {
              console.error("Erro ao contar questões:", err);
              return res.status(500).send("Erro ao contar questões");
            }
            const totalRows = countResult[0].count;
            const totalPages = Math.ceil(totalRows / limit);

            // Busca as questões, com paginação, ordenadas por q.id ASC.
            db.query(
              "SELECT q.* FROM simulado_questao sq JOIN questao q ON sq.questao_id = q.id WHERE sq.simulado_id = ? ORDER BY q.id ASC LIMIT ? OFFSET ?",
              [simuladoId, limit, offset],
              (err, questoes) => {
                if (err) {
                  console.error("Erro ao buscar questões:", err);
                  return res.status(500).send("Erro ao buscar questões");
                }
                // Renderiza a view "aluno-responder-simulado.ejs" (certifique-se de que o arquivo esteja em aluno/views)
                return res.render("aluno-responder-simulado", {
                  simulado,
                  questoes,
                  currentPage: page,
                  totalPages,
                  totalRows,
                });
              }
            );
          }
        );
      }
    );
  }
);

module.exports = router;
