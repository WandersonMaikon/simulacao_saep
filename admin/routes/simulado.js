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

    // Query para buscar os dados dos simulados
    const dataQuery = `
      SELECT s.id, s.titulo, s.descricao,
             DATE_FORMAT(s.tempo_prova, '%H:%i:%s') AS tempo_prova,
             s.ativa,
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

// GET /cadastrar-simulado - Renderiza o formulário para cadastrar um simulado
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

// GET /cadastrar-simulado-steps - Renderiza a página de cadastro multi‑etapas de simulado
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
  db.query(
    "SELECT q.id, q.titulo, q.enunciado, c.nome AS curso, m.nome AS materia FROM questao q JOIN curso c ON q.curso_id = c.id JOIN materia m ON q.materia_id = m.id WHERE q.curso_id = ?",
    [cursoId],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar questões:", err);
        return res.status(500).json({ error: "Erro ao buscar questões" });
      }
      res.json(results);
    }
  );
});

// POST /cadastrar-simulado-steps - Processa o cadastro multi‑etapas de simulado
router.post("/cadastrar-simulado-steps", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { curso, turma, alunos, questoes, tempo_prova, descricao } = req.body;
  const professorId = req.session.user.id; // Corrigido erro na atribuição

  // Verifica os campos obrigatórios
  if (!curso || !turma) {
    return res.status(400).json({ error: "Curso e Turma são obrigatórios." });
  }
  if (!tempo_prova || !descricao) {
    return res
      .status(400)
      .json({ error: "Tempo de prova e Descrição são obrigatórios." });
  }

  // Define o título (pode ser customizado)
  const titulo = "Simulado - Turma " + turma;

  // Insere o simulado, incluindo o tempo_prova
  db.query(
    "INSERT INTO simulado (curso_id, turma_id, professor_id, titulo, descricao, tempo_prova, data_criacao) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [curso, turma, professorId, titulo, descricao, tempo_prova],
    (err, result) => {
      if (err) {
        console.error("Erro ao cadastrar simulado:", err);
        return res.status(500).json({ error: "Erro ao cadastrar simulado." });
      }
      const simuladoId = result.insertId;

      // Garante que os campos alunos e questoes sejam arrays
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

      let totalQueries = alunosArray.length + questoesArray.length;
      if (totalQueries === 0) {
        return res.json({
          success: true,
          message: "Simulado cadastrado com sucesso!",
        });
      }
      let completed = 0;
      let responded = false;

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

      // Associa alunos ao simulado
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

      // Associa questões ao simulado
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
});

// PUT /ativar-simulado/:id - Ativa um simulado
router.put("/ativar-simulado/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const simuladoId = req.params.id;
  const professorId = req.session.user.id;
  db.query(
    `UPDATE simulado s 
     INNER JOIN turma t ON s.turma_id = t.id
     SET s.ativa = 1
     WHERE s.id = ? AND t.professor_id = ?`,
    [simuladoId, professorId],
    (err, result) => {
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
    }
  );
});

module.exports = router;
