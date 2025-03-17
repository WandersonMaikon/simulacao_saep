const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

// Rota POST para encerrar o simulado, registrar as respostas e exibir a tela de análise
router.post(
  "/aluno/encerrar-simulado/:id",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const simuladoId = req.params.id;
    const alunoId = req.session.user.id; // Obtém o ID do aluno logado
    const answers = req.body.answers; // Espera um objeto com respostas, ex: { "1": "A", "2": "C", ... }

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: "Nenhuma resposta enviada." });
    }

    // Insere uma nova tentativa no simulado
    const insertTentativa =
      "INSERT INTO tentativa_simulado (aluno_id, simulado_id) VALUES (?, ?)";
    db.query(insertTentativa, [alunoId, simuladoId], (err, result) => {
      if (err) {
        console.error("Erro ao inserir tentativa:", err);
        return res.status(500).json({ error: "Erro ao registrar tentativa" });
      }
      const tentativaId = result.insertId;

      // Prepara para verificar as respostas corretas.
      const questionIds = Object.keys(answers);
      const query = "SELECT id, resposta_correta FROM questao WHERE id IN (?)";
      db.query(query, [questionIds], (err, questions) => {
        if (err) {
          console.error("Erro ao buscar questões:", err);
          return res.status(500).json({ error: "Erro ao verificar respostas" });
        }

        // Função para converter letra para número, se necessário.
        function convertLetter(letter) {
          const mapping = { A: 1, B: 2, C: 3, D: 4, E: 5 };
          return mapping[letter] || 0;
        }

        let inserts = [];
        let correctCount = 0;
        // Para cada questão, verifica se a resposta do aluno está correta.
        questions.forEach((q) => {
          const chosenLetter = answers[q.id]; // Exemplo: "A"
          const chosen = convertLetter(chosenLetter);
          const isCorrect = q.resposta_correta === chosenLetter ? 1 : 0;
          if (isCorrect === 1) correctCount++;
          inserts.push([tentativaId, q.id, chosen, isCorrect]);
        });

        // Insere as respostas do aluno na tabela resposta_aluno
        const insertRespostas =
          "INSERT INTO resposta_aluno (tentativa_id, questao_id, resposta_escolhida, correta) VALUES ?";
        db.query(insertRespostas, [inserts], (err, result) => {
          if (err) {
            console.error("Erro ao inserir respostas:", err);
            return res
              .status(500)
              .json({ error: "Erro ao registrar respostas" });
          }
          // Calcula a nota (por exemplo, percentual de acertos)
          const totalQuestions = questions.length;
          const score = (correctCount / totalQuestions) * 100;
          const errors = totalQuestions - correctCount; // Supondo que todas as questões foram respondidas

          // Atualiza a tentativa com a nota
          const updateTentativa =
            "UPDATE tentativa_simulado SET nota = ? WHERE id = ?";
          db.query(updateTentativa, [score, tentativaId], (err, result) => {
            if (err) {
              console.error("Erro ao atualizar nota:", err);
              return res.status(500).json({ error: "Erro ao registrar nota" });
            }
            // Renderiza a tela de análise geral com os dados calculados
            return res.render("aluno-analise", {
              nota: score.toFixed(2),
              correctCount,
              errors,
              totalQuestions,
            });
          });
        });
      });
    });
  }
);

module.exports = router;
