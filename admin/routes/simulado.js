const express = require("express");
const router = express.Router();

// Middleware de autenticação
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/admin/login");
  }
  next();
};

// ==========================
// Rotas de Simulados
// ==========================

// GET /simulados - Lista simulados com paginação e pesquisa
router.get("/admin/simulados", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const searchTerm = req.query.search ? req.query.search.trim() : "";

  // Constrói a cláusula WHERE para filtrar os simulados do professor autenticado
  let baseWhere = "WHERE s.professor_id = ?";
  let queryParams = [req.session.user.id];
  if (searchTerm) {
    baseWhere += " AND (s.titulo LIKE ? OR s.descricao LIKE ?)";
    const wildcard = "%" + searchTerm + "%";
    queryParams.push(wildcard, wildcard);
  }

  // Query para contar simulados
  const countQuery = `SELECT COUNT(*) AS count FROM simulado s ${baseWhere}`;
  db.query(countQuery, queryParams, (err, countResult) => {
    if (err) {
      console.error("Erro ao contar simulados:", err);
      return res.render("simulados", {
        message: "Erro ao buscar simulados",
        simulados: [],
        currentPage: 1,
        totalPages: 0,
        totalRows: 0,
        search: "",
      });
    }
    const totalRows = countResult[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // Query para buscar os dados dos simulados, agora incluindo o campo "finalizado"
    const dataQuery = `
      SELECT s.id, s.titulo, s.descricao,
             DATE_FORMAT(s.tempo_prova, '%H:%i:%s') AS tempo_prova,
             s.ativa,
             s.finalizado,
             t.nome AS turma,
             c.nome AS curso_nome
      FROM simulado s
      LEFT JOIN turma t ON s.turma_id = t.id
      LEFT JOIN curso c ON s.curso_id = c.id
      ${baseWhere}
      ORDER BY s.data_criacao DESC
      LIMIT ? OFFSET ?
    `;
    let dataParams = queryParams.slice();
    dataParams.push(limit, offset);

    db.query(dataQuery, dataParams, (err, simulados) => {
      if (err) {
        console.error("Erro ao buscar simulados:", err);
        return res.render("simulados", {
          message: "Erro ao buscar simulados",
          simulados: [],
          currentPage: 1,
          totalPages: 0,
          totalRows: 0,
          search: searchTerm,
        });
      }
      res.render("simulados", {
        message: "",
        simulados,
        currentPage: page,
        totalPages,
        totalRows,
        search: searchTerm,
      });
    });
  });
});

// Renderiza o formulário para cadastrar um simulado
router.get("/cadastrar-simulado", verificarAutenticacao, async (req, res) => {
  try {
    // Utilize promisePool, disponível via req.promisePool ou outra forma
    const promisePool = req.promisePool || global.promisePool;
    const [cursos] = await promisePool.query("SELECT * FROM curso");
    res.render("cadastrar-simulado", { cursos });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

// Renderiza a página de cadastro multi‑etapas de simulado
router.get(
  "/admin/cadastrar-simulado-steps",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const professorId = req.session.user.id;
    db.query(
      "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
      [professorId],
      (err, results) => {
        if (err) {
          console.error(
            "Erro ao carregar a página de cadastro multi-step:",
            err
          );
          return res.status(500).send("Erro interno do servidor");
        }
        res.render("cadastrar-simulado-steps", { cursos: results });
      }
    );
  }
);

// GET /turmas-por-curso/:cursoId - Retorna turmas com base no curso selecionado
router.get("/turmas-por-curso/:cursoId", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const cursoId = Number(req.params.cursoId);
  const professorId = req.session.user.id;
  db.query(
    "SELECT id, nome FROM turma WHERE curso_id = ? AND professor_id = ?",
    [cursoId, professorId],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar turmas por curso:", err);
        return res
          .status(500)
          .json({ error: "Erro ao buscar turmas por curso", details: err });
      }
      res.json(results);
    }
  );
});

