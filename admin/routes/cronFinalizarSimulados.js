const cron = require("node-cron");
const db = require("../../db"); // Certifique-se de que o caminho esteja correto para seu módulo de conexão

// Função que insere respostas em branco para um aluno (já associado ao simulado) que não respondeu alguma questão
function inserirRespostasEmBrancoParaAluno(simuladoId, alunoId) {
  // Essa query insere, para cada questão do simulado, uma resposta em branco se ainda não existir
  const insertBlankQuery = `
    INSERT INTO resposta_aluno (tentativa_id, questao_id, resposta_escolhida, correta)
    SELECT t.id, sq.questao_id, '', 0
    FROM simulado_questao sq
    JOIN tentativa_simulado t ON t.simulado_id = sq.simulado_id
    WHERE sq.simulado_id = ?
      AND t.aluno_id = ?
      AND NOT EXISTS (
          SELECT 1 
          FROM resposta_aluno r
          WHERE r.tentativa_id = t.id AND r.questao_id = sq.questao_id
      )
  `;
  db.query(insertBlankQuery, [simuladoId, alunoId], (err, result) => {});
}

// Função que processa os alunos que já foram inseridos no simulado (na tabela simulado_aluno)
// e insere as respostas em branco para aqueles que não responderam todas as questões.
function processarRespostasEmBranco(simuladoId) {
  // Seleciona os alunos associados ao simulado
  const selectAlunosQuery = `
    SELECT aluno_id
    FROM simulado_aluno
    WHERE simulado_id = ?
  `;
  db.query(selectAlunosQuery, [simuladoId], (err, alunos) => {
    if (err) {
    } else {
      alunos.forEach((row) => {
        inserirRespostasEmBrancoParaAluno(simuladoId, row.aluno_id);
      });
    }
  });
}

// Agendar uma tarefa para rodar a cada minuto
cron.schedule("* * * * *", () => {
  // Atualiza os simulados que já ultrapassaram o tempo de prova
  const updateQuery = `
    UPDATE simulado
    SET finalizado = 1, ativa = 0
    WHERE ativa = 1
      AND finalizado = 0
      AND inicio_prova IS NOT NULL
      AND TIME_TO_SEC(TIMEDIFF(NOW(), inicio_prova)) >= TIME_TO_SEC(tempo_prova)
  `;
  db.query(updateQuery, (err, result) => {
    if (err) {
    } else if (result.affectedRows > 0) {
      // Após finalizar os simulados, selecione cada simulado finalizado nesta verificação e processe os alunos
      const selectQuery = `
        SELECT id, turma_id, inicio_prova, tempo_prova
        FROM simulado
        WHERE finalizado = 1 
          AND ativa = 0
          AND inicio_prova IS NOT NULL
          AND TIME_TO_SEC(TIMEDIFF(NOW(), inicio_prova)) >= TIME_TO_SEC(tempo_prova)
      `;
      db.query(selectQuery, (err, simulados) => {
        if (err) {
        } else {
          simulados.forEach((simulado) => {
            processarRespostasEmBranco(simulado.id);
          });
        }
      });
    }
  });
});
