const express = require("express");
const router = express.Router();

// Middleware de autenticação para alunos
const verificarAutenticacaoAluno = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/aluno/login");
  }
  next();
};

router.post(
  "/aluno/encerrar-simulado/:id",
  verificarAutenticacaoAluno,
  (req, res) => {
    const db = req.db;
    const simuladoId = req.params.id;
    const alunoId = req.session.user.id; // ID do aluno logado
    const answers = req.body.answers; // Dados enviados (em formato JSON)
    const timeoutFlag = req.body.timeout === "true"; // Se o encerramento ocorreu por timeout

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: "Nenhuma resposta enviada." });
    }

    // Insere uma nova tentativa na tabela tentativa_simulado
    const insertTentativa =
      "INSERT INTO tentativa_simulado (aluno_id, simulado_id) VALUES (?, ?)";
    db.query(insertTentativa, [alunoId, simuladoId], (err, result) => {
      if (err) {
        console.error("Erro ao inserir tentativa:", err);
        return res.status(500).json({ error: "Erro ao registrar tentativa" });
      }
      const tentativaId = result.insertId;

      // Busca as questões correspondentes às respostas enviadas
      const questionIds = Object.keys(answers);
      const query = "SELECT id, resposta_correta FROM questao WHERE id IN (?)";
      db.query(query, [questionIds], (err, questions) => {
        if (err) {
          console.error("Erro ao buscar questões:", err);
          return res.status(500).json({ error: "Erro ao verificar respostas" });
        }

        function convertLetter(letter) {
          const mapping = { A: 1, B: 2, C: 3, D: 4, E: 5 };
          return mapping[letter] || 0;
        }

        let inserts = [];
        let correctCount = 0;
        questions.forEach((q) => {
          const chosenLetter = answers[q.id]; // Exemplo: "A"
          const chosen = convertLetter(chosenLetter);
          const isCorrect = q.resposta_correta === chosenLetter ? 1 : 0;
          if (isCorrect === 1) correctCount++;
          inserts.push([tentativaId, q.id, chosen, isCorrect]);
        });

        const insertRespostas =
          "INSERT INTO resposta_aluno (tentativa_id, questao_id, resposta_escolhida, correta) VALUES ?";
        db.query(insertRespostas, [inserts], (err, result) => {
          if (err) {
            console.error("Erro ao inserir respostas:", err);
            return res
              .status(500)
              .json({ error: "Erro ao registrar respostas" });
          }
          const totalQuestions = questions.length;
          const score = (correctCount / totalQuestions) * 100;
          const errors = totalQuestions - correctCount;

          const updateTentativa =
            "UPDATE tentativa_simulado SET nota = ? WHERE id = ?";
          db.query(updateTentativa, [score, tentativaId], (err, result) => {
            if (err) {
              console.error("Erro ao atualizar nota:", err);
              return res.status(500).json({ error: "Erro ao registrar nota" });
            }
            // Marca o simulado como finalizado para o aluno atual
            const updateSimuladoAluno =
              "UPDATE simulado_aluno SET finalizado = 1 WHERE simulado_id = ? AND aluno_id = ?";
            db.query(
              updateSimuladoAluno,
              [simuladoId, alunoId],
              (err, result) => {
                if (err) {
                  console.error("Erro ao atualizar simulado_aluno:", err);
                  return res
                    .status(500)
                    .json({ error: "Erro ao finalizar simulado" });
                }

                if (timeoutFlag) {
                  // Se o encerramento foi por timeout, força o encerramento global imediatamente
                  db.query(
                    "UPDATE simulado SET finalizado = 1, ativa = 0 WHERE id = ?",
                    [simuladoId],
                    (err, updateResult) => {
                      if (err) {
                        console.error(
                          "Erro ao atualizar simulado para finalizado (timeout):",
                          err
                        );
                      }
                      return res.redirect("/aluno/analise/" + simuladoId);
                    }
                  );
                } else {
                  // Se não foi por timeout, verifica se todos os alunos cadastrados finalizaram
                  const countQuery =
                    "SELECT COUNT(*) AS total FROM simulado_aluno WHERE simulado_id = ?";
                  db.query(countQuery, [simuladoId], (err, countResult) => {
                    if (err) {
                      console.error("Erro ao contar alunos do simulado:", err);
                      return res.redirect(
                        "/aluno/encerrar-simulado/" + simuladoId
                      );
                    }
                    const totalAlunos = countResult[0].total;
                    const finishedQuery =
                      "SELECT COUNT(*) AS finished FROM simulado_aluno WHERE simulado_id = ? AND finalizado = 1";
                    db.query(
                      finishedQuery,
                      [simuladoId],
                      (err, finishedResult) => {
                        if (err) {
                          console.error(
                            "Erro ao contar alunos finalizados:",
                            err
                          );
                          return res.redirect(
                            "/aluno/encerrar-simulado/" + simuladoId
                          );
                        }
                        const finishedCount = finishedResult[0].finished;
                        console.log(
                          "Total de alunos:",
                          totalAlunos,
                          "Finalizados:",
                          finishedCount
                        );
                        // Se todos os alunos finalizaram, atualiza o simulado para finalizado e desativa (ativa = 0)
                        if (finishedCount === totalAlunos) {
                          db.query(
                            "UPDATE simulado SET finalizado = 1, ativa = 0 WHERE id = ?",
                            [simuladoId],
                            (err, updateResult) => {
                              if (err) {
                                console.error(
                                  "Erro ao atualizar simulado para finalizado:",
                                  err
                                );
                              }
                              return res.redirect(
                                "/aluno/analise/" + simuladoId
                              );
                            }
                          );
                        } else {
                          return res.redirect("/aluno/analise/" + simuladoId);
                        }
                      }
                    );
                  });
                }
              }
            );
          });
        });
      });
    });
  }
);

module.exports = router;
