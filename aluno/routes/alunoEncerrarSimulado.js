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

    // Converte o campo "answers" de string para objeto JSON
    let answers;
    try {
      answers = JSON.parse(req.body.answers);
    } catch (e) {
      console.error("Erro ao parsear answers:", e);
      return res.status(400).json({ error: "Formato de respostas inválido." });
    }

    const timeoutFlag = req.body.timeout === "true"; // Se o encerramento ocorreu por timeout

    console.log("Answers recebidas:", answers);
    console.log("Chaves de answers:", Object.keys(answers));

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: "Nenhuma resposta enviada." });
    }

    // Use as chaves de 'answers' diretamente como IDs das questões
    const processedAnswers = answers;
    const questionIds = Object.keys(processedAnswers);
    console.log("IDs extraídos das questões:", questionIds);

    // Se não houver nenhuma questão identificada, retorna erro
    if (!questionIds.length) {
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

      // Busca as questões correspondentes aos IDs extraídos
      const query = "SELECT id, resposta_correta FROM questao WHERE id IN (?)";
      db.query(query, [questionIds], (err, questions) => {
        if (err) {
          console.error("Erro ao buscar questões:", err);
          return res.status(500).json({ error: "Erro ao verificar respostas" });
        }

        let inserts = [];
        let correctCount = 0;
        questions.forEach((q) => {
          // Obtém a resposta enviada para a questão com ID q.id (usando processedAnswers)
          const chosenLetter = processedAnswers[q.id];
          // Compara se a resposta enviada é igual à resposta correta (ignorando case)
          const isCorrect =
            q.resposta_correta.toUpperCase() === chosenLetter.toUpperCase()
              ? 1
              : 0;
          if (isCorrect === 1) correctCount++;
          // Prepara os dados para inserção: [tentativa_id, questao_id, resposta_escolhida, correta]
          inserts.push([tentativaId, q.id, chosenLetter, isCorrect]);
        });

        // Insere ou atualiza as respostas na tabela resposta_aluno
        const insertRespostas = `
          INSERT INTO resposta_aluno (tentativa_id, questao_id, resposta_escolhida, correta)
          VALUES ?
          ON DUPLICATE KEY UPDATE 
            resposta_escolhida = VALUES(resposta_escolhida),
            correta = VALUES(correta)
        `;
        db.query(insertRespostas, [inserts], (err, result) => {
          if (err) {
            console.error("Erro ao inserir respostas:", err);
            return res
              .status(500)
              .json({ error: "Erro ao registrar respostas" });
          }
          const totalQuestions = questions.length;
          const score = (correctCount / totalQuestions) * 100;
          // Atualiza a nota na tentativa
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
                  // Se o encerramento foi por timeout, encerra o simulado globalmente
                  db.query(
                    "UPDATE simulado SET finalizado = 1, ativa = 0 WHERE id = ?",
                    [simuladoId],
                    (err, updateResult) => {
                      if (err) {
                        console.error(
                          "Erro ao atualizar simulado (timeout):",
                          err
                        );
                      }
                      return res.redirect("/aluno/analise/" + simuladoId);
                    }
                  );
                } else {
                  // Se não foi por timeout, verifica se todos os alunos finalizaram
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
