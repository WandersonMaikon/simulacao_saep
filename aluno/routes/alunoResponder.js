const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Função para converter "HH:MM:SS" em segundos
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
          return res.render("aluno-responder-simulado", { simulado: null });
        }
        const simulado = simuladoResult[0];

        // Se o campo tempo_prova estiver no formato "HH:MM:SS", converte para segundos
        if (
          typeof simulado.tempo_prova === "string" &&
          simulado.tempo_prova.indexOf(":") !== -1
        ) {
          simulado.tempo_prova = timeStringToSeconds(simulado.tempo_prova);
        } else {
          // Caso contrário, tenta converter diretamente (supondo que já seja um número)
          simulado.tempo_prova = parseInt(simulado.tempo_prova, 10);
        }
        // Se a conversão falhar, define um valor padrão (por exemplo, 2 horas = 7200 segundos)
        if (isNaN(simulado.tempo_prova)) {
          simulado.tempo_prova = 7200;
        }

        // Busca todas as questões associadas a esse simulado, ordenadas por q.id ASC.
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

module.exports = router;