// GET /alunos-por-turma/:turmaId - Retorna alunos de uma turma específica
router.get("/alunos-por-turma/:turmaId", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const turmaId = Number(req.params.turmaId);
  db.query(
    "SELECT id, nome, usuario, senha, data_cadastro FROM aluno WHERE turma_id = ?",
    [turmaId],
    (err, alunos) => {
      if (err) {
        console.error("Erro ao buscar alunos:", err);
        return res
          .status(500)
          .json({ error: "Erro ao buscar alunos", details: err });
      }
      res.json(alunos);
    }
  );
});

// GET /questao-por-curso/:cursoId - Retorna questões com base no curso selecionado
router.get("/questao-por-curso/:cursoId", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const cursoId = Number(req.params.cursoId);
  // Query atualizada para buscar a dificuldade, enunciado e todas as alternativas
  const query = `
    SELECT 
      q.id, 
      q.titulo, 
      q.enunciado, 
      q.dificuldade, 
      q.alternativa_a, 
      q.alternativa_b, 
      q.alternativa_c, 
      q.alternativa_d, 
      q.alternativa_e,
      c.nome AS curso, 
      m.nome AS materia
    FROM questao q 
    JOIN curso c ON q.curso_id = c.id 
    JOIN materia m ON q.materia_id = m.id 
    WHERE q.curso_id = ?`;

  db.query(query, [cursoId], (err, results) => {
    if (err) {
      console.error("Erro ao buscar questões:", err);
      return res.status(500).json({ error: "Erro ao buscar questões" });
    }
    // Cria um campo "alternativas" para facilitar o processamento no front‑end
    results = results.map((q) => {
      q.alternativas = [
        q.alternativa_a,
        q.alternativa_b,
        q.alternativa_c,
        q.alternativa_d,
        q.alternativa_e,
      ].filter((alt) => alt && alt.trim() !== "");
      return q;
    });
    return res.json(results);
  });
});
// GET /admin/simulados/:id/active-count
router.get(
  "/admin/simulados/:id/active-count",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const simuladoId = Number(req.params.id);

    // Conta quantos alunos estão vinculados ao simulado e ainda não finalizaram
    const sql = `
      SELECT COUNT(*) AS count
      FROM simulado_aluno
      WHERE simulado_id = ?
        AND finalizado = 0
    `;
    db.query(sql, [simuladoId], (err, results) => {
      if (err) {
        console.error("Erro ao buscar active-count:", err);
        return res
          .status(500)
          .json({ error: "Não foi possível obter o contador" });
      }
      res.json({ count: results[0].count });
    });
  }
);
// página de monitor ao vivo
router.get("/admin/monitor-simulado/:id", verificarAutenticacao, (req, res) => {
  const simuladoId = Number(req.params.id);
  res.render("monitor-simulado", { simuladoId });
});
// Cadastro multi‑etapas de simulado
router.post("/cadastrar-simulado-steps", verificarAutenticacao, (req, res) => {
  // Recupera a conexão com o banco de dados e os dados enviados no corpo da requisição.
  const db = req.db;
  const { curso, turma, alunos, questoes, tempo_prova, descricao } = req.body;
  const professorId = req.session.user.id; // Identifica o professor autenticado.
  // Valida os campos obrigatórios para o cadastro do simulado.
  if (!curso || !turma) {
    return res.status(400).json({ error: "Curso e Turma são obrigatórios." });
  }
  if (!tempo_prova || !descricao) {
    return res
      .status(400)
      .json({ error: "Tempo de prova e Descrição são obrigatórios." });
  }

  // Executa uma consulta SQL com JOIN entre as tabelas "curso" e "turma" para obter os nomes do curso e da turma.
  db.query(
    "SELECT curso.nome AS cursoNome, turma.nome AS turmaNome FROM curso JOIN turma ON curso.id = turma.curso_id WHERE curso.id = ? AND turma.id = ?",
    [curso, turma],
    (err, results) => {
      if (err || !results || results.length === 0) {
        console.error("Erro ao buscar informações do curso e da turma:", err);
        return res
          .status(500)
          .json({ error: "Erro ao buscar informações do curso e da turma." });
      }

      // Armazena os nomes do curso e da turma retornados pela consulta.
      const nomeCurso = results[0].cursoNome;
      const nomeTurma = results[0].turmaNome;

      // Monta o título do simulado utilizando os nomes do curso e da turma.
      const titulo = `${nomeCurso} - Turma ${nomeTurma}`;

      // Insere o registro do simulado no banco de dados, incluindo o tempo de prova e a data de criação (NOW()).
      db.query(
        "INSERT INTO simulado (curso_id, turma_id, professor_id, titulo, descricao, tempo_prova, data_criacao) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [curso, turma, professorId, titulo, descricao, tempo_prova],
        (err, result) => {
          if (err) {
            console.error("Erro ao cadastrar simulado:", err);
            return res
              .status(500)
              .json({ error: "Erro ao cadastrar simulado." });
          }
          const simuladoId = result.insertId;

          // Converte os campos "alunos" e "questoes" para arrays, garantindo que possam ser processados mesmo se enviados como um único valor.
          const alunosArray = Array.isArray(alunos)
            ? alunos
            : alunos
            ? [alunos]
            : [];
          const questoesArray = Array.isArray(questoes)
            ? questoes
            : questoes
            ? [questoes]
            : [];

          console.log("→ Alunos recebidos no cadastro:", alunosArray);
          console.log("→ Quantidade de alunos recebidos:", alunosArray.length);
          console.log("Quantidade de questões no cadastro:", questoesArray);
          console.log(
            "→ Quantidade de questões recebidas:",
            questoesArray.length
          );
          // Verifica se há alunos ou questões para associar ao simulado. Se não houver, retorna uma resposta de sucesso.
          let totalQueries = alunosArray.length + questoesArray.length;
          if (totalQueries === 0) {
            return res.json({
              success: true,
              message: "Simulado cadastrado com sucesso!",
            });
          }
          let completed = 0;
          let responded = false;

          // Função auxiliar para verificar se todas as associações foram concluídas.
          function checkFinished() {
            completed++;
            if (completed === totalQueries && !responded) {
              responded = true;
              res.json({
                success: true,
                message: "Simulado cadastrado com sucesso!",
              });
            }
          }

          // Associa cada aluno ao simulado inserido, iterando sobre o array de alunos.
          alunosArray.forEach((alunoId) => {
            db.query(
              "INSERT INTO simulado_aluno (simulado_id, aluno_id) VALUES (?, ?)",
              [simuladoId, alunoId],
              (err, result) => {
                if (err && !responded) {
                  responded = true;
                  console.error("Erro ao associar alunos:", err);
                  return res
                    .status(500)
                    .json({ error: "Erro ao associar alunos." });
                }
                checkFinished();
              }
            );
          });

          // Associa cada questão ao simulado inserido, iterando sobre o array de questões.
          questoesArray.forEach((questaoId) => {
            db.query(
              "INSERT INTO simulado_questao (simulado_id, questao_id) VALUES (?, ?)",
              [simuladoId, questaoId],
              (err, result) => {
                if (err && !responded) {
                  responded = true;
                  console.error("Erro ao associar questões:", err);
                  return res
                    .status(500)
                    .json({ error: "Erro ao associar questões." });
                }
                checkFinished();
              }
            );
          });
        }
      );
    }
  );
});

