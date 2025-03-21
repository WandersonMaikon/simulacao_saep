const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Função para converter uma string de tempo (no formato "HH:MM:SS") em segundos.
function timeStringToSeconds(timeString) {
  const parts = timeString.split(":");
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Rota para exibir a tela de resposta do simulado
router.get(
  "/aluno/responder-simulado/:id",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const simuladoId = req.params.id;
    const page = parseInt(req.query.page) || 1;

    // Busca os dados do simulado, incluindo o campo global de início
    db.query(
      "SELECT *, inicio_prova FROM simulado WHERE id = ?",
      [simuladoId],
      (err, simuladoResult) => {
        if (err) {
          console.error("Erro ao buscar simulado:", err);
          return res.status(500).send("Erro ao buscar simulado");
        }
        if (simuladoResult.length === 0) {
          return res.render("aluno-responder-simulado", { simulado: null });
        }
        const simulado = simuladoResult[0];

        // Converte simulado.tempo_prova (formato "HH:MM:SS") para segundos.
        if (typeof simulado.tempo_prova === "string") {
          simulado.tempo_prova = timeStringToSeconds(simulado.tempo_prova);
        } else {
          simulado.tempo_prova = parseInt(simulado.tempo_prova, 10);
        }
        if (isNaN(simulado.tempo_prova)) {
          simulado.tempo_prova = 7200; // valor padrão (2 horas)
        }

        // Verifica se o simulado já foi finalizado pelo aluno
        const checkQuery =
          "SELECT finalizado FROM simulado_aluno WHERE simulado_id = ? AND aluno_id = ?";
        db.query(
          checkQuery,
          [simuladoId, req.session.user.id],
          (err, result) => {
            if (err) {
              console.error("Erro ao verificar finalização do simulado:", err);
              return res
                .status(500)
                .send("Erro ao verificar finalização do simulado");
            }
            if (result.length > 0 && result[0].finalizado == 1) {
              // Se o simulado já estiver finalizado, redireciona para a tela de análise
              return res.redirect("/aluno/analise/" + simuladoId);
            }

            // Define cabeçalhos para evitar cache e forçar o recarregamento da página
            res.setHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate"
            );
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");

            // Busca as questões associadas a esse simulado, ordenadas por q.id ASC.
            db.query(
              "SELECT q.* FROM simulado_questao sq JOIN questao q ON sq.questao_id = q.id WHERE sq.simulado_id = ? ORDER BY q.id ASC",
              [simuladoId],
              (err, questoes) => {
                if (err) {
                  console.error("Erro ao buscar questões:", err);
                  return res.status(500).send("Erro ao buscar questões");
                }
                const totalPages = questoes.length;
                return res.render("aluno-responder-simulado", {
                  aluno: req.session.user, // Disponibiliza o aluno no template
                  simulado,
                  questoes,
                  currentPage: page,
                  totalPages,
                  totalRows: questoes.length,
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