// PUT /ativar-simulado/:id - Atualiza o status do simulado para ativo (1) ou inativo (0)
// PUT /ativar-simulado/:id - Ativa um simulado somente se não houver outro simulado ativo para a mesma turma
// e se o simulado ainda não foi finalizado.
// PUT /ativar-simulado/:id - Ativa o simulado e define o início global da prova
router.put("/ativar-simulado/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const simuladoId = req.params.id;
  const professorId = req.session.user.id;

  // Busca os dados do simulado: turma_id, finalizado e inicio_prova
  const selectQuery = `
    SELECT s.turma_id, s.finalizado, s.inicio_prova
    FROM simulado s
    INNER JOIN turma t ON s.turma_id = t.id
    WHERE s.id = ? AND t.professor_id = ?
  `;
  db.query(selectQuery, [simuladoId, professorId], (err, simuladoResult) => {
    if (err) {
      console.error("Erro ao buscar simulado:", err);
      return res.status(500).json({ error: "Erro ao buscar simulado." });
    }
    if (simuladoResult.length === 0) {
      return res
        .status(403)
        .json({ error: "Acesso negado ou simulado inexistente." });
    }

    // Se o simulado já estiver finalizado, não permite alteração.
    if (simuladoResult[0].finalizado == 1) {
      return res.status(400).json({
        error:
          "Este simulado já foi finalizado, não é possível modificar o status de simulação ativa.",
      });
    }

    // Obtemos o ID da turma do simulado
    const turmaId = simuladoResult[0].turma_id;

    // Verifica se já existe outro simulado ativo para essa mesma turma
    const checkQuery = `
      SELECT COUNT(*) AS activeCount
      FROM simulado s
      INNER JOIN turma t ON s.turma_id = t.id
      WHERE s.turma_id = ? AND s.ativa = 1 AND t.professor_id = ?
    `;
    db.query(checkQuery, [turmaId, professorId], (err, checkResult) => {
      if (err) {
        console.error("Erro ao verificar simulado ativo:", err);
        return res
          .status(500)
          .json({ error: "Erro ao verificar simulado ativo." });
      }
      if (checkResult[0].activeCount > 0) {
        return res
          .status(400)
          .json({ error: "Já existe um simulado ativo para esta turma." });
      }

      // Atualiza o simulado: define ativa = 1 e, se inicio_prova for NULL, define NOW()
      const updateQuery = `
        UPDATE simulado s 
        INNER JOIN turma t ON s.turma_id = t.id
        SET s.ativa = 1, s.inicio_prova = COALESCE(s.inicio_prova, NOW())
        WHERE s.id = ? AND t.professor_id = ?
      `;
      db.query(updateQuery, [simuladoId, professorId], (err, result) => {
        if (err) {
          console.error("Erro ao ativar simulado:", err);
          return res.status(500).json({ error: "Erro ao ativar simulado." });
        }
        if (result.affectedRows === 0) {
          return res
            .status(403)
            .json({ error: "Acesso negado ou simulado inexistente." });
        }
        return res.json({
          success: true,
          message: "Simulado ativado com sucesso!",
        });
      });
    });
  });
});

// PUT /finalizar-simulado/:id - Finaliza um simulado e desativa a simulação ativa
router.put("/finalizar-simulado/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const simuladoId = req.params.id;
  const professorId = req.session.user.id;

  db.query(
    `UPDATE simulado s 
     INNER JOIN turma t ON s.turma_id = t.id
     SET s.finalizado = 1, s.ativa = 0
     WHERE s.id = ? AND t.professor_id = ?`,
    [simuladoId, professorId],
    (err, result) => {
      if (err) {
        console.error("Erro ao finalizar simulado:", err);
        return res.status(500).json({ error: "Erro ao finalizar simulado." });
      }
      if (result.affectedRows === 0) {
        return res
          .status(403)
          .json({ error: "Acesso negado ou simulado inexistente." });
      }
      const io = req.app.get("io");
      io.emit("updateSimulation", { id: simuladoId, ativa: 0 });
      return res.json({
        success: true,
        message:
          "Simulado finalizado com sucesso! A simulação ativa foi desativada.",
      });
    }
  );
});

module.exports = router;
